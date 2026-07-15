import { Types } from 'mongoose';
import {
  Inventory,
  Order,
  Product,
  User,
  type StaffPermission,
} from '../../../database/models';

const DAY_MS = 24 * 60 * 60 * 1000;
const BANGKOK_TIME_ZONE = 'Asia/Bangkok';
const MAX_DAYS = 180;

type DashboardActor = {
  userId: string;
  role: string;
};

type DashboardQuery = {
  days?: unknown;
};

type DashboardRange = {
  days: number;
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
};

type BusinessRow = {
  _id: null;
  totalOrders: number;
  paidOrders: number;
  paidRevenue: number;
  itemsSold: number;
  cancelledOrders: number;
  returnedOrders: number;
};

type CustomerMixRow = {
  _id: null;
  customers: number;
  newCustomers: number;
  returningCustomers: number;
};

type TrendRow = {
  _id: string;
  paidRevenue: number;
  paidOrders: number;
};

type TopProductRow = {
  _id: Types.ObjectId;
  sku: string;
  name: string;
  image: string | null;
  units: number;
  grossSales: number;
  orderIds: Types.ObjectId[];
};

type InventorySummaryRow = {
  _id: null;
  totalSkus: number;
  lowStockSkus: number;
  outOfStockSkus: number;
  reservedUnits: number;
};

type InventoryRiskDocument = {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  sku: string;
  size: string;
  availableQuantity: number;
  reservedQuantity: number;
};

type ProductSnapshot = {
  _id: Types.ObjectId;
  name: string;
  product_image: string;
};

type SkuVelocityRow = {
  _id: string;
  units: number;
};

type OrderStatusRow = {
  _id: string;
  count: number;
};

const bangkokDateKey = (date: Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: BANGKOK_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(date);

const bangkokDayStart = (date: Date) => new Date(`${bangkokDateKey(date)}T00:00:00+07:00`);

export const normalizeDashboardRange = (
  query: DashboardQuery,
  now = new Date(),
): DashboardRange => {
  const parsedDays = query.days === undefined || query.days === '' ? 30 : Number(query.days);

  if (!Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > MAX_DAYS) {
    throw Object.assign(new Error(`Dashboard days must be from 1 to ${MAX_DAYS}`), {
      statusCode: 400,
    });
  }

  const todayStart = bangkokDayStart(now);
  const from = new Date(todayStart.getTime() - (parsedDays - 1) * DAY_MS);
  const previousTo = from;
  const previousFrom = new Date(previousTo.getTime() - parsedDays * DAY_MS);

  return {
    days: parsedDays,
    from,
    to: now,
    previousFrom,
    previousTo,
  };
};

export const calculateDashboardChange = (value: number, previousValue: number) => {
  if (previousValue === 0) return value === 0 ? 0 : null;
  return Math.round(((value - previousValue) / Math.abs(previousValue)) * 1000) / 10;
};

const hasPermission = (
  actor: DashboardActor,
  permissions: StaffPermission[],
  permission: StaffPermission,
) => actor.role === 'admin' || permissions.includes(permission);

const getPermissions = async (actor: DashboardActor) => {
  if (actor.role === 'admin') return [];

  const user = await User.findById(actor.userId)
    .select('permissions isActive')
    .lean<{ permissions?: StaffPermission[]; isActive?: boolean } | null>();

  return user?.isActive ? user.permissions ?? [] : [];
};

const paidOrderExpression = {
  $and: [
    { $eq: ['$paymentStatus', 'paid'] },
    { $not: [{ $in: ['$status', ['cancelled', 'returned']] }] },
  ],
};

const getBusinessSnapshot = async (from: Date, to: Date) => {
  const rows = await Order.aggregate<BusinessRow>([
    { $match: { createdAt: { $gte: from, $lt: to } } },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        paidOrders: { $sum: { $cond: [paidOrderExpression, 1, 0] } },
        paidRevenue: { $sum: { $cond: [paidOrderExpression, '$totalAmount', 0] } },
        itemsSold: {
          $sum: {
            $cond: [
              paidOrderExpression,
              {
                $reduce: {
                  input: '$order_list',
                  initialValue: 0,
                  in: { $add: ['$$value', '$$this.quantity'] },
                },
              },
              0,
            ],
          },
        },
        cancelledOrders: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
        returnedOrders: { $sum: { $cond: [{ $eq: ['$status', 'returned'] }, 1, 0] } },
      },
    },
  ]);

  const row = rows[0] ?? {
    _id: null,
    totalOrders: 0,
    paidOrders: 0,
    paidRevenue: 0,
    itemsSold: 0,
    cancelledOrders: 0,
    returnedOrders: 0,
  };

  return {
    ...row,
    averageOrderValue: row.paidOrders ? Math.round(row.paidRevenue / row.paidOrders) : 0,
    cancellationRate: row.totalOrders ? row.cancelledOrders / row.totalOrders : 0,
    returnRate: row.totalOrders ? row.returnedOrders / row.totalOrders : 0,
  };
};

const getCustomerMix = async (from: Date, to: Date) => {
  const rows = await Order.aggregate<CustomerMixRow>([
    {
      $match: {
        createdAt: { $lt: to },
        paymentStatus: 'paid',
        status: { $nin: ['cancelled', 'returned'] },
      },
    },
    {
      $group: {
        _id: '$user_id',
        firstPaidAt: { $min: '$createdAt' },
        currentOrders: {
          $sum: { $cond: [{ $gte: ['$createdAt', from] }, 1, 0] },
        },
      },
    },
    { $match: { currentOrders: { $gt: 0 } } },
    {
      $group: {
        _id: null,
        customers: { $sum: 1 },
        newCustomers: { $sum: { $cond: [{ $gte: ['$firstPaidAt', from] }, 1, 0] } },
        returningCustomers: { $sum: { $cond: [{ $lt: ['$firstPaidAt', from] }, 1, 0] } },
      },
    },
  ]);

  const row = rows[0] ?? {
    _id: null,
    customers: 0,
    newCustomers: 0,
    returningCustomers: 0,
  };

  return {
    customers: row.customers,
    newCustomers: row.newCustomers,
    returningCustomers: row.returningCustomers,
    returningCustomerRate: row.customers ? row.returningCustomers / row.customers : 0,
  };
};

const fillTrend = (range: DashboardRange, rows: TrendRow[]) => {
  const rowMap = new Map(rows.map((row) => [row._id, row]));
  const points = [];

  for (let cursor = range.from.getTime(); cursor <= bangkokDayStart(range.to).getTime(); cursor += DAY_MS) {
    const date = new Date(cursor);
    const key = bangkokDateKey(date);
    const row = rowMap.get(key);
    points.push({
      date: key,
      paidRevenue: row?.paidRevenue ?? 0,
      paidOrders: row?.paidOrders ?? 0,
    });
  }

  return points;
};

const getBusinessTrend = async (range: DashboardRange) => {
  const rows = await Order.aggregate<TrendRow>([
    {
      $match: {
        createdAt: { $gte: range.from, $lt: range.to },
        paymentStatus: 'paid',
        status: { $nin: ['cancelled', 'returned'] },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            date: '$createdAt',
            format: '%Y-%m-%d',
            timezone: BANGKOK_TIME_ZONE,
          },
        },
        paidRevenue: { $sum: '$totalAmount' },
        paidOrders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return fillTrend(range, rows);
};

const getTopProducts = async (from: Date, to: Date) => {
  const rows = await Order.aggregate<TopProductRow>([
    {
      $match: {
        createdAt: { $gte: from, $lt: to },
        paymentStatus: 'paid',
        status: { $nin: ['cancelled', 'returned'] },
      },
    },
    { $unwind: '$order_list' },
    {
      $group: {
        _id: '$order_list.productId',
        sku: { $first: '$order_list.sku' },
        name: { $first: '$order_list.name' },
        image: { $first: '$order_list.image' },
        units: { $sum: '$order_list.quantity' },
        grossSales: {
          $sum: { $multiply: ['$order_list.quantity', '$order_list.priceAtPurchased'] },
        },
        orderIds: { $addToSet: '$_id' },
      },
    },
    { $sort: { grossSales: -1, units: -1 } },
    { $limit: 5 },
  ]);

  return rows.map((row) => ({
    productId: row._id.toString(),
    sku: row.sku,
    name: row.name,
    image: row.image,
    units: row.units,
    grossSales: row.grossSales,
    orders: row.orderIds.length,
  }));
};

const getOrderHealth = async (from: Date, to: Date) => {
  const rows = await Order.aggregate<OrderStatusRow>([
    { $match: { createdAt: { $gte: from, $lt: to } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  return rows.map((row) => ({ status: row._id, count: row.count }));
};

const getInventoryOverview = async () => {
  const salesFrom = new Date(Date.now() - 28 * DAY_MS);
  const [summaryRows, riskRows, velocityRows] = await Promise.all([
    Inventory.aggregate<InventorySummaryRow>([
      {
        $group: {
          _id: null,
          totalSkus: { $sum: 1 },
          lowStockSkus: { $sum: { $cond: [{ $lte: ['$availableQuantity', 5] }, 1, 0] } },
          outOfStockSkus: { $sum: { $cond: [{ $eq: ['$availableQuantity', 0] }, 1, 0] } },
          reservedUnits: { $sum: '$reservedQuantity' },
        },
      },
    ]),
    Inventory.find({ availableQuantity: { $lte: 20 } })
      .select('productId sku size availableQuantity reservedQuantity')
      .sort({ availableQuantity: 1, reservedQuantity: -1 })
      .limit(120)
      .lean<InventoryRiskDocument[]>(),
    Order.aggregate<SkuVelocityRow>([
      {
        $match: {
          createdAt: { $gte: salesFrom },
          paymentStatus: 'paid',
          status: { $nin: ['cancelled', 'returned'] },
        },
      },
      { $unwind: '$order_list' },
      { $group: { _id: '$order_list.sku', units: { $sum: '$order_list.quantity' } } },
    ]),
  ]);

  const productIds = [...new Set(riskRows.map((item) => item.productId.toString()))]
    .map((id) => new Types.ObjectId(id));
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds } })
      .select('name product_image')
      .lean<ProductSnapshot[]>()
    : [];
  const productMap = new Map(products.map((product) => [product._id.toString(), product]));
  const velocityMap = new Map(velocityRows.map((row) => [row._id, row.units]));

  const atRisk = riskRows
    .map((item) => {
      const unitsSold28d = velocityMap.get(item.sku) ?? 0;
      const unitsPerDay = unitsSold28d / 28;
      const daysRemaining = unitsPerDay > 0
        ? Math.round((item.availableQuantity / unitsPerDay) * 10) / 10
        : null;
      const product = productMap.get(item.productId.toString());

      return {
        inventoryId: item._id.toString(),
        productId: item.productId.toString(),
        name: product?.name ?? item.sku,
        image: product?.product_image ?? null,
        sku: item.sku,
        size: item.size,
        availableQuantity: item.availableQuantity,
        reservedQuantity: item.reservedQuantity,
        unitsSold28d,
        daysRemaining,
      };
    })
    .sort((left, right) => {
      if (left.availableQuantity === 0 && right.availableQuantity !== 0) return -1;
      if (right.availableQuantity === 0 && left.availableQuantity !== 0) return 1;
      if (left.daysRemaining !== null && right.daysRemaining !== null) {
        return left.daysRemaining - right.daysRemaining || left.availableQuantity - right.availableQuantity;
      }
      if (left.daysRemaining !== null) return -1;
      if (right.daysRemaining !== null) return 1;
      return left.availableQuantity - right.availableQuantity;
    })
    .slice(0, 5);

  const summary = summaryRows[0] ?? {
    _id: null,
    totalSkus: 0,
    lowStockSkus: 0,
    outOfStockSkus: 0,
    reservedUnits: 0,
  };

  return {
    totalSkus: summary.totalSkus,
    lowStockSkus: summary.lowStockSkus,
    outOfStockSkus: summary.outOfStockSkus,
    reservedUnits: summary.reservedUnits,
    atRisk,
  };
};

export const getDashboardOverview = async (
  actor: DashboardActor,
  query: DashboardQuery = {},
) => {
  const range = normalizeDashboardRange(query);
  const permissions = await getPermissions(actor);
  const capabilities = {
    reports: hasPermission(actor, permissions, 'reports.read'),
    orders: hasPermission(actor, permissions, 'orders.read'),
    inventory: hasPermission(actor, permissions, 'inventory.read'),
    customers: hasPermission(actor, permissions, 'customers.read'),
    promotions: hasPermission(actor, permissions, 'promotions.read'),
    support: hasPermission(actor, permissions, 'support.reply'),
  };

  const [currentBusiness, previousBusiness, customerMix, previousCustomerMix, trend, topProducts, orderHealth, inventory] = await Promise.all([
    capabilities.reports ? getBusinessSnapshot(range.from, range.to) : null,
    capabilities.reports ? getBusinessSnapshot(range.previousFrom, range.previousTo) : null,
    capabilities.reports ? getCustomerMix(range.from, range.to) : null,
    capabilities.reports ? getCustomerMix(range.previousFrom, range.previousTo) : null,
    capabilities.reports ? getBusinessTrend(range) : [],
    capabilities.reports ? getTopProducts(range.from, range.to) : [],
    capabilities.orders ? getOrderHealth(range.from, range.to) : [],
    capabilities.inventory ? getInventoryOverview() : null,
  ]);

  const business = currentBusiness && previousBusiness && customerMix && previousCustomerMix
    ? {
        summary: {
          ...currentBusiness,
          ...customerMix,
        },
        comparison: {
          paidRevenuePercent: calculateDashboardChange(currentBusiness.paidRevenue, previousBusiness.paidRevenue),
          paidOrdersPercent: calculateDashboardChange(currentBusiness.paidOrders, previousBusiness.paidOrders),
          averageOrderValuePercent: calculateDashboardChange(currentBusiness.averageOrderValue, previousBusiness.averageOrderValue),
          returningCustomerRatePoints: Math.round(
            (customerMix.returningCustomerRate - previousCustomerMix.returningCustomerRate) * 10_000,
          ) / 100,
          cancellationRatePoints: Math.round(
            (currentBusiness.cancellationRate - previousBusiness.cancellationRate) * 10_000,
          ) / 100,
        },
        trend,
        topProducts,
      }
    : null;

  return {
    generatedAt: new Date(),
    range: {
      days: range.days,
      from: range.from,
      to: range.to,
      previousFrom: range.previousFrom,
      previousTo: range.previousTo,
    },
    capabilities,
    business,
    orderHealth,
    inventory,
  };
};
