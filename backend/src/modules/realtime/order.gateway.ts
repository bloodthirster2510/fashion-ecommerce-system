import type { Server as HttpServer } from 'http';
import type { Socket } from 'socket.io';
import { Server } from 'socket.io';
import { Order, User, type IOrder, type StaffPermission } from '../../database/models';
import { isCorsOriginAllowed } from '../../middlewares/security.middleware';
import { verifyAccessToken, type JwtPayload } from '../../utils/jwt';
import type { OrderShippingMilestoneStatus } from '../orders/order.constants';

export type OrderRealtimeEventType =
  | 'shipping_update'
  | 'status_update'
  | 'payment_update'
  | 'summary';

export type OrderShippingMilestone = OrderShippingMilestoneStatus;

export type OrderRealtimeEvent = {
  type: OrderRealtimeEventType;
  orderId: string;
  orderCode: string;
  userId?: string;
  before?: { status: string; paymentStatus?: string | null; shippingStatus?: string | null };
  after?: {
    status: string;
    paymentStatus?: string | null;
    shippingStatus?: string | null;
    trackingCode?: string | null;
  };
  milestone?: OrderShippingMilestone;
  at: string;
};

type OrderSocketMeta = {
  user: JwtPayload;
  scope: 'admin' | 'customer';
};

const ADMIN_ROOM = 'admin:orders';
const orderRoom = (orderId: string) => `order:${orderId}`;
const userRoom = (userId: string) => `user:${userId}`;
const STAFF_PERMISSION_CACHE_TTL_MS = 30_000;
const staffPermissionCache = new Map<string, { allowed: boolean; expiresAt: number }>();

const hasStaffOrderPermission = async (userId: string) => {
  const cached = staffPermissionCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.allowed;

  const user = await User.findById(userId)
    .select('permissions isActive')
    .lean<{ permissions?: StaffPermission[]; isActive?: boolean } | null>();
  const allowed = Boolean(user?.isActive && user.permissions?.includes('orders.read'));
  staffPermissionCache.set(userId, { allowed, expiresAt: Date.now() + STAFF_PERMISSION_CACHE_TTL_MS });
  return allowed;
};

export const invalidateOrderSocketPermissionCache = (userId?: string) => {
  if (userId) staffPermissionCache.delete(userId);
  else staffPermissionCache.clear();
};

export const resolveOrderSocketMeta = async (user: JwtPayload): Promise<OrderSocketMeta> => {
  if (user.role === 'admin') return { user, scope: 'admin' };
  if (user.role === 'staff') {
    if (!await hasStaffOrderPermission(user.userId)) throw new Error('Insufficient permissions');
    return { user, scope: 'admin' };
  }
  return { user, scope: 'customer' };
};

export const canSubscribeToOrder = async (meta: OrderSocketMeta, orderId: string) => (
  meta.scope === 'admin' || Boolean(await Order.exists({ _id: orderId, user_id: meta.user.userId }))
);

class OrderRealtimeGateway {
  private io: Server | null = null;

  attach(server: HttpServer) {
    this.io = new Server(server, {
      path: '/realtime/orders',
      cors: {
        origin(origin, callback) {
          callback(null, !origin || isCorsOriginAllowed(origin));
        },
        credentials: true,
        methods: ['GET', 'POST'],
      },
      maxHttpBufferSize: 1e6,
    });
    this.io.use((socket, next) => { void this.authenticate(socket, next); });
    this.io.on('connection', (socket) => this.handleConnection(socket));
    console.log('[realtime] Order gateway attached at /realtime/orders');
  }

  private async authenticate(socket: Socket, next: (error?: Error) => void) {
    try {
      const raw = (socket.handshake.auth?.token as string | undefined)
        ?? (typeof socket.handshake.query.token === 'string' ? socket.handshake.query.token : undefined);
      if (!raw) return next(new Error('Authentication required'));
      const decoded = verifyAccessToken(raw);
      if (!decoded?.userId) return next(new Error('Invalid token'));
      (socket.data as OrderSocketMeta) = await resolveOrderSocketMeta(decoded);
      next();
    } catch (caught) {
      next(caught instanceof Error && caught.message === 'Insufficient permissions'
        ? caught
        : new Error('Invalid or expired token'));
    }
  }

  private handleConnection(socket: Socket) {
    const meta = socket.data as OrderSocketMeta;
    socket.join(userRoom(meta.user.userId));
    if (meta.scope === 'admin') socket.join(ADMIN_ROOM);

    socket.on('order:subscribe', async (orderId: unknown, ack?: (ok: boolean) => void) => {
      if (typeof orderId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(orderId)) {
        ack?.(false);
        return;
      }
      try {
        if (!await canSubscribeToOrder(meta, orderId)) {
          ack?.(false);
          return;
        }
        await socket.join(orderRoom(orderId));
        ack?.(true);
      } catch {
        ack?.(false);
      }
    });
    socket.on('order:unsubscribe', (orderId: unknown) => {
      if (typeof orderId === 'string') socket.leave(orderRoom(orderId));
    });
  }

  emitOrderEvent(event: OrderRealtimeEvent) {
    if (!this.io) return;
    const target = this.io.to(ADMIN_ROOM).to(orderRoom(event.orderId));
    if (event.userId) target.to(userRoom(event.userId));
    target.emit('order:event', event);
  }

  async close() {
    const io = this.io;
    this.io = null;
    if (io) await new Promise<void>((resolve) => io.close(() => resolve()));
    staffPermissionCache.clear();
  }
}

export const orderGateway = new OrderRealtimeGateway();

export const emitOrderUpdate = (
  order: IOrder,
  type: OrderRealtimeEventType,
  before: { status: string; paymentStatus?: string | null; shippingStatus?: string | null },
  milestone?: OrderShippingMilestone,
) => {
  orderGateway.emitOrderEvent({
    type,
    orderId: order._id.toString(),
    orderCode: order.orderCode,
    userId: order.user_id.toString(),
    before,
    after: {
      status: order.status,
      paymentStatus: order.paymentStatus,
      shippingStatus: order.shipping?.status ?? null,
      trackingCode: order.shipping?.trackingCode ?? null,
    },
    milestone,
    at: new Date().toISOString(),
  });
};
