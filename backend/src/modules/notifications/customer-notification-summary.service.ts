import { Types } from 'mongoose';
import { Cart, CustomerNotification, Order } from '../../database/models';
import { supportService } from '../support/support.service';

export const getCustomerNotificationSummary = async (userId: string) => {
  if (!Types.ObjectId.isValid(userId)) {
    throw Object.assign(new Error('Invalid user'), { statusCode: 400 });
  }

  const userObjectId = new Types.ObjectId(userId);
  const [cartRows, ordersNeedAction, support, unreadCount] = await Promise.all([
    Cart.aggregate<{ itemCount: number }>([
      { $match: { user_id: userObjectId } },
      { $project: { _id: 0, itemCount: { $sum: '$product_list.quantity' } } },
    ]),
    Order.countDocuments({
      user_id: userObjectId,
      $or: [
        {
          paymentMethod: 'VNPAY',
          paymentStatus: { $in: ['pending', 'failed'] },
          status: { $nin: ['cancelled', 'returned'] },
        },
        {
          status: 'delivered',
        },
      ],
    }),
    supportService.getCustomerSupportSummary(userId),
    CustomerNotification.countDocuments({ userId: userObjectId, isRead: false }),
  ]);

  const cartItems = cartRows[0]?.itemCount ?? 0;

  return {
    total: unreadCount,
    unreadCount,
    attentionTotal: ordersNeedAction + support.total,
    cartItems,
    ordersNeedAction,
    support,
    generatedAt: new Date(),
  };
};
