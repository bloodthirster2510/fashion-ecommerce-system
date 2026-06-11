import * as locationService from '../location.service';

describe('location service', () => {
  it('exposes the official 2025 administrative dataset metadata', async () => {
    const meta = await locationService.getMeta();

    expect(meta.version).toBe('2025-07-01');
    expect(meta.provinceCount).toBe(34);
    expect(meta.wardCount).toBe(3321);
    expect(meta.manualEntryAllowed).toBe(false);
    expect(meta.missingWardProvinceCodes).toEqual([]);
    expect(meta.source.name).toContain('1027/CTK-CSCL');
  });

  it('returns complete ward lists for provinces used by checkout and admin mapping', async () => {
    const haNoi = await locationService.getWards('01');
    const vinhLong = await locationService.getWards('86');
    const caMau = await locationService.getWards('96');

    expect(haNoi.province.name).toBe('Thành phố Hà Nội');
    expect(haNoi.wards).toHaveLength(126);
    expect(haNoi.wards.find((ward) => ward.code === '00070')?.name).toBe('Phường Hoàn Kiếm');

    expect(vinhLong.province.name).toBe('Tỉnh Vĩnh Long');
    expect(vinhLong.wards).toHaveLength(124);
    expect(vinhLong.manualEntryAllowed).toBe(false);

    expect(caMau.wards).toHaveLength(64);
    expect(caMau.wards.find((ward) => ward.code === '31894')?.name).toBe('Xã Châu Thới');
  });

  it('sorts API results by display name without administrative prefixes', async () => {
    const provinces = await locationService.getProvinces();
    const provinceNames = provinces.map((province) => province.name);
    const anGiangIndex = provinceNames.indexOf('Tỉnh An Giang');
    const canThoIndex = provinceNames.indexOf('Thành phố Cần Thơ');
    const haNoiIndex = provinceNames.indexOf('Thành phố Hà Nội');
    const hoChiMinhIndex = provinceNames.indexOf('Thành phố Hồ Chí Minh');

    expect(anGiangIndex).toBeGreaterThanOrEqual(0);
    expect(canThoIndex).toBeGreaterThanOrEqual(0);
    expect(haNoiIndex).toBeGreaterThanOrEqual(0);
    expect(hoChiMinhIndex).toBeGreaterThanOrEqual(0);
    expect(anGiangIndex).toBeLessThan(canThoIndex);
    expect(haNoiIndex).toBeLessThan(hoChiMinhIndex);

    const haNoi = await locationService.getWards('01');
    const wardNames = haNoi.wards.map((ward) => ward.name);

    expect(wardNames.indexOf('Xã Bát Tràng')).toBeLessThan(wardNames.indexOf('Phường Hoàn Kiếm'));
  });

  it('searches by Vietnamese names and administrative codes', async () => {
    const byName = await locationService.searchLocations('Hoàn Kiếm');
    const byCode = await locationService.searchLocations('31894');

    expect(byName.wards.some((ward) => ward.code === '00070')).toBe(true);
    expect(byCode.wards).toEqual([
      expect.objectContaining({
        code: '31894',
        name: 'Xã Châu Thới',
        provinceCode: '96',
      }),
    ]);
  });
});
