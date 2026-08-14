import { Types } from 'mongoose';
import { Order, User, type IOrder } from '../../database/models';
import { sendOrderInvoiceEmail } from '../../utils/email';

const EMAIL_CLAIM_TTL_MS = 5 * 60 * 1000;

export const generateInvoiceCode = (order: Pick<IOrder, '_id' | 'orderCode'>) => {
  const fallbackId = order._id.toString().slice(-10).toUpperCase();
  const base = order.orderCode?.trim().toUpperCase() || fallbackId;
  return `INV-${base}`.slice(0, 40);
};

const releaseEmailClaim = async (orderId: Types.ObjectId, claimTime: Date) => {
  await Order.updateOne(
    { _id: orderId, invoiceEmailSendingAt: claimTime, invoiceEmailSentAt: null },
    { $set: { invoiceEmailSendingAt: null } },
  );
};

export const sendPaidOrderInvoiceEmailBestEffort = async (orderId: string) => {
  if (!Types.ObjectId.isValid(orderId)) return false;

  let claimedOrder: IOrder | null = null;
  let claimTime: Date | null = null;

  try {
    const order = await Order.findById(orderId);
    if (!order || order.paymentStatus !== 'paid') return false;

    const issuedAt = order.invoiceIssuedAt ?? new Date();
    const invoiceCode = order.invoiceCode ?? generateInvoiceCode(order);
    await Order.updateOne(
      { _id: order._id, paymentStatus: 'paid' },
      {
        $set: {
          invoiceCode,
          invoiceIssuedAt: issuedAt,
        },
      },
    );

    claimTime = new Date();
    const staleBefore = new Date(claimTime.getTime() - EMAIL_CLAIM_TTL_MS);
    claimedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        paymentStatus: 'paid',
        invoiceEmailSentAt: null,
        $or: [
          { invoiceEmailSendingAt: null },
          { invoiceEmailSendingAt: { $exists: false } },
          { invoiceEmailSendingAt: { $lte: staleBefore } },
        ],
      },
      { $set: { invoiceEmailSendingAt: claimTime } },
      { returnDocument: 'after' },
    );

    if (!claimedOrder?.invoiceCode || !claimedOrder.invoiceIssuedAt) return false;

    const user = await User.findById(claimedOrder.user_id).select('email').lean<{ email?: string } | null>();
    if (!user?.email) {
      await releaseEmailClaim(claimedOrder._id, claimTime);
      return false;
    }

    await sendOrderInvoiceEmail({
      to: user.email,
      orderId: claimedOrder._id.toString(),
      orderCode: claimedOrder.orderCode,
      invoiceCode: claimedOrder.invoiceCode,
      invoiceIssuedAt: claimedOrder.invoiceIssuedAt,
      customerName: claimedOrder.shippingAddress.customerName,
      paymentMethod: claimedOrder.paymentMethod,
      items: claimedOrder.order_list.map((item) => ({
        name: item.name,
        sku: item.sku,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        unitPrice: item.priceAtPurchased,
      })),
      subTotal: claimedOrder.subTotal,
      discountAmount:
        claimedOrder.couponDiscountAmount
        + claimedOrder.shippingDiscountAmount
        + claimedOrder.membershipDiscountAmount,
      shippingFee: claimedOrder.shippingFee,
      taxAmount: claimedOrder.taxAmount,
      totalAmount: claimedOrder.totalAmount,
    });

    await Order.updateOne(
      { _id: claimedOrder._id, invoiceEmailSendingAt: claimTime },
      {
        $set: { invoiceEmailSentAt: new Date() },
        $unset: { invoiceEmailSendingAt: 1 },
      },
    );
    return true;
  } catch (error) {
    if (claimedOrder && claimTime) {
      await releaseEmailClaim(claimedOrder._id, claimTime).catch(() => undefined);
    }
    console.error('Failed to send paid order invoice email:', error);
    return false;
  }
};
