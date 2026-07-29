import { GHNService, GHNServiceError } from '../ghn.service';
import { shippingQuoteService } from '../shipping-quote.service';

jest.mock('../shipping-area-mapping.service', () => {
  const actual = jest.requireActual('../shipping-area-mapping.service');
  const service = actual.shippingAreaMappingService;
  return {
    ...actual,
    shippingAreaMappingService: {
      ...service,
      resolveStoredGhnFieldsWithManagedMapping: jest.fn(async (address) =>
        service.resolveStoredGhnFields(address)),
    },
  };
});

jest.mock('../ghn.service', () => {
  const actual = jest.requireActual('../ghn.service');
  return {
    ...actual,
    GHNService: {
      ...actual.GHNService,
      getAvailableServices: jest.fn(),
      calculateShippingFee: jest.fn(),
    },
  };
});

const mockedGetAvailableServices = GHNService.getAvailableServices as jest.MockedFunction<
  typeof GHNService.getAvailableServices
>;
const mockedCalculateShippingFee = GHNService.calculateShippingFee as jest.MockedFunction<
  typeof GHNService.calculateShippingFee
>;

const input = {
  shippingAddress: {
    province: 'Thanh pho Ha Noi',
    district: 'Quan Ba Dinh',
    ward: 'Phuong Ngoc Ha',
    wardCode: '00004',
    ghnDistrictId: 1484,
    ghnWardCode: '1A0107',
    ghnMappingStatus: 'mapped' as const,
    ghnMappingConfidence: 'exact' as const,
    ghnMappingVerifiedAt: '2026-07-29T00:00:00.000Z',
  },
  items: [{ name: 'Sandbox item', quantity: 1, price: 220_000 }],
};

describe('shippingQuoteService GHN candidate validation', () => {
  const previousShopDistrictId = process.env.SHOP_DISTRICT_ID;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SHOP_DISTRICT_ID = '1572';
    mockedGetAvailableServices.mockResolvedValue({
      data: [
        { service_id: 53321, service_type_id: 2, short_name: 'Standard' },
        { service_id: 100039, service_type_id: 5, short_name: 'Restricted' },
      ],
    });
  });

  afterAll(() => {
    if (previousShopDistrictId === undefined) delete process.env.SHOP_DISTRICT_ID;
    else process.env.SHOP_DISTRICT_ID = previousShopDistrictId;
  });

  it('keeps a live GHN quote when another service candidate rejects the package', async () => {
    mockedCalculateShippingFee.mockImplementation(async ({ serviceId }) => {
      if (serviceId === 100039) {
        throw new GHNServiceError('Cân nặng không hợp lệ', 400);
      }
      return { data: { total: 31_000 } };
    });

    const result = await shippingQuoteService.compareCheckout(input);

    expect(result).toMatchObject({
      comparisonStatus: 'partial',
      pricingMode: 'CHEAPEST',
      customerFee: 31_000,
      recommendedOptionKey: 'GHN:53321:2',
    });
    expect(result.options).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'GHN:53321:2', availability: 'available' }),
      expect.objectContaining({ key: 'FIXED:STANDARD', availability: 'fallback' }),
    ]));
  });

  it('preserves a 4xx error when every GHN candidate rejects the package', async () => {
    mockedCalculateShippingFee.mockRejectedValue(
      new GHNServiceError('Cân nặng không hợp lệ', 400),
    );

    await expect(shippingQuoteService.compareCheckout(input)).rejects.toMatchObject({
      message: 'Cân nặng không hợp lệ',
      statusCode: 400,
    });
  });

  it('uses fixed fallback without calling GHN for an unverified province and ward', async () => {
    const result = await shippingQuoteService.compareCheckout({
      shippingAddress: {
        province: 'Tỉnh Đồng Nai',
        provinceCode: '75',
        ward: 'Phường Trấn Biên',
        wardCode: '26368',
        ghnMappingStatus: 'missing',
      },
      items: input.items,
    });

    expect(result).toMatchObject({
      comparisonStatus: 'fallback',
      pricingMode: 'FIXED_FALLBACK',
      customerFee: 25_000,
      resolvedArea: {
        status: 'missing',
        source: 'missing',
      },
    });
    expect(mockedGetAvailableServices).not.toHaveBeenCalled();
    expect(mockedCalculateShippingFee).not.toHaveBeenCalled();
  });
});
