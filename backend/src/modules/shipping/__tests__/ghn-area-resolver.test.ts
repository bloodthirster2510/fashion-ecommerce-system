import { resolveGhnArea } from '../ghn-area-resolver';

describe('resolveGhnArea', () => {
  it('maps Hanoi Ba Dinh 2025 ward to seeded GHN data', () => {
    const result = resolveGhnArea({
      province: 'Thanh pho Ha Noi',
      provinceCode: '01',
      ward: 'Phuong Ba Dinh',
      wardCode: '00004',
      streetName: '65 Nguyen Minh Khai',
    });

    expect(result).toEqual({
      provider: 'GHN',
      provinceId: 201,
      districtId: 1484,
      wardCode: '1A0107',
      status: 'mapped',
    });
  });

  it('maps Can Tho ward codes to seeded GHN data when no GHN fields are stored yet', () => {
    const result = resolveGhnArea({
      province: 'Thành phố Cần Thơ',
      provinceCode: '92',
      ward: 'Phường Ninh Kiều',
      wardCode: '31135',
      streetName: '365 Tran Minh Son',
    });

    expect(result).toEqual({
      provider: 'GHN',
      provinceId: 220,
      districtId: 1572,
      wardCode: '550108',
      status: 'mapped',
    });
  });

  it('falls back to name matching for stale ward codes', () => {
    const result = resolveGhnArea({
      province: 'Thanh pho Can Tho',
      provinceCode: '92',
      ward: 'Phuong Ninh Kieu',
      wardCode: '31138',
      streetName: '365 Tran Minh Son',
    });

    expect(result).toEqual({
      provider: 'GHN',
      provinceId: 220,
      districtId: 1572,
      wardCode: '550108',
      status: 'mapped',
    });
  });

  it('keeps explicit GHN codes as manual data', () => {
    const result = resolveGhnArea({
      province: 'Thành phố Cần Thơ',
      provinceCode: '92',
      ward: 'Phường Ninh Kiều',
      wardCode: '31135',
      ghnProvinceId: 220,
      ghnDistrictId: 1572,
      ghnWardCode: '550109',
      ghnMappingStatus: 'manual',
      streetName: '365 Tran Minh Son',
    });

    expect(result).toEqual({
      provider: 'GHN',
      provinceId: 220,
      districtId: 1572,
      wardCode: '550109',
      status: 'manual',
    });
  });
});
