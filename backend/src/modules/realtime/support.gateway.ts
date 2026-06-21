import type { Server as HttpServer } from 'http';
import type { Socket } from 'socket.io';
import { Server } from 'socket.io';
import { verifyAccessToken, type JwtPayload } from '../../utils/jwt';
import { isCorsOriginAllowed } from '../../middlewares/security.middleware';
import type { ISupportMessage } from '../../database/models';

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

    this.io.use((socket, next) => this.authenticate(socket, next));

    this.io.on('connection', (socket) => this.handleConnection(socket));

    console.log('[realtime] Support gateway attached at /realtime/support');
  }

  private authenticate(socket: Socket, next: (err?: Error) => void) {
    try {
      const raw =
        (socket.handshake.auth?.token as string | undefined) ??
        (typeof socket.handshake.query.token === 'string' ? socket.handshake.query.token : undefined);

      if (!raw) {
        return next(new Error('Authentication required'));
      }

      const decoded = verifyAccessToken(raw);
      if (!decoded?.userId) return next(new Error('Invalid token'));

      const scope: SupportRoomScope = decoded.role === 'admin' || decoded.role === 'staff' ? 'admin' : 'customer';
      (socket.data as SupportSocketMeta) = { user: decoded, scope };
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  }

  private handleConnection(socket: Socket) {
    const meta = socket.data as SupportSocketMeta;
    socket.join(`user:${meta.user.userId}`);
    if (meta.scope === 'admin') socket.join(ADMIN_ROOM);

    socket.on('ticket:subscribe', (ticketId: unknown, ack?: (ok: boolean) => void) => {
      if (typeof ticketId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(ticketId)) {
        ack?.(false);
        return;
      }
      socket.join(ticketRoom(ticketId));
      ack?.(true);
    });

    socket.on('ticket:unsubscribe', (ticketId: unknown) => {
      if (typeof ticketId === 'string') socket.leave(ticketRoom(ticketId));
    });

    socket.on('ticket:typing', (payload: { ticketId?: string; isTyping?: boolean }) => {
      if (!payload || typeof payload.ticketId !== 'string') return;
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

export const emitTicketMessage = (
  ticketId: string,
  message: Partial<ISupportMessage> & { _id: string; createdAt: Date | string },
  opts: { isInternal?: boolean; customerUserId?: string | null } = {},
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
  // Non-internal: ticket room (customer + admin viewing) + admin room (queue) — single broadcast, no duplicates
  supportGateway.emitToTicketAndAdmin(ticketId, payload);
  // Direct push to customer user room in case they're not subscribed to this ticket
  if (opts.customerUserId) supportGateway.emitToUser(opts.customerUserId, { ...payload, scope: 'customer' });
};

export const emitTicketUpdated = (
  ticketId: string,
  ticket: Record<string, unknown>,
  opts: { customerUserId?: string | null } = {},
) => {
  const payload: SupportRealtimeEvent = {
    type: 'updated',
    ticketId,
    ticket,
    at: new Date().toISOString(),
  };
  supportGateway.emitToTicketAndAdmin(ticketId, payload);
  if (opts.customerUserId) supportGateway.emitToUser(opts.customerUserId, { ...payload, scope: 'customer' });
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