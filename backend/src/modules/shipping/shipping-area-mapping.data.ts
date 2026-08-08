export type ShippingAreaMappingRecord = {
  provider: 'GHN';
  provinceCode: string;
  provinceName: string;
  wardCode: string;
  wardName: string;
  ghnProvinceId: number;
  ghnProvinceName: string;
  ghnDistrictId: number;
  ghnDistrictName: string;
  ghnWardCode: string;
  ghnWardName: string;
  confidence: 'exact' | 'manual' | 'legacy';
  verifiedAt: string;
  note?: string;
};

const SEED_VERIFIED_AT = '2026-07-29T00:00:00.000Z';

// Seed batch đầu tiên để backend có thể backfill GHN ngay lúc lưu địa chỉ.
// Cấu trúc này được giữ riêng để sau này có thể thay bằng collection/admin import.
const shippingAreaMappingSeedRecords: Array<Omit<ShippingAreaMappingRecord, 'verifiedAt'>> = [
  {
    provider: 'GHN',
    provinceCode: '01',
    provinceName: 'Thành phố Hà Nội',
    wardCode: '00004',
    wardName: 'Phường Ba Đình',
    ghnProvinceId: 201,
    ghnProvinceName: 'Hà Nội',
    ghnDistrictId: 1484,
    ghnDistrictName: 'Quận Ba Đình',
    ghnWardCode: '1A0107',
    ghnWardName: 'Phường Ngọc Hà',
    confidence: 'manual',
    note: 'Manual representative cho ward mới Ba Đình trong phase 1; cần admin review khi có mapping chi tiết theo đường.',
  },
  {
    provider: 'GHN',
    provinceCode: '92',
    provinceName: 'Thành phố Cần Thơ',
    wardCode: '31135',
    wardName: 'Phường Ninh Kiều',
    ghnProvinceId: 220,
    ghnProvinceName: 'Cần Thơ',
    ghnDistrictId: 1572,
    ghnDistrictName: 'Quận Ninh Kiều',
    ghnWardCode: '550108',
    ghnWardName: 'Phường An Phú',
    confidence: 'manual',
    note: 'Manual override cho ward mới Ninh Kiều trong phase 1.',
  },
  {
    provider: 'GHN',
    provinceCode: '92',
    provinceName: 'Thành phố Cần Thơ',
    wardCode: '31120',
    wardName: 'Phường Cái Khế',
    ghnProvinceId: 220,
    ghnProvinceName: 'Cần Thơ',
    ghnDistrictId: 1572,
    ghnDistrictName: 'Quận Ninh Kiều',
    ghnWardCode: '550109',
    ghnWardName: 'Phường Cái Khế',
    confidence: 'exact',
  },
  {
    provider: 'GHN',
    provinceCode: '92',
    provinceName: 'Thành phố Cần Thơ',
    wardCode: '31147',
    wardName: 'Phường Tân An',
    ghnProvinceId: 220,
    ghnProvinceName: 'Cần Thơ',
    ghnDistrictId: 1572,
    ghnDistrictName: 'Quận Ninh Kiều',
    ghnWardCode: '550111',
    ghnWardName: 'Phường Tân An',
    confidence: 'exact',
  },
  {
    provider: 'GHN',
    provinceCode: '92',
    provinceName: 'Thành phố Cần Thơ',
    wardCode: '31150',
    wardName: 'Phường An Bình',
    ghnProvinceId: 220,
    ghnProvinceName: 'Cần Thơ',
    ghnDistrictId: 1572,
    ghnDistrictName: 'Quận Ninh Kiều',
    ghnWardCode: '550101',
    ghnWardName: 'Phường An Bình',
    confidence: 'exact',
  },
  {
    provider: 'GHN',
    provinceCode: '92',
    provinceName: 'Thành phố Cần Thơ',
    wardCode: '31174',
    wardName: 'Phường Thới An Đông',
    ghnProvinceId: 220,
    ghnProvinceName: 'Cần Thơ',
    ghnDistrictId: 1573,
    ghnDistrictName: 'Quận Bình Thủy',
    ghnWardCode: '550206',
    ghnWardName: 'Phường Thới An Đông',
    confidence: 'exact',
  },
  {
    provider: 'GHN',
    provinceCode: '92',
    provinceName: 'Thành phố Cần Thơ',
    wardCode: '31168',
    wardName: 'Phường Bình Thủy',
    ghnProvinceId: 220,
    ghnProvinceName: 'Cần Thơ',
    ghnDistrictId: 1573,
    ghnDistrictName: 'Quận Bình Thủy',
    ghnWardCode: '550202',
    ghnWardName: 'Phường Bình Thủy',
    confidence: 'exact',
  },
  {
    provider: 'GHN',
    provinceCode: '92',
    provinceName: 'Thành phố Cần Thơ',
    wardCode: '31183',
    wardName: 'Phường Long Tuyền',
    ghnProvinceId: 220,
    ghnProvinceName: 'Cần Thơ',
    ghnDistrictId: 1573,
    ghnDistrictName: 'Quận Bình Thủy',
    ghnWardCode: '550205',
    ghnWardName: 'Phường Long Tuyền',
    confidence: 'exact',
  },
  {
    provider: 'GHN',
    provinceCode: '92',
    provinceName: 'Thành phố Cần Thơ',
    wardCode: '31201',
    wardName: 'Phường Hưng Phú',
    ghnProvinceId: 220,
    ghnProvinceName: 'Cần Thơ',
    ghnDistrictId: 1574,
    ghnDistrictName: 'Quận Cái Răng',
    ghnWardCode: '550302',
    ghnWardName: 'Phường Hưng Phú',
    confidence: 'exact',
  },
  {
    provider: 'GHN',
    provinceCode: '92',
    provinceName: 'Thành phố Cần Thơ',
    wardCode: '31157',
    wardName: 'Phường Thới Long',
    ghnProvinceId: 220,
    ghnProvinceName: 'Cần Thơ',
    ghnDistrictId: 1575,
    ghnDistrictName: 'Quận Ô Môn',
    ghnWardCode: '550406',
    ghnWardName: 'Phường Thới Long',
    confidence: 'exact',
  },
  {
    provider: 'GHN',
    provinceCode: '92',
    provinceName: 'Thành phố Cần Thơ',
    wardCode: '31162',
    wardName: 'Phường Phước Thới',
    ghnProvinceId: 220,
    ghnProvinceName: 'Cần Thơ',
    ghnDistrictId: 1575,
    ghnDistrictName: 'Quận Ô Môn',
    ghnWardCode: '550403',
    ghnWardName: 'Phường Phước Thới',
    confidence: 'exact',
  },
  {
    provider: 'GHN',
    provinceCode: '92',
    provinceName: 'Thành phố Cần Thơ',
    wardCode: '31217',
    wardName: 'Phường Trung Nhứt',
    ghnProvinceId: 220,
    ghnProvinceName: 'Cần Thơ',
    ghnDistrictId: 1576,
    ghnDistrictName: 'Quận Thốt Nốt',
    ghnWardCode: '550809',
    ghnWardName: 'Phường Trung Nhứt',
    confidence: 'exact',
  },
];

export const shippingAreaMappingSeed: ShippingAreaMappingRecord[] =
  shippingAreaMappingSeedRecords.map((mapping) => ({
    ...mapping,
    verifiedAt: SEED_VERIFIED_AT,
  }));
