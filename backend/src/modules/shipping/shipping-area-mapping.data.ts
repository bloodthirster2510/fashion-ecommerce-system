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
    provinceName: 'Thanh pho Ha Noi',
    wardCode: '00004',
    wardName: 'Phuong Ba Dinh',
    ghnProvinceId: 201,
    ghnProvinceName: 'Ha Noi',
    ghnDistrictId: 1484,
    ghnDistrictName: 'Quan Ba Dinh',
    ghnWardCode: '1A0107',
    ghnWardName: 'Phuong Ngoc Ha',
    confidence: 'manual',
    note: 'Manual representative cho ward mới Ba Đình trong phase 1; cần admin review khi có mapping chi tiết theo đường.',
  },
  {
    provider: 'GHN',
    provinceCode: '92',
    provinceName: 'Thanh pho Can Tho',
    wardCode: '31135',
    wardName: 'Phuong Ninh Kieu',
    ghnProvinceId: 220,
    ghnProvinceName: 'Can Tho',
    ghnDistrictId: 1572,
    ghnDistrictName: 'Quan Ninh Kieu',
    ghnWardCode: '550108',
    ghnWardName: 'Phuong An Phu',
    confidence: 'manual',
    note: 'Manual override cho ward mới Ninh Kiều trong phase 1.',
  },
  {
    provider: 'GHN',
    provinceCode: '92',
    provinceName: 'Thanh pho Can Tho',
    wardCode: '31120',
    wardName: 'Phuong Cai Khe',
    ghnProvinceId: 220,
    ghnProvinceName: 'Can Tho',
    ghnDistrictId: 1572,
    ghnDistrictName: 'Quan Ninh Kieu',
    ghnWardCode: '550109',
    ghnWardName: 'Phuong Cai Khe',
    confidence: 'exact',
  },
  {
    provider: 'GHN',
    provinceCode: '92',
    provinceName: 'Thanh pho Can Tho',
    wardCode: '31147',
    wardName: 'Phuong Tan An',
    ghnProvinceId: 220,
    ghnProvinceName: 'Can Tho',
    ghnDistrictId: 1572,
    ghnDistrictName: 'Quan Ninh Kieu',
    ghnWardCode: '550111',
    ghnWardName: 'Phuong Tan An',
    confidence: 'exact',
  },
  {
    provider: 'GHN',
    provinceCode: '92',
    provinceName: 'Thanh pho Can Tho',
    wardCode: '31150',
    wardName: 'Phuong An Binh',
    ghnProvinceId: 220,
    ghnProvinceName: 'Can Tho',
    ghnDistrictId: 1572,
    ghnDistrictName: 'Quan Ninh Kieu',
    ghnWardCode: '550101',
    ghnWardName: 'Phuong An Binh',
    confidence: 'exact',
  },
  {
    provider: 'GHN',
    provinceCode: '92',
    provinceName: 'Thanh pho Can Tho',
    wardCode: '31174',
    wardName: 'Phuong Thoi An Dong',
    ghnProvinceId: 220,
    ghnProvinceName: 'Can Tho',
    ghnDistrictId: 1573,
    ghnDistrictName: 'Quan Binh Thuy',
    ghnWardCode: '550206',
    ghnWardName: 'Phuong Thoi An Dong',
    confidence: 'exact',
  },
  {
    provider: 'GHN',
    provinceCode: '92',
    provinceName: 'Thanh pho Can Tho',
    wardCode: '31168',
    wardName: 'Phuong Binh Thuy',
    ghnProvinceId: 220,
    ghnProvinceName: 'Can Tho',
    ghnDistrictId: 1573,
    ghnDistrictName: 'Quan Binh Thuy',
    ghnWardCode: '550202',
    ghnWardName: 'Phuong Binh Thuy',
    confidence: 'exact',
  },
  {
    provider: 'GHN',
    provinceCode: '92',
    provinceName: 'Thanh pho Can Tho',
    wardCode: '31183',
    wardName: 'Phuong Long Tuyen',
    ghnProvinceId: 220,
    ghnProvinceName: 'Can Tho',
    ghnDistrictId: 1573,
    ghnDistrictName: 'Quan Binh Thuy',
    ghnWardCode: '550205',
    ghnWardName: 'Phuong Long Tuyen',
    confidence: 'exact',
  },
  {
    provider: 'GHN',
    provinceCode: '92',
    provinceName: 'Thanh pho Can Tho',
    wardCode: '31201',
    wardName: 'Phuong Hung Phu',
    ghnProvinceId: 220,
    ghnProvinceName: 'Can Tho',
    ghnDistrictId: 1574,
    ghnDistrictName: 'Quan Cai Rang',
    ghnWardCode: '550302',
    ghnWardName: 'Phuong Hung Phu',
    confidence: 'exact',
  },
  {
    provider: 'GHN',
    provinceCode: '92',
    provinceName: 'Thanh pho Can Tho',
    wardCode: '31157',
    wardName: 'Phuong Thoi Long',
    ghnProvinceId: 220,
    ghnProvinceName: 'Can Tho',
    ghnDistrictId: 1575,
    ghnDistrictName: 'Quan O Mon',
    ghnWardCode: '550406',
    ghnWardName: 'Phuong Thoi Long',
    confidence: 'exact',
  },
  {
    provider: 'GHN',
    provinceCode: '92',
    provinceName: 'Thanh pho Can Tho',
    wardCode: '31162',
    wardName: 'Phuong Phuoc Thoi',
    ghnProvinceId: 220,
    ghnProvinceName: 'Can Tho',
    ghnDistrictId: 1575,
    ghnDistrictName: 'Quan O Mon',
    ghnWardCode: '550403',
    ghnWardName: 'Phuong Phuoc Thoi',
    confidence: 'exact',
  },
  {
    provider: 'GHN',
    provinceCode: '92',
    provinceName: 'Thanh pho Can Tho',
    wardCode: '31217',
    wardName: 'Phuong Trung Nhut',
    ghnProvinceId: 220,
    ghnProvinceName: 'Can Tho',
    ghnDistrictId: 1576,
    ghnDistrictName: 'Quan Thot Not',
    ghnWardCode: '550809',
    ghnWardName: 'Phuong Trung Nhut',
    confidence: 'exact',
  },
];

export const shippingAreaMappingSeed: ShippingAreaMappingRecord[] =
  shippingAreaMappingSeedRecords.map((mapping) => ({
    ...mapping,
    verifiedAt: SEED_VERIFIED_AT,
  }));
