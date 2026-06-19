import { Types } from 'mongoose';
import { Coupon, PromotionCampaign } from '../../../../database/models';
import { promotionCampaignService } from '../promotion-campaign.service';

jest.mock('../../../../database/models', () => ({
  Coupon: { countDocuments: jest.fn() },
  PromotionCampaign: {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
  },
}));

const mockedCoupon = Coupon as jest.Mocked<typeof Coupon>;
const mockedCampaign = PromotionCampaign as jest.Mocked<typeof PromotionCampaign>;

describe('promotionCampaignService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a stacking campaign only with existing coupons', async () => {
    const couponIds = [new Types.ObjectId(), new Types.ObjectId()];
    mockedCoupon.countDocuments.mockResolvedValue(2);
    mockedCampaign.create.mockResolvedValue({ _id: new Types.ObjectId() } as never);

    await promotionCampaignService.createCampaign({
      code: 'STACK',
      name: 'Stack campaign',
      couponIds: couponIds.map(String),
      allowCouponStacking: true,
      maxCouponsPerOrder: 2,
      startAt: '2026-01-01T00:00:00Z',
      endAt: '2027-01-01T00:00:00Z',
      isActive: true,
    });

    expect(mockedCampaign.create).toHaveBeenCalledWith(expect.objectContaining({
      code: 'STACK',
      allowCouponStacking: true,
      maxCouponsPerOrder: 2,
    }));
  });
});
