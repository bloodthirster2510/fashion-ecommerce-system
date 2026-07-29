export type ShippingQuoteProvider = 'GHN' | 'FIXED' | 'GHTK';
export type ShippingQuoteStatus = 'quoted' | 'fallback';
export type ShippingComparisonStatus = 'live' | 'partial' | 'fallback';
export type ShippingPricingMode = 'CHEAPEST' | 'RECOMMENDED' | 'FIXED_FALLBACK';
export type ShippingOptionAvailability = 'available' | 'fallback' | 'unavailable';

export interface ShippingAddressForQuote {
  province: string;
  provinceCode?: string | null;
  provinceId?: number | null;
  district?: string | null;
  districtId?: number | null;
  ward: string;
  wardCode: string;
  streetName?: string;
  ghnProvinceId?: number | null;
  ghnDistrictId?: number | null;
  ghnWardCode?: string | null;
  ghnMappingStatus?: 'mapped' | 'missing' | 'manual';
  ghnMappingConfidence?: 'exact' | 'manual' | 'legacy' | null;
  ghnMappingVerifiedAt?: Date | string | null;
}

export interface ShippingQuoteItemInput {
  name: string;
  quantity: number;
  price: number;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
}

export interface ShippingQuoteResult {
  provider: ShippingQuoteProvider;
  serviceId: number | null;
  serviceTypeId: number | null;
  fee: number;
  status: ShippingQuoteStatus;
  estimatedDeliveryDate: Date | null;
  rawQuote: Record<string, unknown> | null;
}

export interface ShippingOptionQuote {
  key: string;
  provider: ShippingQuoteProvider;
  serviceId: number | null;
  serviceTypeId: number | null;
  serviceName: string | null;
  providerCost: number;
  customerFee: number;
  estimatedDeliveryDate: Date | null;
  availability: ShippingOptionAvailability;
  isRecommended: boolean;
  reason: string | null;
  rawQuote: Record<string, unknown> | null;
}

export interface ShippingComparisonResult {
  comparisonStatus: ShippingComparisonStatus;
  pricingMode: ShippingPricingMode;
  customerFee: number;
  recommendedOptionKey: string | null;
  selectedOptionKey: string | null;
  quoteVersion: string;
  note: string | null;
  options: ShippingOptionQuote[];
  shippingQuote: ShippingQuoteResult;
  resolvedArea?: {
    provinceId: number | null;
    districtId: number | null;
    wardCode: string | null;
    status: 'mapped' | 'missing' | 'manual';
    confidence: 'exact' | 'manual' | 'legacy' | null;
    verifiedAt: Date | null;
    source: 'explicit' | 'legacy' | 'mapping' | 'managed' | 'missing';
  };
}
