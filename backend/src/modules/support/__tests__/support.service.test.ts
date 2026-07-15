import { SupportMessage, SupportTicket } from '../../../database/models';
import { addCustomerMessage, createGuestFeedback, createTicket, getCustomerTicket, toCustomerSupportMessage, toCustomerSupportTicket } from '../support.service';

jest.mock('../../../database/models', () => ({
  Coupon: { exists: jest.fn() },
  FaqArticle: {},
  FaqVote: {},
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
