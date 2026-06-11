import { shippingAreaMappingService } from '../modules/shipping/shipping-area-mapping.service';

export type GhnMappingStatus = 'mapped' | 'missing' | 'manual';

export type UserAddressInput = {
  customerName: string;
  province: string;
  provinceCode?: string | number | null;
  provinceId?: number | null;
  district?: string | null;
  districtId?: number | null;
  ward: string;
  wardCode: string | number;
  streetName: string;
  phoneNumber: string;
  isDefault?: boolean;
  ghnProvinceId?: number | null;
  ghnDistrictId?: number | null;
  ghnWardCode?: string | null;
  ghnMappingStatus?: GhnMappingStatus;
};

const trimRequired = (value: string | number) => String(value).trim();
const trimOptional = (value: unknown) => (
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
);

const toPositiveIntegerOrNull = (value: unknown) => {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
};

export const normalizeUserAddressInput = (address: UserAddressInput) => {
  const provinceId = toPositiveIntegerOrNull(address.provinceId);
  const districtId = toPositiveIntegerOrNull(address.districtId);
  const resolvedGhnFields = shippingAreaMappingService.resolveStoredGhnFields(address);

  return {
    customerName: trimRequired(address.customerName),
    province: trimRequired(address.province),
    provinceCode: trimOptional(address.provinceCode) ?? (provinceId ? String(provinceId) : null),
    provinceId,
    district: trimOptional(address.district),
    districtId,
    ward: trimRequired(address.ward),
    wardCode: trimRequired(address.wardCode),
    streetName: trimRequired(address.streetName),
    phoneNumber: trimRequired(address.phoneNumber),
    ghnProvinceId: resolvedGhnFields.ghnProvinceId,
    ghnDistrictId: resolvedGhnFields.ghnDistrictId,
    ghnWardCode: resolvedGhnFields.ghnWardCode,
    ghnMappingStatus: resolvedGhnFields.ghnMappingStatus,
    isDefault: Boolean(address.isDefault),
  };
};
