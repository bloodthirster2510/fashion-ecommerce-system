import { Cart, Order } from '../../../database/models';
import { supportService } from '../../support/support.service';
import { getCustomerNotificationSummary } from '../customer-notification-summary.service';

jest.mock('../../../database/models', () => ({
  Cart: { aggregate: jest.fn() },
  Order: { countDocuments: jest.fn() },
}));

jest.mock('../../support/support.service', () => ({
  supportService: { getCustomerSupportSummary: jest.fn() },
}));

const mockedCart = Cart as jest.Mocked<typeof Cart>;
const mockedOrder = Order as jest.Mocked<typeof Order>;
const mockedSupportService = supportService as jest.Mocked<typeof supportService>;

describe('customer notification summary service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('combines cart quantity, actionable orders and unique support work', async () => {
    mockedCart.aggregate.mockResolvedValue([{ itemCount: 5 }] as never);
    mockedOrder.countDocuments.mockResolvedValue(2);
    mockedSupportService.getCustomerSupportSummary.mockResolvedValue({
      unreadReplies: 1,
      waitingCustomer: 1,
      total: 1,
    });

    const result = await getCustomerNotificationSummary('665000000000000000000001');

    expect(result).toMatchObject({
      total: 3,
      cartItems: 5,
      ordersNeedAction: 2,
      support: { unreadReplies: 1, waitingCustomer: 1, total: 1 },
    });
    expect(mockedOrder.countDocuments).toHaveBeenCalledWith(expect.objectContaining({
      user_id: expect.anything(),
      $or: expect.arrayContaining([
        expect.objectContaining({ status: 'delivered' }),
      ]),
    }));
  });

  it('rejects an invalid user id before querying data', async () => {
    await expect(getCustomerNotificationSummary('invalid')).rejects.toMatchObject({ statusCode: 400 });
    expect(mockedCart.aggregate).not.toHaveBeenCalled();
  });
});
