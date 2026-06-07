export type ProvinceApiItem = {
  name: string;
  code: string;
  type?: 'province' | 'municipality';
  wardCount?: number;
};

export type WardApiItem = {
  name: string;
  code: string;
  type?: 'ward' | 'commune' | 'special_zone';
  provinceCode?: string;
};

export type WardsApiResponse = {
  province: ProvinceApiItem;
  wards: WardApiItem[];
  manualEntryAllowed: boolean;
};

export type LocationMetaResponse = {
  version: string;
  source: {
    name: string;
    issuedAt: string;
    effectiveFrom: string;
    url: string;
  };
  provinceCount: number;
  wardCount: number;
  manualEntryAllowed: boolean;
  missingWardProvinceCodes: string[];
  provinces: ProvinceApiItem[];
  externalShippingProviderMapping: {
    provider: 'GHN';
    status: 'admin_managed';
    note: string;
  };
};
