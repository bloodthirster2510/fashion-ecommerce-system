import { createHash } from 'crypto';
import { GHNService, GHNServiceError } from './ghn.service';
import type {
  ShippingAddressForQuote,
  ShippingComparisonResult,
  ShippingOptionQuote,
  ShippingQuoteItemInput,
  ShippingQuoteResult,
} from './shipping.types';
import { resolveManagedGhnArea, type ResolvedGhnArea } from './ghn-area-resolver';

export const DEFAULT_SHIPPING_FEE = 25000;

const DEFAULT_ITEM_WEIGHT_GRAMS = 500;
const DEFAULT_LENGTH_CM = 20;
const DEFAULT_WIDTH_CM = 20;
const DEFAULT_HEIGHT_CM = 10;
const DEFAULT_SERVICE_TYPE_ID = 2;

type GhnAvailableService = {
  serviceId: number;
  serviceTypeId: number | null;
  serviceName: string | null;
};

type GhnQuoteAttempt = {
  option: ShippingOptionQuote | null;
  validationError: GHNServiceError | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const trimOptional = (value: unknown) => (
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
);

const readNumberField = (source: Record<string, unknown> | null, keys: string[]) => {
  if (!source) {
    return null;
  }

  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsedValue = Number(value);
      if (Number.isFinite(parsedValue)) {
        return parsedValue;
      }
    }
  }

  return null;
};

const getQuoteFee = (rawQuote: unknown) => {
  const quote = isRecord(rawQuote) ? rawQuote : null;
  const quoteData = quote && isRecord(quote.data) ? quote.data : null;

  return readNumberField(quoteData, ['total', 'service_fee', 'fee'])
    ?? readNumberField(quote, ['total', 'service_fee', 'fee']);
};

const normalizeRawQuote = (rawQuote: unknown): Record<string, unknown> | null => {
  if (isRecord(rawQuote)) {
    return rawQuote;
  }

  if (rawQuote == null) {
    return null;
  }

  return { value: rawQuote };
};

const getFixedOptionKey = () => 'FIXED:STANDARD';

const buildFallbackOption = (reason: string, note: string | null): ShippingOptionQuote => ({
  key: getFixedOptionKey(),
  provider: 'FIXED',
  serviceId: null,
  serviceTypeId: null,
  serviceName: 'Tạm tính',
  providerCost: DEFAULT_SHIPPING_FEE,
  customerFee: DEFAULT_SHIPPING_FEE,
  estimatedDeliveryDate: null,
  availability: 'fallback',
  isRecommended: false,
  reason: note ? `${reason}:${note}` : reason,
  rawQuote: null,
});

const toShippingQuote = (option: ShippingOptionQuote): ShippingQuoteResult => ({
  provider: option.provider,
  serviceId: option.serviceId,
  serviceTypeId: option.serviceTypeId,
  fee: option.customerFee,
  status: option.availability === 'available' ? 'quoted' : 'fallback',
  estimatedDeliveryDate: option.estimatedDeliveryDate,
  rawQuote: option.rawQuote,
});

const toPositiveIntegerOrNull = (value: unknown) => {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
};

const getPackageMetrics = (items: ShippingQuoteItemInput[]) => (
  items.reduce(
    (metrics, item) => {
      const quantity = Math.max(1, item.quantity);
      const itemWeight = Math.max(1, item.weight ?? DEFAULT_ITEM_WEIGHT_GRAMS);

      return {
        weight: metrics.weight + itemWeight * quantity,
        insuranceValue: metrics.insuranceValue + Math.max(0, item.price) * quantity,
        length: Math.max(metrics.length, item.length ?? DEFAULT_LENGTH_CM),
        width: Math.max(metrics.width, item.width ?? DEFAULT_WIDTH_CM),
        height: Math.max(metrics.height, item.height ?? DEFAULT_HEIGHT_CM),
      };
    },
    {
      weight: 0,
      insuranceValue: 0,
      length: DEFAULT_LENGTH_CM,
      width: DEFAULT_WIDTH_CM,
      height: DEFAULT_HEIGHT_CM,
    },
  )
);

const shouldFallbackToFixedFee = (error: unknown) => {
  if (!(error instanceof GHNServiceError)) {
    return false;
  }

  return error.statusCode >= 500 || error.message.includes('environment variable');
};

const getShopDistrictId = () => toPositiveIntegerOrNull(process.env.SHOP_DISTRICT_ID);

const buildQuoteVersion = (input: {
  shippingAddress?: ShippingAddressForQuote;
  items: ShippingQuoteItemInput[];
  comparisonStatus: ShippingComparisonResult['comparisonStatus'];
  pricingMode: ShippingComparisonResult['pricingMode'];
  recommendedOptionKey: string | null;
  options: ShippingOptionQuote[];
}) => {
  const normalizedItems = input.items.map((item) => ({
    name: item.name,
    quantity: Math.max(1, item.quantity),
    price: Math.max(0, Math.round(item.price)),
    weight: Math.max(1, item.weight ?? DEFAULT_ITEM_WEIGHT_GRAMS),
    length: Math.max(1, item.length ?? DEFAULT_LENGTH_CM),
    width: Math.max(1, item.width ?? DEFAULT_WIDTH_CM),
    height: Math.max(1, item.height ?? DEFAULT_HEIGHT_CM),
  }));
  const normalizedAddress = input.shippingAddress
    ? {
        provinceCode: trimOptional(input.shippingAddress.provinceCode) ?? null,
        provinceId: toPositiveIntegerOrNull(input.shippingAddress.provinceId),
        districtId: toPositiveIntegerOrNull(input.shippingAddress.districtId),
        wardCode: trimOptional(input.shippingAddress.wardCode) ?? null,
        ghnProvinceId: toPositiveIntegerOrNull(input.shippingAddress.ghnProvinceId),
        ghnDistrictId: toPositiveIntegerOrNull(input.shippingAddress.ghnDistrictId),
        ghnWardCode: trimOptional(input.shippingAddress.ghnWardCode) ?? null,
        streetName: trimOptional(input.shippingAddress.streetName) ?? null,
      }
    : null;
  const normalizedOptions = input.options.map((option) => ({
    key: option.key,
    provider: option.provider,
    serviceId: option.serviceId,
    serviceTypeId: option.serviceTypeId,
    providerCost: option.providerCost,
    customerFee: option.customerFee,
    availability: option.availability,
  }));
  const hashInput = JSON.stringify({
    shippingAddress: normalizedAddress,
    items: normalizedItems,
    comparisonStatus: input.comparisonStatus,
    pricingMode: input.pricingMode,
    recommendedOptionKey: input.recommendedOptionKey,
    options: normalizedOptions,
  });

  return `shipq_${createHash('sha256').update(hashInput).digest('hex').slice(0, 16)}`;
};

const parseAvailableServices = (rawServices: unknown): GhnAvailableService[] => {
  const source = isRecord(rawServices) && Array.isArray(rawServices.data)
    ? rawServices.data
    : Array.isArray(rawServices)
      ? rawServices
      : [];

  const services = source
    .map((item) => {
      const service = isRecord(item) ? item : null;
      const serviceId = readNumberField(service, ['service_id', 'serviceId', 'ServiceID']);
      if (!serviceId) {
        return null;
      }

      return {
        serviceId: Math.round(serviceId),
        serviceTypeId: readNumberField(service, ['service_type_id', 'serviceTypeId', 'ServiceTypeId']),
        serviceName: trimOptional(
          service?.short_name
          ?? service?.shortName
          ?? service?.service_name
          ?? service?.serviceName
          ?? service?.name,
        ),
      };
    })
    .filter((service): service is GhnAvailableService => Boolean(service));

  const uniqueServices = new Map<number, GhnAvailableService>();
  services.forEach((service) => {
    if (!uniqueServices.has(service.serviceId)) {
      uniqueServices.set(service.serviceId, service);
    }
  });

  return Array.from(uniqueServices.values());
};

const quoteGhnOptions = async (input: {
  shippingAddress?: ShippingAddressForQuote;
  items: ShippingQuoteItemInput[];
}): Promise<{ options: ShippingOptionQuote[]; hadUnavailable: boolean; resolvedArea: ResolvedGhnArea }> => {
  const ghnArea = await resolveManagedGhnArea(input.shippingAddress);
  const toDistrictId = ghnArea.districtId;
  const toWardCode = ghnArea.wardCode;
  const hasVerifiedMapping =
    ghnArea.status === 'mapped'
    && Boolean(ghnArea.verifiedAt)
    && Boolean(ghnArea.confidence);

  if (!toDistrictId || !toWardCode || !hasVerifiedMapping) {
    return { options: [], hadUnavailable: false, resolvedArea: ghnArea };
  }

  const hasValidCodes = toDistrictId > 0 && toWardCode.length > 0 && !toWardCode.includes('không áp dụng');
  if (!hasValidCodes) {
    return { options: [], hadUnavailable: false, resolvedArea: ghnArea };
  }

  const fromDistrictId = getShopDistrictId();
  if (!fromDistrictId) {
    return { options: [], hadUnavailable: false, resolvedArea: ghnArea };
  }

  const metrics = getPackageMetrics(input.items);

  try {
    const rawServices = await GHNService.getAvailableServices({ fromDistrictId, toDistrictId });
    const availableServices = parseAvailableServices(rawServices);
    const serviceCandidates = availableServices.length
      ? availableServices
      : [{
          serviceId: 0,
          serviceTypeId: DEFAULT_SERVICE_TYPE_ID,
          serviceName: 'GHN',
        }];

    const quoteAttempts: GhnQuoteAttempt[] = await Promise.all(
      serviceCandidates.map(async (service) => {
        try {
          const rawQuote = await GHNService.calculateShippingFee({
            toDistrictId,
            toWardCode,
            weight: Math.max(metrics.weight, DEFAULT_ITEM_WEIGHT_GRAMS),
            length: metrics.length,
            width: metrics.width,
            height: metrics.height,
            insuranceValue: Math.round(metrics.insuranceValue),
            serviceId: service.serviceId > 0 ? service.serviceId : undefined,
            serviceTypeId: service.serviceTypeId ?? DEFAULT_SERVICE_TYPE_ID,
          });
          const fee = getQuoteFee(rawQuote);
          const normalizedFee = fee == null ? DEFAULT_SHIPPING_FEE : Math.max(0, Math.round(fee));

          return {
            option: {
              key: `GHN:${service.serviceId > 0 ? service.serviceId : 'DEFAULT'}:${service.serviceTypeId ?? DEFAULT_SERVICE_TYPE_ID}`,
              provider: 'GHN' as const,
              serviceId: service.serviceId > 0 ? service.serviceId : null,
              serviceTypeId: service.serviceTypeId ?? DEFAULT_SERVICE_TYPE_ID,
              serviceName: service.serviceName,
              providerCost: normalizedFee,
              customerFee: normalizedFee,
              estimatedDeliveryDate: null,
              availability: 'available' as const,
              isRecommended: false,
              reason: fee == null ? 'ghn_fee_missing' : 'ghn_live_quote',
              rawQuote: normalizeRawQuote(rawQuote),
            },
            validationError: null,
          };
        } catch (error) {
          if (shouldFallbackToFixedFee(error)) {
            return {
              option: {
                key: `GHN:${service.serviceId > 0 ? service.serviceId : 'DEFAULT'}:${service.serviceTypeId ?? DEFAULT_SERVICE_TYPE_ID}`,
                provider: 'GHN' as const,
                serviceId: service.serviceId > 0 ? service.serviceId : null,
                serviceTypeId: service.serviceTypeId ?? DEFAULT_SERVICE_TYPE_ID,
                serviceName: service.serviceName,
                providerCost: DEFAULT_SHIPPING_FEE,
                customerFee: DEFAULT_SHIPPING_FEE,
                estimatedDeliveryDate: null,
                availability: 'unavailable' as const,
                isRecommended: false,
                reason: error instanceof Error ? error.message : 'ghn_unavailable',
                rawQuote: null,
              },
              validationError: null,
            };
          }

          if (error instanceof GHNServiceError && error.statusCode >= 400 && error.statusCode < 500) {
            return { option: null, validationError: error };
          }

          throw error;
        }
      }),
    );

    const settledQuotes = quoteAttempts
      .map((attempt) => attempt.option)
      .filter((option): option is ShippingOptionQuote => Boolean(option));
    const validationErrors = quoteAttempts
      .map((attempt) => attempt.validationError)
      .filter((error): error is GHNServiceError => Boolean(error));
    const availableOptions = settledQuotes
      .filter((option) => option.availability === 'available')
      .sort((left, right) => left.providerCost - right.providerCost);
    if (!availableOptions.length && validationErrors.length) {
      throw validationErrors[0];
    }
    const hadUnavailable = validationErrors.length > 0
      || settledQuotes.some((option) => option.availability === 'unavailable');

    return { options: availableOptions, hadUnavailable, resolvedArea: ghnArea };
  } catch (error) {
    if (shouldFallbackToFixedFee(error)) {
      return { options: [], hadUnavailable: true, resolvedArea: ghnArea };
    }

    throw error;
  }
};

const compareCheckout = async (input: {
  shippingAddress?: ShippingAddressForQuote;
  items: ShippingQuoteItemInput[];
}): Promise<ShippingComparisonResult> => {
  const { options: ghnOptions, hadUnavailable, resolvedArea } = await quoteGhnOptions(input);
  const fallbackOption = buildFallbackOption(
    'fixed_fallback',
    ghnOptions.length
      ? 'shop_safe_backup'
      : 'khu_vuc_chua_co_mapping_hoac_provider_chua_san_sang',
  );
  const sortedLiveOptions = [...ghnOptions].sort((left, right) => left.customerFee - right.customerFee);
  const recommendedLiveOption = sortedLiveOptions[0] ?? null;
  const recommendedOption = recommendedLiveOption ?? fallbackOption;
  const allOptions = [...sortedLiveOptions, fallbackOption].map((option) => ({
    ...option,
    isRecommended: option.key === recommendedOption.key,
  }));
  const comparisonStatus = !recommendedLiveOption
    ? 'fallback'
    : hadUnavailable
      ? 'partial'
      : 'live';
  const pricingMode = recommendedLiveOption ? 'CHEAPEST' : 'FIXED_FALLBACK';
  const quoteVersion = buildQuoteVersion({
    shippingAddress: input.shippingAddress,
    items: input.items,
    comparisonStatus,
    pricingMode,
    recommendedOptionKey: recommendedOption.key,
    options: allOptions,
  });

  return {
    comparisonStatus,
    pricingMode,
    customerFee: recommendedOption.customerFee,
    recommendedOptionKey: recommendedOption.key,
    selectedOptionKey: recommendedOption.key,
    quoteVersion,
    note: comparisonStatus === 'fallback'
      ? 'Khu vực này chưa có mapping vận chuyển, hệ thống đang dùng phí tạm tính.'
      : null,
    options: allOptions,
    shippingQuote: toShippingQuote(recommendedOption),
    resolvedArea: {
      provinceId: resolvedArea.provinceId,
      districtId: resolvedArea.districtId,
      wardCode: resolvedArea.wardCode,
      status: resolvedArea.status,
      confidence: resolvedArea.confidence,
      verifiedAt: resolvedArea.verifiedAt,
      source: resolvedArea.source,
    },
  };
};

const quoteCheckout = async (input: {
  shippingAddress?: ShippingAddressForQuote;
  items: ShippingQuoteItemInput[];
}): Promise<ShippingQuoteResult> => {
  const comparison = await compareCheckout(input);
  return comparison.shippingQuote;
};

export const shippingQuoteService = {
  compareCheckout,
  quoteCheckout,
};
