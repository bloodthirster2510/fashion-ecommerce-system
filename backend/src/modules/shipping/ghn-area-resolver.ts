import type { ShippingAddressForQuote } from './shipping.types';
import { shippingAreaMappingService } from './shipping-area-mapping.service';

export type ResolvedGhnArea = {
  provider: 'GHN';
  provinceId: number | null;
  districtId: number | null;
  wardCode: string | null;
  status: 'mapped' | 'missing' | 'manual';
};

export const resolveGhnArea = (address?: ShippingAddressForQuote | null): ResolvedGhnArea => {
  if (!address) {
    return {
      provider: 'GHN',
      provinceId: null,
      districtId: null,
      wardCode: null,
      status: 'missing',
    };
  }

  const resolvedGhnFields = shippingAreaMappingService.resolveStoredGhnFields(address);

  return {
    provider: 'GHN',
    provinceId: resolvedGhnFields.ghnProvinceId,
    districtId: resolvedGhnFields.ghnDistrictId,
    wardCode: resolvedGhnFields.ghnWardCode,
    status: resolvedGhnFields.ghnMappingStatus,
  };
};
