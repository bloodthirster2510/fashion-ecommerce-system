import type { Server as HttpServer } from 'http';
import type { Socket } from 'socket.io';
import { Server } from 'socket.io';
import {
  verifyAccessToken,
  wasTokenIssuedBeforePasswordChange,
  type JwtPayload,
} from '../../utils/jwt';
import { isCorsOriginAllowed } from '../../middlewares/security.middleware';
import { SupportTicket, User, type ISupportMessage, type StaffPermission } from '../../database/models';

export type SupportRoomScope = 'customer' | 'admin';

export interface SupportSocketMeta {
  user: JwtPayload;
  scope: SupportRoomScope;
}

interface SupportRealtimeEvent {
  type: 'message' | 'typing' | 'read' | 'updated' | 'summary';
  ticketId?: string;
  scope?: SupportRoomScope;
  senderId?: string;
  senderRole?: string;
  isInternal?: boolean;
  isTyping?: boolean;
  message?: Partial<ISupportMessage> & { _id: string; createdAt: string };
  ticket?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  at: string;
}

const ADMIN_ROOM = 'admin:support';
const ticketRoom = (ticketId: string) => `ticket:${ticketId}`;
const STAFF_PERMISSION_CACHE_TTL_MS = 30_000;
const staffPermissionCache = new Map<string, {
  allowed: boolean;
  expiresAt: number;
  tokenIssuedAt: number | 'unknown';
}>();

const hasStaffSupportPermission = async (user: JwtPayload) => {
  const tokenIssuedAt = user.issuedAtMs ?? user.iat ?? 'unknown';
  const cached = staffPermissionCache.get(user.userId);
  if (
    cached
    && cached.expiresAt > Date.now()
    && cached.tokenIssuedAt === tokenIssuedAt
  ) return cached.allowed;

  const account = await User.findById(user.userId)
    .select('role permissions isActive mustChangePassword passwordChangedAt')
    .lean<{
      role?: string;
      permissions?: StaffPermission[];
      isActive?: boolean;
      mustChangePassword?: boolean;
      passwordChangedAt?: Date | null;
    } | null>();
  const allowed = Boolean(
    account?.isActive
    && account.role === 'staff'
    && !account.mustChangePassword
    && !wasTokenIssuedBeforePasswordChange(user, account.passwordChangedAt)
    && account.permissions?.includes('support.reply'),
  );
  staffPermissionCache.set(user.userId, {
    allowed,
    expiresAt: Date.now() + STAFF_PERMISSION_CACHE_TTL_MS,
    tokenIssuedAt,
  });
  return allowed;
};

export const invalidateSupportSocketPermissionCache = (userId?: string) => {
  if (!userId) {
    staffPermissionCache.clear();
    return;
  }
  staffPermissionCache.delete(userId);
};

export const resolveSupportSocketMeta = async (user: JwtPayload): Promise<SupportSocketMeta> => {
  if (user.role === 'staff') {
    if (!await hasStaffSupportPermission(user)) {
      throw new Error('Insufficient permissions');
    }
    return { user, scope: 'admin' };
  }

  const account = await User.findById(user.userId)
    .select('role isActive mustChangePassword passwordChangedAt')
    .lean<{
      role?: string;
      isActive?: boolean;
      mustChangePassword?: boolean;
      passwordChangedAt?: Date | null;
    } | null>();
  if (
    !account?.isActive
    || account.role !== user.role
    || account.mustChangePassword
    || wasTokenIssuedBeforePasswordChange(user, account.passwordChangedAt)
  ) {
    throw new Error('Account access revoked');
  }

  if (user.role === 'admin') return { user, scope: 'admin' };
  if (user.role !== 'user') throw new Error('Account access revoked');

  return { user, scope: 'customer' };
};

export const canSubscribeToSupportTicket = async (meta: SupportSocketMeta, ticketId: string) =>
  meta.scope === 'admin' || Boolean(await SupportTicket.exists({
    _id: ticketId,
    userId: meta.user.userId,
  }));

class SupportRealtimeGateway {
  private io: Server | null = null;

  attach(server: HttpServer) {
    this.io = new Server(server, {
      path: '/realtime/support',
      cors: {
        origin(origin, callback) {
          if (!origin || isCorsOriginAllowed(origin)) {
            callback(null, true);
            return;
          }
          callback(null, false);
        },
        credentials: true,
        methods: ['GET', 'POST'],
      },
      maxHttpBufferSize: 1e6,
    });

    this.io.use((socket, next) => { void this.authenticate(socket, next); });

    this.io.on('connection', (socket) => this.handleConnection(socket));

    console.log('[realtime] Support gateway attached at /realtime/support');
  }

  private async authenticate(socket: Socket, next: (err?: Error) => void) {
    try {
      const raw =
        (socket.handshake.auth?.token as string | undefined) ??
        (typeof socket.handshake.query.token === 'string' ? socket.handshake.query.token : undefined);

      if (!raw) {
        return next(new Error('Authentication required'));
      }

      const decoded = verifyAccessToken(raw);
      if (!decoded?.userId) return next(new Error('Invalid token'));

      (socket.data as SupportSocketMeta) = await resolveSupportSocketMeta(decoded);
      next();
    } catch (caught) {
      next(caught instanceof Error && caught.message === 'Insufficient permissions'
        ? caught
        : new Error('Invalid or expired token'));
    }
  }

  private handleConnection(socket: Socket) {
    const meta = socket.data as SupportSocketMeta;
    socket.join(`user:${meta.user.userId}`);
    if (meta.scope === 'admin') socket.join(ADMIN_ROOM);

    socket.on('ticket:subscribe', async (ticketId: unknown, ack?: (ok: boolean) => void) => {
      if (typeof ticketId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(ticketId)) {
        ack?.(false);
        return;
      }
      try {
        const canSubscribe = await canSubscribeToSupportTicket(meta, ticketId);
        if (!canSubscribe) {
          ack?.(false);
          return;
        }
        await socket.join(ticketRoom(ticketId));
        ack?.(true);
      } catch {
        ack?.(false);
      }
    });

    socket.on('ticket:unsubscribe', (ticketId: unknown) => {
      if (typeof ticketId === 'string') socket.leave(ticketRoom(ticketId));
    });

    socket.on('ticket:typing', (payload: { ticketId?: string; isTyping?: boolean }) => {
      if (!payload || typeof payload.ticketId !== 'string') return;
      if (!socket.rooms.has(ticketRoom(payload.ticketId))) return;
      socket.to(ticketRoom(payload.ticketId)).emit('ticket:typing', {
        type: 'typing',
        ticketId: payload.ticketId,
        scope: meta.scope,
        senderId: meta.user.userId,
        senderRole: meta.user.role,
        isTyping: Boolean(payload.isTyping),
        at: new Date().toISOString(),
      } satisfies SupportRealtimeEvent);
    });

    socket.on('disconnect', () => {
      // rooms auto-cleaned by socket.io
    });
  }

  isReady() {
    return this.io !== null;
  }

  async close() {
    const io = this.io;
    this.io = null;
    if (!io) return;
    await new Promise<void>((resolve) => io.close(() => resolve()));
    staffPermissionCache.clear();
  }

  disconnectUser(userId: string) {
    if (!this.io) return;
    this.io.in(`user:${userId}`).disconnectSockets(true);
  }

  emitToTicket(ticketId: string, event: SupportRealtimeEvent) {
    if (!this.io) return;
    this.io.to(ticketRoom(ticketId)).emit('ticket:event', event);
  }

  emitToAdmin(event: SupportRealtimeEvent) {
    if (!this.io) return;
    this.io.to(ADMIN_ROOM).emit('ticket:event', event);
  }

  emitToUser(userId: string, event: SupportRealtimeEvent) {
    if (!this.io) return;
    this.io.to(`user:${userId}`).emit('ticket:event', event);
  }

  emitToTicketAndAdmin(ticketId: string, event: SupportRealtimeEvent) {
    if (!this.io) return;
    this.io.to(ticketRoom(ticketId)).to(ADMIN_ROOM).emit('ticket:event', event);
  }

  emitToAdminAndUser(userId: string, event: SupportRealtimeEvent) {
    if (!this.io) return;
    this.io.to(ADMIN_ROOM).to(`user:${userId}`).emit('ticket:event', event);
  }
}

export const supportGateway = new SupportRealtimeGateway();

export const revokeSupportSocketAccess = (userId: string) => {
  invalidateSupportSocketPermissionCache(userId);
  supportGateway.disconnectUser(userId);
};

export const emitTicketMessage = (
  ticketId: string,
  message: Partial<ISupportMessage> & { _id: string; createdAt: Date | string },
  opts: {
    isInternal?: boolean;
    customerUserId?: string | null;
    customerMessage?: Record<string, unknown>;
  } = {},
) => {
  const createdAtIso = message.createdAt instanceof Date ? message.createdAt.toISOString() : message.createdAt;
  const payload: SupportRealtimeEvent = {
    type: 'message',
    ticketId,
    message: { ...message, createdAt: createdAtIso } as SupportRealtimeEvent['message'],
    isInternal: opts.isInternal,
    at: new Date().toISOString(),
  };
  // Internal notes: only admins (admin room). Not sent to customer.
  if (opts.isInternal) {
    supportGateway.emitToAdmin({ ...payload, scope: 'admin' });
    return;
  }
  // Use separate rooms so the customer payload can omit operational fields.
  supportGateway.emitToAdmin({ ...payload, scope: 'admin' });
  if (opts.customerUserId) {
    const customerMessage = opts.customerMessage ?? message;
    const customerCreatedAt = customerMessage.createdAt instanceof Date
      ? customerMessage.createdAt.toISOString()
      : typeof customerMessage.createdAt === 'string' ? customerMessage.createdAt : createdAtIso;
    supportGateway.emitToUser(opts.customerUserId, {
      ...payload,
      scope: 'customer',
      message: { ...customerMessage, createdAt: customerCreatedAt } as SupportRealtimeEvent['message'],
    });
  }
};

export const emitTicketUpdated = (
  ticketId: string,
  ticket: Record<string, unknown>,
  opts: { customerUserId?: string | null; customerTicket?: Record<string, unknown> } = {},
) => {
  const payload: SupportRealtimeEvent = {
    type: 'updated',
    ticketId,
    ticket,
    at: new Date().toISOString(),
  };
  supportGateway.emitToAdmin({ ...payload, scope: 'admin' });
  if (opts.customerUserId) {
    supportGateway.emitToUser(opts.customerUserId, {
      ...payload,
      scope: 'customer',
      ticket: opts.customerTicket ?? ticket,
    });
  }
};

export const emitTicketRead = (ticketId: string, scope: SupportRoomScope) => {
  supportGateway.emitToTicket(ticketId, {
    type: 'read',
    ticketId,
    scope,
    at: new Date().toISOString(),
  });
};

export const emitSupportSummaryRefresh = () => {
  supportGateway.emitToAdmin({ type: 'summary', at: new Date().toISOString() });
};
