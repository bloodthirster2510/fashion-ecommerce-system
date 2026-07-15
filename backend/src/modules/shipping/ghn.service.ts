import axios from 'axios';
import {
  sanitizeGhnDistrictsResponse,
  sanitizeGhnProvincesResponse,
  sanitizeGhnWardsResponse,
} from './ghn-location-normalizer';

export class GHNServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'GHNServiceError';
    this.statusCode = statusCode;
  }
}

export const GHN_MAX_WEIGHT_GRAMS = 50_000;
export const GHN_MAX_INSURANCE_VALUE = 5_000_000;
export const GHN_MAX_COD_AMOUNT = 50_000_000;

const assertGhnPackageLimits = (data: { weight: number; codAmount?: number }) => {
  if (!Number.isFinite(data.weight) || data.weight <= 0 || data.weight > GHN_MAX_WEIGHT_GRAMS) {
    throw new GHNServiceError(`GHN package weight must be between 1 and ${GHN_MAX_WEIGHT_GRAMS} grams`, 400);
  }

  if (
    data.codAmount !== undefined &&
    (!Number.isFinite(data.codAmount) || data.codAmount < 0 || data.codAmount > GHN_MAX_COD_AMOUNT)
  ) {
    throw new GHNServiceError(`GHN COD amount cannot exceed ${GHN_MAX_COD_AMOUNT} VND`, 400);
  }
};

const normalizeInsuranceValue = (value?: number) => Math.min(
  GHN_MAX_INSURANCE_VALUE,
  Math.max(0, Math.round(value ?? 0)),
);

const getRequiredEnv = (name: string) => {
  const value = process.env[name];

  if (!value) {
    throw new GHNServiceError(`Missing ${name} environment variable`);
  }

  return value;
};

const getRequiredNumberEnv = (name: string) => {
  const value = Number(getRequiredEnv(name));

  if (!Number.isInteger(value) || value <= 0) {
    throw new GHNServiceError(`${name} environment variable is invalid`);
  }

  return value;
};

const DEFAULT_AVAILABLE_SERVICES_CACHE_TTL_MS = 10 * 60 * 1000;
const availableServicesCache = new Map<string, { expiresAt: number; data: unknown }>();

const getAvailableServicesCacheTtlMs = () => {
  const configuredTtlMs = Number(process.env.GHN_AVAILABLE_SERVICES_CACHE_TTL_MS);
  return Number.isInteger(configuredTtlMs) && configuredTtlMs >= 0
    ? configuredTtlMs
    : DEFAULT_AVAILABLE_SERVICES_CACHE_TTL_MS;
};

export const clearGhnServiceCache = () => {
  availableServicesCache.clear();
};

const getGhnClient = (options: { includeShopId?: boolean } = {}) => {
  const headers: Record<string, string> = {
    Token: getRequiredEnv('GHN_TOKEN'),
    'Content-Type': 'application/json',
  };

  if (options.includeShopId) {
    headers.ShopId = getRequiredEnv('GHN_SHOP_ID');
  }

  return axios.create({
    baseURL: getRequiredEnv('GHN_BASE_URL'),
    headers,
  });
};

const handleGhnError = (error: unknown): never => {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data as { message?: string; code_message_value?: string } | undefined;
    const message = responseData?.message || responseData?.code_message_value || error.message;
    throw new GHNServiceError(message, error.response?.status || 502);
  }

  throw error;
};

const getShopDistrictId = () => getRequiredNumberEnv('SHOP_DISTRICT_ID');
const getShopWardCode = () => getRequiredEnv('SHOP_WARD_CODE');

export const GHNService = {
  async getProvinces() {
    try {
      const response = await getGhnClient().get('/master-data/province');
      return sanitizeGhnProvincesResponse(response.data);
    } catch (error) {
      return handleGhnError(error);
    }
  },

  async getDistricts(provinceId: number) {
    try {
      const response = await getGhnClient().post('/master-data/district', {
        province_id: provinceId,
      });

      return sanitizeGhnDistrictsResponse(response.data);
    } catch (error) {
      return handleGhnError(error);
    }
  },

  async getWards(districtId: number) {
    try {
      const response = await getGhnClient().post('/master-data/ward', {
        district_id: districtId,
      });

      return sanitizeGhnWardsResponse(response.data);
    } catch (error) {
      return handleGhnError(error);
    }
  },

  async getAvailableServices(data: {
    fromDistrictId: number;
    toDistrictId: number;
  }) {
    const cacheKey = `${data.fromDistrictId}:${data.toDistrictId}`;
    const cacheTtlMs = getAvailableServicesCacheTtlMs();
    const cached = availableServicesCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    try {
      const response = await getGhnClient({ includeShopId: true }).post('/v2/shipping-order/available-services', {
        shop_id: getRequiredNumberEnv('GHN_SHOP_ID'),
        from_district: data.fromDistrictId,
        to_district: data.toDistrictId,
      });

      if (cacheTtlMs > 0) {
        availableServicesCache.set(cacheKey, {
          expiresAt: Date.now() + cacheTtlMs,
          data: response.data,
        });
      }

      return response.data;
    } catch (error) {
      return handleGhnError(error);
    }
  },

  async calculateShippingFee(data: {
    toDistrictId: number;
    toWardCode: string;
    weight: number;
    length?: number;
    width?: number;
    height?: number;
    insuranceValue?: number;
    serviceId?: number;
    serviceTypeId?: number;
  }) {
    try {
      assertGhnPackageLimits(data);
      const response = await getGhnClient({ includeShopId: true }).post('/v2/shipping-order/fee', {
        from_district_id: getShopDistrictId(),
        from_ward_code: getShopWardCode(),

        to_district_id: data.toDistrictId,
        to_ward_code: data.toWardCode,

        service_id: data.serviceId,
        service_type_id: data.serviceTypeId || 2,

        weight: data.weight,
        length: data.length || 20,
        width: data.width || 20,
        height: data.height || 10,

        insurance_value: normalizeInsuranceValue(data.insuranceValue),
      });

      return response.data;
    } catch (error) {
      return handleGhnError(error);
    }
  },

  async createShippingOrder(data: {
    clientOrderCode: string;
    toName: string;
    toPhone: string;
    toAddress: string;
    toWardCode: string;
    toDistrictId: number;
    codAmount: number;
    content: string;
    weight: number;
    length?: number;
    width?: number;
    height?: number;
    insuranceValue?: number;
    serviceId?: number;
    serviceTypeId?: number;
    items: {
      name: string;
      quantity: number;
      price: number;
    }[];
  }) {
    try {
      assertGhnPackageLimits(data);
      const response = await getGhnClient({ includeShopId: true }).post('/v2/shipping-order/create', {
        // The storefront already includes shipping in the customer-facing order total.
        payment_type_id: 1,
        required_note: 'CHOXEMHANGKHONGTHU',
        note: 'Cho khách xem hàng, không cho thử',

        client_order_code: data.clientOrderCode,

        from_name: getRequiredEnv('SHOP_NAME'),
        from_phone: getRequiredEnv('SHOP_PHONE'),
        from_address: getRequiredEnv('SHOP_ADDRESS'),
        from_ward_code: getShopWardCode(),
        from_district_id: getShopDistrictId(),

        to_name: data.toName,
        to_phone: data.toPhone,
        to_address: data.toAddress,
        to_ward_code: data.toWardCode,
        to_district_id: data.toDistrictId,

        cod_amount: data.codAmount,
        content: data.content,

        weight: data.weight,
        length: data.length || 20,
        width: data.width || 20,
        height: data.height || 10,

        insurance_value: normalizeInsuranceValue(data.insuranceValue),
        ...(data.serviceId
          ? { service_id: data.serviceId }
          : { service_type_id: data.serviceTypeId || 2 }),

        items: data.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
      });

      return response.data;
    } catch (error) {
      return handleGhnError(error);
    }
  },

  async getOrderDetail(orderCode: string) {
    try {
      const response = await getGhnClient({ includeShopId: true }).post('/v2/shipping-order/detail', {
        order_code: orderCode,
      });

      return response.data;
    } catch (error) {
      return handleGhnError(error);
    }
  },

  async cancelOrder(orderCodes: string[]) {
    try {
      const response = await getGhnClient({ includeShopId: true }).post('/v2/switch-status/cancel', {
        order_codes: orderCodes,
      });

      return response.data;
    } catch (error) {
      return handleGhnError(error);
    }
  },
};
