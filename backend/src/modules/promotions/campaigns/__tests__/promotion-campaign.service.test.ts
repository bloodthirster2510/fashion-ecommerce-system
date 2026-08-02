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

  it('rejects a null campaign payload with a validation error', async () => {
    await expect(promotionCampaignService.createCampaign(null as never)).rejects.toMatchObject({
      message: 'Campaign payload must be an object',
      statusCode: 400,
    });
    expect(mockedCampaign.create).not.toHaveBeenCalled();
  });

  it('maps duplicate campaign codes during update to a conflict', async () => {
    const campaignId = new Types.ObjectId();
    mockedCampaign.findById.mockResolvedValue({
      _id: campaignId,
      startAt: new Date('2026-01-01T00:00:00Z'),
      endAt: new Date('2027-01-01T00:00:00Z'),
      allowCouponStacking: false,
      maxCouponsPerOrder: 1,
    } as never);
    mockedCampaign.findByIdAndUpdate.mockRejectedValue({ code: 11000 });

    await expect(promotionCampaignService.updateCampaign(
      campaignId.toString(),
      { code: 'EXISTING' },
    )).rejects.toMatchObject({ message: 'Campaign code already exists', statusCode: 409 });
  });

  it('reports a concurrent campaign deletion instead of returning null', async () => {
    const campaignId = new Types.ObjectId();
    mockedCampaign.findById.mockResolvedValue({
      _id: campaignId,
      startAt: new Date('2026-01-01T00:00:00Z'),
      endAt: new Date('2027-01-01T00:00:00Z'),
      allowCouponStacking: false,
      maxCouponsPerOrder: 1,
    } as never);
    mockedCampaign.findByIdAndUpdate.mockResolvedValue(null);

    await expect(promotionCampaignService.updateCampaign(
      campaignId.toString(),
      { name: 'Updated campaign' },
    )).rejects.toMatchObject({ message: 'Campaign not found', statusCode: 404 });
  });
});
