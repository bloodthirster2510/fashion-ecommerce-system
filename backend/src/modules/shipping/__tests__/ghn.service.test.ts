import axios from 'axios';
import { clearGhnServiceCache, GHNService } from '../ghn.service';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    isAxiosError: jest.fn(),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GHNService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    clearGhnServiceCache();
    process.env.GHN_BASE_URL = 'https://dev-online-gateway.ghn.vn/shiip/public-api';
    process.env.GHN_TOKEN = 'ghn-token';
    process.env.GHN_SHOP_ID = '12345';
    delete process.env.GHN_AVAILABLE_SERVICES_CACHE_TTL_MS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('caches available services by district pair within the configured TTL', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        data: [{ service_id: 53320, service_type_id: 2 }],
      },
    });
    mockedAxios.create.mockReturnValue({ post } as never);

    const first = await GHNService.getAvailableServices({
      fromDistrictId: 1574,
      toDistrictId: 1442,
    });
    const second = await GHNService.getAvailableServices({
      fromDistrictId: 1574,
      toDistrictId: 1442,
    });

    expect(first).toBe(second);
    expect(mockedAxios.create).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/v2/shipping-order/available-services', {
      shop_id: 12345,
      from_district: 1574,
      to_district: 1442,
    });
  });

  it('skips available services cache when TTL is set to zero', async () => {
    process.env.GHN_AVAILABLE_SERVICES_CACHE_TTL_MS = '0';
    const post = jest
      .fn()
      .mockResolvedValueOnce({ data: { data: [{ service_id: 1 }] } })
      .mockResolvedValueOnce({ data: { data: [{ service_id: 2 }] } });
    mockedAxios.create.mockReturnValue({ post } as never);

    const first = await GHNService.getAvailableServices({
      fromDistrictId: 1574,
      toDistrictId: 1442,
    });
    const second = await GHNService.getAvailableServices({
      fromDistrictId: 1574,
      toDistrictId: 1442,
    });

    expect(first).not.toBe(second);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('charges the shop for shipping because customer totals already include the shipping fee', async () => {
    process.env.SHOP_NAME = 'Fashion Shop';
    process.env.SHOP_PHONE = '0900000000';
    process.env.SHOP_ADDRESS = '123 Shop Street';
    process.env.SHOP_DISTRICT_ID = '1574';
    process.env.SHOP_WARD_CODE = '550101';
    const post = jest.fn().mockResolvedValue({ data: { data: { order_code: 'GHD123' } } });
    mockedAxios.create.mockReturnValue({ post } as never);

    await GHNService.createShippingOrder({
      clientOrderCode: 'FS123',
      toName: 'Customer',
      toPhone: '0911111111',
      toAddress: '456 Customer Street',
      toWardCode: '20101',
      toDistrictId: 1442,
      codAmount: 120000,
      content: 'Basic Tee',
      weight: 500,
      insuranceValue: 9000000,
      serviceId: 53320,
      items: [{ name: 'Basic Tee', quantity: 1, price: 99000 }],
    });

    expect(post).toHaveBeenCalledWith(
      '/v2/shipping-order/create',
      expect.objectContaining({
        payment_type_id: 1,
        cod_amount: 120000,
        insurance_value: 5000000,
      }),
    );
  });

  it('rejects packages that exceed GHN weight or COD limits before calling the gateway', async () => {
    const post = jest.fn();
    mockedAxios.create.mockReturnValue({ post } as never);
    const baseInput = {
      clientOrderCode: 'FS123',
      toName: 'Customer',
      toPhone: '0911111111',
      toAddress: '456 Customer Street',
      toWardCode: '20101',
      toDistrictId: 1442,
      codAmount: 120000,
      content: 'Basic Tee',
      weight: 500,
      items: [{ name: 'Basic Tee', quantity: 1, price: 99000 }],
    };

    await expect(GHNService.createShippingOrder({
      ...baseInput,
      weight: 50001,
    })).rejects.toMatchObject({ statusCode: 400 });
    await expect(GHNService.createShippingOrder({
      ...baseInput,
      codAmount: 50000001,
    })).rejects.toMatchObject({ statusCode: 400 });
    expect(post).not.toHaveBeenCalled();
  });
});

