import { resolveGhnArea } from '../ghn-area-resolver';

describe('resolveGhnArea', () => {
  it('keeps the representative Hanoi seed pending manual verification', () => {
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
      status: 'manual',
      confidence: 'manual',
      verifiedAt: null,
      verificationSource: null,
      source: 'mapping',
    });
  });

  it('keeps a manual Can Tho seed pending verification', () => {
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
      status: 'manual',
      confidence: 'manual',
      verifiedAt: null,
      verificationSource: null,
      source: 'mapping',
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
      status: 'manual',
      confidence: 'manual',
      verifiedAt: null,
      verificationSource: null,
      source: 'mapping',
    });
  });

  it('does not let unverified explicit codes override a seeded mapping', () => {
    const result = resolveGhnArea({
      province: 'Thành phố Cần Thơ',
      provinceCode: '92',
      ward: 'Phường Ninh Kiều',
      wardCode: '31135',
      ghnProvinceId: 220,
      ghnDistrictId: 1572,
      ghnWardCode: '550109',
      ghnMappingStatus: 'manual',
      ghnMappingConfidence: 'manual',
      ghnMappingVerifiedAt: '2026-07-29T00:00:00.000Z',
      streetName: '365 Tran Minh Son',
    });

    expect(result).toEqual({
      provider: 'GHN',
      provinceId: 220,
      districtId: 1572,
      wardCode: '550108',
      status: 'manual',
      confidence: 'manual',
      verifiedAt: null,
      verificationSource: null,
      source: 'mapping',
    });
  });
});
