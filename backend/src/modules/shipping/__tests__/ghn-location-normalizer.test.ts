import {
  sanitizeGhnDistrictsResponse,
  sanitizeGhnProvincesResponse,
  sanitizeGhnWardsResponse,
} from '../ghn-location-normalizer';

describe('GHN location normalizer', () => {
  it('filters test provinces and keeps the real province over GHN copy rows', () => {
    const result = sanitizeGhnProvincesResponse({
      code: 200,
      data: [
        { ProvinceID: 2002, ProvinceName: 'Ha Noi 02' },
        { ProvinceID: 298, ProvinceName: 'Test - Alert - Tinh - 001' },
        { ProvinceID: 201, ProvinceName: 'Ha Noi' },
        { ProvinceID: 215, ProvinceName: 'Vinh Long' },
      ],
    });

    expect(result.data).toEqual([
      { ProvinceID: 201, ProvinceName: 'Ha Noi' },
      { ProvinceID: 215, ProvinceName: 'Vinh Long' },
    ]);
  });

  it('filters test districts and sorts valid rows', () => {
    const result = sanitizeGhnDistrictsResponse({
      code: 200,
      data: [
        { DistrictID: 3776, DistrictName: 'Test - Alert - Quan - 005' },
        { DistrictID: 1562, DistrictName: 'Thanh pho Vinh Long' },
        { DistrictID: 1962, DistrictName: 'Huyen Long Ho' },
      ],
    });

    expect(result.data).toEqual([
      { DistrictID: 1962, DistrictName: 'Huyen Long Ho' },
      { DistrictID: 1562, DistrictName: 'Thanh pho Vinh Long' },
    ]);
  });

  it('does not strip numeric ward names', () => {
    const result = sanitizeGhnWardsResponse({
      code: 200,
      data: [
        { WardCode: '1', WardName: 'Phuong 02' },
        { WardCode: '2', WardName: 'Test - Alert - Ward' },
      ],
    });

    expect(result.data).toEqual([{ WardCode: '1', WardName: 'Phuong 02' }]);
  });

  it('leaves non GHN-shaped responses untouched', () => {
    const result = sanitizeGhnProvincesResponse({ code: 500, message: 'temporary error' });

    expect(result).toEqual({ code: 500, message: 'temporary error' });
  });
});
