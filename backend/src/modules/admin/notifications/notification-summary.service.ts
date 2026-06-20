import {
  Coupon,
  Inventory,
  Order,
  User,
  type StaffPermission,
} from '../../../database/models';

const DEFAULT_LOW_STOCK_THRESHOLD = 5;
const EXPIRING_COUPON_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const ATTENTION_ORDER_STATUSES = ['confirmed', 'packed', 'return_requested'] as const;

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
    { $match: { status: { $in: ATTENTION_ORDER_STATUSES } } },
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
    { $match: { availableQuantity: { $lte: threshold } } },
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
  const canReadAccounts = actor.role === 'admin';
  const expiringBefore = new Date(now.getTime() + EXPIRING_COUPON_WINDOW_MS);

  const [orders, lowStockVariants, expiringCoupons, inactiveAccounts] = await Promise.all([
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
    canReadAccounts ? User.countDocuments({ role: 'staff', isActive: false }) : 0,
  ]);

  const orderCounts = orders ?? {
    confirmed: 0,
    packed: 0,
    returnRequested: 0,
    online: 0,
    cod: 0,
    total: 0,
  };
  const total = orderCounts.total + lowStockVariants + expiringCoupons + inactiveAccounts;

  return {
    total,
    orders: orderCounts,
    lowStockVariants,
    expiringCoupons,
    inactiveAccounts,
    supportOpen: 0,
    reviewsPending: 0,
    capabilities: {
      orders: canReadOrders,
      inventory: canReadInventory,
      promotions: canReadPromotions,
      accounts: canReadAccounts,
      support: false,
      reviews: false,
      loyaltyApprovals: false,
      reports: false,
    },
    generatedAt: now,
  };
};
