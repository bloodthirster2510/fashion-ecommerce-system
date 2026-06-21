import { FaqArticle, User, type FaqCategory } from '../models';

const defaultFaqs: Array<{ question: string; answer: string; category: FaqCategory; keywords: string[] }> = [
  {
    question: 'Làm thế nào để theo dõi đơn hàng?',
    answer: 'Bạn mở Tài khoản, chọn Đơn hàng của tôi và chọn đơn cần xem. Trạng thái giao hàng và mã vận đơn sẽ được cập nhật tại trang chi tiết đơn.',
    category: 'orders',
    keywords: ['theo dõi đơn', 'mã vận đơn', 'trạng thái'],
  },
  {
    question: 'Chính sách đổi trả như thế nào?',
    answer: 'Đơn đã giao có thể gửi yêu cầu đổi trả trong vòng 7 ngày nếu sản phẩm còn tem mác và đáp ứng chính sách của shop. Hãy mở chi tiết đơn để gửi yêu cầu.',
    category: 'returns',
    keywords: ['đổi trả', 'hoàn hàng', '7 ngày'],
  },
  {
    question: 'Thời gian giao hàng là bao lâu?',
    answer: 'Thời gian giao dự kiến phụ thuộc địa chỉ nhận hàng và đơn vị vận chuyển. Ngày dự kiến được hiển thị trong phần vận chuyển của đơn hàng.',
    category: 'shipping',
    keywords: ['giao hàng', 'thời gian giao'],
  },
  {
    question: 'Làm sao để tích điểm thành viên?',
    answer: 'Điểm được cộng sau khi đơn hàng đủ điều kiện hoàn tất. Bạn có thể xem số điểm và lịch sử thay đổi trong mục Hạng thành viên.',
    category: 'loyalty',
    keywords: ['tích điểm', 'thành viên', 'hạng'],
  },
];

export const seedSupportFaqs = async () => {
  const admin = await User.findOne({ role: 'admin' }).select('_id').lean();
  if (!admin) return;

  for (const [index, faq] of defaultFaqs.entries()) {
    await FaqArticle.updateOne(
      { question: faq.question },
      {
        $setOnInsert: {
          ...faq,
          sortOrder: index,
          isPublished: true,
          publishedAt: new Date(),
          helpfulCount: 0,
          notHelpfulCount: 0,
          createdBy: admin._id,
          updatedBy: admin._id,
        },
      },
      { upsert: true },
    );
  }
};
