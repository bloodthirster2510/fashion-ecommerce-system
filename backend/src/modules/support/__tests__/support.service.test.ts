import { SupportMessage, SupportTicket } from '../../../database/models';
import { addCustomerMessage, createTicket, getCustomerTicket } from '../support.service';

jest.mock('../../../database/models', () => ({
  Coupon: { exists: jest.fn() },
  FaqArticle: {},
  FaqVote: {},
  FAQ_CATEGORIES: ['orders', 'shipping', 'returns', 'payments', 'promotions', 'loyalty', 'account', 'other'],
  Order: { exists: jest.fn() },
  SupportMessage: { find: jest.fn(), create: jest.fn() },
  SupportTicket: { findOne: jest.fn(), create: jest.fn(), deleteOne: jest.fn() },
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
    mockedTicket.findOne.mockReturnValue({ lean: ticketLean } as never);
    const messageLean = jest.fn().mockResolvedValue([]);
    const sort = jest.fn().mockReturnValue({ lean: messageLean });
    mockedMessage.find.mockReturnValue({ sort } as never);

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
});
