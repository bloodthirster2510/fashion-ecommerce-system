import {
  Coupon,
  Inventory,
  Order,
  Review,
  SupportTicket,
  User,
  type StaffPermission,
} from '../../../database/models';
import { getOrderPaymentDeadlineWarningMs, ONLINE_PAYMENT_METHODS } from '../../payments/order-payment-deadline.config';

const DEFAULT_LOW_STOCK_THRESHOLD = 5;
const EXPIRING_COUPON_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
type NotificationActor = {
  userId: string;
  role: string;
};

type OrderSummaryRow = {
  _id: null;
  confirmed: number;
  packed: number;
  returnRequested: number;
  online: number;
  cod: number;
  total: number;
};

const hasPermission = (
  role: string,
  permissions: StaffPermission[],
  permission: StaffPermission,
) => role === 'admin' || permissions.includes(permission);

const getActorPermissions = async (actor: NotificationActor) => {
  if (actor.role === 'admin') return [];

  const user = await User.findById(actor.userId)
    .select('permissions isActive')
    .lean<{ permissions?: StaffPermission[]; isActive?: boolean } | null>();

  return user?.isActive ? user.permissions ?? [] : [];
};

const getOrderCounts = async () => {
  const rows = await Order.aggregate<OrderSummaryRow>([
    {
      $match: {
        $or: [
          {
            status: { $in: ['confirmed', 'packed'] },
            paymentStatus: { $ne: 'failed' },
            $or: [
              { paymentMethod: 'COD' },
              { paymentStatus: 'paid' },
            ],
          },
          {
            status: 'return_requested',
            'returnRequest.status': 'requested',
          },
        ],
      },
    },
    {
      $group: {
        _id: null,
        confirmed: { $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] } },
        packed: { $sum: { $cond: [{ $eq: ['$status', 'packed'] }, 1, 0] } },
        returnRequested: { $sum: { $cond: [{ $eq: ['$status', 'return_requested'] }, 1, 0] } },
        online: { $sum: { $cond: [{ $ne: ['$paymentMethod', 'COD'] }, 1, 0] } },
        cod: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'COD'] }, 1, 0] } },
        total: { $sum: 1 },
      },
    },
  ]);

  return rows[0] ?? {
    confirmed: 0,
    packed: 0,
    returnRequested: 0,
    online: 0,
    cod: 0,
    total: 0,
  };
};

const getLowStockVariantCount = async (threshold: number) => {
  const rows = await Inventory.aggregate<{ count: number }>([
    { $match: { availableQuantity: { $gt: 0, $lte: threshold } } },
    {
      $group: {
        _id: {
          productId: '$productId',
          variantId: '$variantId',
          colorVariantId: '$colorVariantId',
        },
      },
    },
    { $count: 'count' },
  ]);

  return rows[0]?.count ?? 0;
};

export const getNotificationSummary = async (
  actor: NotificationActor,
  now = new Date(),
) => {
  const permissions = await getActorPermissions(actor);
  const canReadOrders = hasPermission(actor.role, permissions, 'orders.read');
  const canReadInventory = hasPermission(actor.role, permissions, 'inventory.read');
  const canReadPromotions = hasPermission(actor.role, permissions, 'promotions.read');
  const canReplySupport = hasPermission(actor.role, permissions, 'support.reply');
  const canReadReviews = hasPermission(actor.role, permissions, 'reviews.read');
  const expiringBefore = new Date(now.getTime() + EXPIRING_COUPON_WINDOW_MS);
  const paymentDeadlineWarningBefore = new Date(now.getTime() + getOrderPaymentDeadlineWarningMs());

  const [orders, lowStockVariants, expiringCoupons, supportOpen, reviewsPending, paymentDeadlineSoon] = await Promise.all([
    canReadOrders ? getOrderCounts() : null,
    canReadInventory ? getLowStockVariantCount(DEFAULT_LOW_STOCK_THRESHOLD) : 0,
    canReadPromotions
      ? Coupon.countDocuments({
          deletedAt: null,
          isActive: true,
          startAt: { $lte: now },
          endAt: { $gte: now, $lte: expiringBefore },
        })
      : 0,
    canReplySupport
      ? SupportTicket.countDocuments({
          status: { $in: ['open', 'in_progress', 'waiting_customer'] },
          lastMessageSender: 'customer',
          requiresReply: true,
        })
      : 0,
    canReadReviews ? Review.countDocuments({ moderationStatus: 'pending' }) : 0,
    canReadOrders ? Order.countDocuments({
      status: 'confirmed',
      paymentMethod: { $in: ONLINE_PAYMENT_METHODS },
      paymentStatus: { $in: ['pending', 'failed'] },
      paymentDeadlineAt: { $gt: now, $lte: paymentDeadlineWarningBefore },
    }) : 0,
  ]);

  const orderCounts = orders ?? {
    confirmed: 0,
    packed: 0,
    returnRequested: 0,
    online: 0,
    cod: 0,
    total: 0,
  };
  const total = orderCounts.total + lowStockVariants + expiringCoupons + supportOpen + reviewsPending + paymentDeadlineSoon;

  return {
    total,
    orders: orderCounts,
    lowStockVariants,
    expiringCoupons,
    paymentDeadlineSoon,
    supportOpen,
    reviewsPending,
    capabilities: {
      orders: canReadOrders,
      inventory: canReadInventory,
      promotions: canReadPromotions,
      support: canReplySupport,
      reviews: canReadReviews,
    },
    generatedAt: now,
  };
};
