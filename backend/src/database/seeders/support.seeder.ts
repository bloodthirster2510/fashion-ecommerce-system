import {
  FaqArticle,
  SupportCannedResponse,
  User,
  type FaqCategory,
  type SupportCategory,
} from '../models';

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
  {
    question: 'Tôi có thể hủy đơn hàng không?',
    answer: 'Bạn mở chi tiết đơn và chọn Hủy đơn khi đơn vẫn còn ở trạng thái cho phép. Nếu nút Hủy đơn không còn hiển thị, hãy gửi yêu cầu hỗ trợ kèm mã đơn để shop kiểm tra.',
    category: 'orders',
    keywords: ['hủy đơn', 'hủy đơn hàng', 'trạng thái đơn'],
  },
  {
    question: 'Shop hỗ trợ những phương thức thanh toán nào?',
    answer: 'Shop hiện hỗ trợ thanh toán khi nhận hàng (COD) và thanh toán trực tuyến qua VNPay. Phương thức và số tiền cần thanh toán được hiển thị trước khi bạn xác nhận đặt hàng.',
    category: 'payments',
    keywords: ['thanh toán', 'COD', 'VNPay', 'phương thức thanh toán'],
  },
  {
    question: 'Thanh toán VNPay thất bại thì làm gì?',
    answer: 'Bạn mở chi tiết đơn và chọn Thanh toán lại khi đơn vẫn còn trong thời hạn thanh toán. Không tạo thêm đơn mới nếu đơn cũ vẫn cho phép thanh toán; nếu trạng thái chưa chính xác, hãy gửi yêu cầu hỗ trợ kèm mã đơn.',
    category: 'payments',
    keywords: ['VNPay thất bại', 'thanh toán lại', 'thanh toán lỗi', 'chờ thanh toán'],
  },
  {
    question: 'Tại sao mã voucher không sử dụng được?',
    answer: 'Mã giảm giá có thể chưa đến thời gian áp dụng, đã hết hạn hoặc hết lượt, chưa đạt giá trị đơn tối thiểu, không áp dụng cho sản phẩm trong giỏ hoặc không dành cho tài khoản của bạn. Hãy kiểm tra điều kiện và nhập đúng mã; nếu vẫn lỗi, gửi mã giảm giá cho shop qua trang Hỗ trợ.',
    category: 'promotions',
    keywords: ['voucher', 'mã giảm giá', 'không áp dụng', 'hết hạn', 'đơn tối thiểu'],
  },
  {
    question: 'Tiền hoàn được nhận bằng cách nào và mất bao lâu?',
    answer: 'Đơn VNPay được hoàn về kênh thanh toán gốc; đơn COD được hoàn qua tài khoản ngân hàng đã xác minh. Shop gửi yêu cầu hoàn trong vòng 7 ngày làm việc sau khi nhận, kiểm tra hàng và chấp thuận khoản hoàn; thời gian tiền về còn phụ thuộc VNPay hoặc ngân hàng.',
    category: 'payments',
    keywords: ['hoàn tiền', 'thời gian hoàn', 'tài khoản nhận hoàn', 'VNPay', 'COD'],
  },
  {
    question: 'Ai chịu phí vận chuyển khi đổi trả?',
    answer: 'Shop chịu phí gửi trả nếu giao sai, thiếu, sản phẩm có lỗi hoặc hư hỏng không do khách hàng. Với yêu cầu đổi kích cỡ, thay đổi nhu cầu hoặc lý do không thuộc lỗi của shop, chi phí gửi trả và giao lại sẽ được thông báo để bạn xác nhận trước khi gửi.',
    category: 'returns',
    keywords: ['phí đổi trả', 'phí gửi trả', 'đổi kích cỡ', 'hàng lỗi'],
  },
  {
    question: 'Tôi nên làm gì khi nhận sai, thiếu hoặc hàng bị hư hỏng?',
    answer: 'Hãy giữ nguyên tem nhãn, chụp ảnh sản phẩm và kiện hàng, sau đó mở chi tiết đơn để gửi yêu cầu trả hàng trong vòng 7 ngày. Bạn cũng có thể gửi yêu cầu hỗ trợ kèm mã đơn và tối đa 3 ảnh để shop đối soát.',
    category: 'returns',
    keywords: ['giao sai', 'giao thiếu', 'hàng hư hỏng', 'hàng lỗi', 'ảnh minh chứng'],
  },
  {
    question: 'Làm thế nào để thêm hoặc thay đổi địa chỉ giao hàng?',
    answer: 'Bạn mở Tài khoản, chọn Thông tin cá nhân rồi thêm, sửa hoặc đặt một địa chỉ làm mặc định trong phần địa chỉ giao hàng. Việc thay đổi địa chỉ mặc định không làm thay đổi địa chỉ của đơn đã đặt; hãy liên hệ Hỗ trợ nếu cần kiểm tra đơn hiện tại.',
    category: 'account',
    keywords: ['địa chỉ giao hàng', 'địa chỉ mặc định', 'thêm địa chỉ', 'sửa địa chỉ'],
  },
];

const defaultCannedResponses: Array<{
  title: string;
  body: string;
  category: SupportCategory | null;
}> = [
  {
    title: 'Chào khách và tiếp nhận yêu cầu',
    body: 'Chào bạn, shop đã nhận được yêu cầu và đang kiểm tra thông tin. Shop sẽ phản hồi ngay khi có kết quả. Cảm ơn bạn đã chờ.',
    category: null,
  },
  {
    title: 'Kiểm tra trạng thái đơn hàng',
    body: 'Shop đang kiểm tra trạng thái đơn hàng với bộ phận vận hành. Bạn vui lòng gửi giúp shop mã đơn nếu yêu cầu chưa được liên kết với đơn hàng.',
    category: 'orders',
  },
  {
    title: 'Hướng dẫn gửi yêu cầu trả hàng',
    body: 'Bạn vui lòng mở chi tiết đơn, chọn Yêu cầu trả hàng và gửi kèm ảnh sản phẩm, tem nhãn cùng kiện hàng. Shop sẽ kiểm tra và cập nhật kết quả trong yêu cầu này.',
    category: 'returns',
  },
  {
    title: 'Kiểm tra thanh toán VNPay',
    body: 'Shop đang đối soát giao dịch VNPay của đơn hàng. Bạn không cần tạo đơn mới trong lúc chờ; shop sẽ cập nhật trạng thái ngay khi nhận được kết quả đối soát.',
    category: 'payments',
  },
  {
    title: 'Xác nhận đã giải quyết',
    body: 'Yêu cầu của bạn đã được xử lý. Nếu vẫn cần hỗ trợ, bạn có thể phản hồi lại trong thời hạn mở lại yêu cầu. Cảm ơn bạn đã liên hệ shop.',
    category: null,
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

  for (const response of defaultCannedResponses) {
    await SupportCannedResponse.updateOne(
      { title: response.title },
      {
        $setOnInsert: {
          ...response,
          isActive: true,
          useCount: 0,
          createdBy: admin._id,
          updatedBy: admin._id,
        },
      },
      { upsert: true },
    );
  }
};
