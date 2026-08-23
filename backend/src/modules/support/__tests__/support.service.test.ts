import { FaqArticle, FaqVote, SupportMessage, SupportTicket } from '../../../database/models';
import {
  addCustomerMessage,
  closeCustomerTicket,
  createGuestFeedback,
  createTicket,
  getCustomerTicket,
  listFaqs,
  voteFaq,
  reopenCustomerTicket,
  toCustomerSupportMessage,
  toCustomerSupportTicket,
} from '../support.service';

jest.mock('../../../database/models', () => ({
  Coupon: { exists: jest.fn() },
  FaqArticle: {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
  },
  FaqVote: { find: jest.fn(), create: jest.fn(), deleteOne: jest.fn() },
  FAQ_CATEGORIES: ['orders', 'shipping', 'returns', 'payments', 'promotions', 'loyalty', 'account', 'other'],
  Order: { exists: jest.fn() },
  SupportMessage: { find: jest.fn(), create: jest.fn(), deleteOne: jest.fn() },
  SupportTicket: { findOne: jest.fn(), findOneAndUpdate: jest.fn(), findById: jest.fn(), create: jest.fn(), deleteOne: jest.fn() },
  SUPPORT_CATEGORIES: ['orders', 'shipping', 'returns', 'payments', 'promotions', 'loyalty', 'account', 'product', 'app_website', 'service', 'other'],
  SUPPORT_TICKET_TYPES: ['question', 'issue', 'complaint', 'feedback', 'suggestion'],
}));

const userId = '665000000000000000000001';
const ticketId = '665000000000000000000002';
const mockedTicket = SupportTicket as jest.Mocked<typeof SupportTicket>;
const mockedMessage = SupportMessage as jest.Mocked<typeof SupportMessage>;
const mockedFaq = FaqArticle as jest.Mocked<typeof FaqArticle>;
const mockedFaqVote = FaqVote as jest.Mocked<typeof FaqVote>;

describe('support service security and state rules', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requires an order for order-related ticket categories', async () => {
    await expect(createTicket(userId, {
      type: 'issue',
      category: 'orders',
      subject: 'Đơn hàng có vấn đề',
      body: 'Tôi cần shop kiểm tra đơn hàng này.',
    })).rejects.toMatchObject({ message: 'orderId is required for this category', statusCode: 400 });
    expect(mockedTicket.create).not.toHaveBeenCalled();
  });

  it('scopes customer ticket reads by both ticket id and user id and hides internal notes', async () => {
    const ticketLean = jest.fn().mockResolvedValue({ _id: ticketId, userId, status: 'open' });
    const ticketSelect = jest.fn().mockReturnValue({ lean: ticketLean });
    mockedTicket.findOne.mockReturnValue({ select: ticketSelect } as never);
    const messageLean = jest.fn().mockResolvedValue([]);
    const sort = jest.fn().mockReturnValue({ lean: messageLean });
    const messageSelect = jest.fn().mockReturnValue({ sort });
    mockedMessage.find.mockReturnValue({ select: messageSelect } as never);

    await getCustomerTicket(ticketId, userId);

    expect(mockedTicket.findOne).toHaveBeenCalledWith(expect.objectContaining({
      _id: expect.anything(),
      userId: expect.anything(),
    }));
    expect(mockedMessage.find).toHaveBeenCalledWith(expect.objectContaining({
      isInternal: false,
    }));
  });

  it('rejects customer messages on closed tickets', async () => {
    mockedTicket.findOne.mockResolvedValue({ _id: ticketId, status: 'closed' } as never);

    await expect(addCustomerMessage(ticketId, userId, { body: 'Tôi muốn bổ sung thông tin.' }))
      .rejects.toMatchObject({ message: 'Closed ticket cannot receive messages', statusCode: 409 });
    expect(mockedMessage.create).not.toHaveBeenCalled();
  });

  it('returns only published, customer-safe FAQ fields', async () => {
    const faq = {
      _id: '665000000000000000000006',
      question: 'Làm sao cập nhật tài khoản?',
      answer: 'Bạn mở hồ sơ và chọn chỉnh sửa.',
      category: 'account',
      helpfulCount: 3,
      notHelpfulCount: 1,
    };
    const query: Record<string, jest.Mock> = {};
    query.select = jest.fn().mockReturnValue(query);
    query.sort = jest.fn().mockReturnValue(query);
    query.skip = jest.fn().mockReturnValue(query);
    query.limit = jest.fn().mockReturnValue(query);
    query.lean = jest.fn().mockResolvedValue([faq]);
    mockedFaq.find.mockReturnValue(query as never);
    mockedFaq.countDocuments.mockResolvedValue(1);

    await expect(listFaqs({ page: 1, limit: 20 })).resolves.toMatchObject({
      items: [{ ...faq, userVote: null }],
    });

    expect(mockedFaq.find).toHaveBeenCalledWith({ isPublished: true });
    expect(query.select).toHaveBeenCalledWith(
      '_id question answer category sortOrder helpfulCount notHelpfulCount createdAt updatedAt',
    );
  });

  it('keeps management fields available in the admin FAQ listing', async () => {
    const query: Record<string, jest.Mock> = {};
    query.select = jest.fn().mockReturnValue(query);
    query.sort = jest.fn().mockReturnValue(query);
    query.skip = jest.fn().mockReturnValue(query);
    query.limit = jest.fn().mockReturnValue(query);
    query.lean = jest.fn().mockResolvedValue([]);
    mockedFaq.find.mockReturnValue(query as never);
    mockedFaq.countDocuments.mockResolvedValue(0);

    await listFaqs({ page: 1, limit: 100, publishedOnly: false });

    expect(mockedFaq.find).toHaveBeenCalledWith({});
    expect(query.select).not.toHaveBeenCalled();
  });

  it('returns the signed-in customer vote with public FAQs', async () => {
    const faqId = '665000000000000000000006';
    const query: Record<string, jest.Mock> = {};
    query.select = jest.fn().mockReturnValue(query);
    query.sort = jest.fn().mockReturnValue(query);
    query.skip = jest.fn().mockReturnValue(query);
    query.limit = jest.fn().mockReturnValue(query);
    query.lean = jest.fn().mockResolvedValue([{ _id: faqId, question: 'Câu hỏi', answer: 'Câu trả lời' }]);
    mockedFaq.find.mockReturnValue(query as never);
    mockedFaq.countDocuments.mockResolvedValue(1);
    const voteQuery: Record<string, jest.Mock> = {};
    voteQuery.select = jest.fn().mockReturnValue(voteQuery);
    voteQuery.lean = jest.fn().mockResolvedValue([{ faqId, value: 'helpful' }]);
    mockedFaqVote.find.mockReturnValue(voteQuery as never);

    await expect(listFaqs({ page: 1, limit: 20, viewerUserId: userId })).resolves.toMatchObject({
      items: [{ _id: faqId, userVote: 'helpful' }],
    });

    expect(mockedFaqVote.find).toHaveBeenCalledWith({
      faqId: { $in: [faqId] },
      userId: expect.anything(),
    });
  });

  it('returns a Vietnamese message when the customer already voted', async () => {
    const faqId = '665000000000000000000006';
    mockedFaq.findOne.mockResolvedValue({ _id: faqId, isPublished: true } as never);
    mockedFaqVote.create.mockRejectedValue(Object.assign(new Error('duplicate'), { code: 11000 }));

    await expect(voteFaq(faqId, userId, { value: 'helpful' }))
      .rejects.toMatchObject({ message: 'Bạn đã đánh giá câu trả lời này rồi.', statusCode: 409 });
  });

  it('removes a vote if the FAQ becomes unavailable before its counter update', async () => {
    const faqId = '665000000000000000000006';
    const voteId = '665000000000000000000007';
    mockedFaq.findOne.mockResolvedValue({ _id: faqId, isPublished: true } as never);
    mockedFaqVote.create.mockResolvedValue({ _id: voteId } as never);
    const updateQuery: Record<string, jest.Mock> = {};
    updateQuery.select = jest.fn().mockReturnValue(updateQuery);
    updateQuery.lean = jest.fn().mockResolvedValue(null);
    mockedFaq.findOneAndUpdate.mockReturnValue(updateQuery as never);
    mockedFaq.findByIdAndUpdate.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) } as never);

    await expect(voteFaq(faqId, userId, { value: 'helpful' }))
      .rejects.toMatchObject({ message: 'Câu hỏi này không còn khả dụng.', statusCode: 409 });

    expect(mockedFaq.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: expect.anything(), isPublished: true },
      { $inc: { helpfulCount: 1 } },
      { returnDocument: 'after' },
    );
    expect(updateQuery.select).toHaveBeenCalledWith(
      '_id question answer category sortOrder helpfulCount notHelpfulCount createdAt updatedAt',
    );
    expect(mockedFaqVote.deleteOne).toHaveBeenCalledWith({ _id: voteId });
  });

  it('removes a just-created message when the ticket closes concurrently', async () => {
    const messageId = '665000000000000000000005';
    const messageAt = new Date('2026-08-01T10:00:00.000Z');
    mockedTicket.findOne
      .mockResolvedValueOnce({
        _id: ticketId,
        status: 'in_progress',
        lastMessageAt: new Date('2026-08-01T09:00:00.000Z'),
      } as never)
      .mockResolvedValueOnce({ _id: ticketId, status: 'closed' } as never);
    mockedMessage.create.mockResolvedValue({ _id: messageId, createdAt: messageAt } as never);
    mockedTicket.findOneAndUpdate.mockResolvedValue(null);

    await expect(addCustomerMessage(ticketId, userId, { body: 'Tôi bổ sung thêm thông tin.' }))
      .rejects.toMatchObject({ message: 'Ticket cannot receive messages', statusCode: 409 });

    expect(mockedMessage.deleteOne).toHaveBeenCalledWith({ _id: messageId });
  });

  it('scopes reopen and close transitions to the owning customer', async () => {
    const reopenLean = jest.fn().mockResolvedValue({ _id: ticketId, status: 'in_progress' });
    const closeLean = jest.fn().mockResolvedValue({ _id: ticketId, status: 'closed' });
    mockedTicket.findOneAndUpdate
      .mockReturnValueOnce({ lean: reopenLean } as never)
      .mockReturnValueOnce({ lean: closeLean } as never);

    await expect(reopenCustomerTicket(ticketId, userId)).resolves.toMatchObject({ status: 'in_progress' });
    await expect(closeCustomerTicket(ticketId, userId)).resolves.toMatchObject({ status: 'closed' });

    expect(mockedTicket.findOneAndUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        _id: expect.anything(),
        userId: expect.anything(),
        status: 'resolved',
        reopenDeadline: { $gte: expect.any(Date) },
      }),
      expect.objectContaining({ status: 'in_progress', requiresReply: true }),
      { returnDocument: 'after' },
    );
    expect(mockedTicket.findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        _id: expect.anything(),
        userId: expect.anything(),
        status: { $nin: ['closed', 'spam'] },
      }),
      expect.objectContaining({ status: 'closed', requiresReply: false }),
      { returnDocument: 'after' },
    );
  });

  it('silently accepts honeypot guest feedback without creating a ticket', async () => {
    await expect(createGuestFeedback({
      name: 'Spam Bot', email: 'bot@example.com', type: 'feedback', category: 'other',
      subject: 'Automated message', body: 'This should not become a ticket.', website: 'https://spam.test',
    })).resolves.toEqual({ pendingVerification: true });
    expect(mockedTicket.create).not.toHaveBeenCalled();
  });

  it('limits guest submissions to feedback and suggestions', async () => {
    await expect(createGuestFeedback({
      name: 'Guest User', email: 'guest@example.com', type: 'question' as 'feedback', category: 'other',
      subject: 'Need private support', body: 'Please help me with my account.', website: '',
    })).rejects.toMatchObject({ message: 'Guest submission must be feedback or suggestion' });
  });

  it('removes internal operations and staff identity from customer DTOs', () => {
    expect(toCustomerSupportTicket({
      _id: ticketId,
      ticketCode: 'SUP-1',
      subject: 'Need help',
      priority: 'urgent',
      assignedTo: userId,
      staffLastReadAt: new Date(),
    })).toEqual({ _id: ticketId, ticketCode: 'SUP-1', subject: 'Need help' });

    expect(toCustomerSupportMessage({
      _id: '665000000000000000000003',
      senderType: 'staff',
      senderId: userId,
      body: 'Reply',
      isInternal: false,
      createdAt: '2026-07-14T00:00:00.000Z',
    })).toEqual({
      _id: '665000000000000000000003',
      senderType: 'staff',
      body: 'Reply',
      createdAt: '2026-07-14T00:00:00.000Z',
    });
  });
});
