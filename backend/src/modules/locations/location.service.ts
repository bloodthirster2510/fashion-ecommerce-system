export type ProvinceItem = {
  name: string;
  code: number;
};

export type WardItem = {
  name: string;
  code: number;
};

type ProvinceDetail = ProvinceItem & {
  wards?: WardItem[] | null;
};

const provinceApiBaseUrl = 'https://provinces.open-api.vn/api/v2';
const requestTimeoutMs = 8000;

const get = async <T>(path: string): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(`${provinceApiBaseUrl}${path}`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw { status: 502, message: 'Không thể tải dữ liệu địa chỉ' };
    }

    return response.json() as Promise<T>;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw { status: 504, message: 'Tải dữ liệu địa chỉ quá thời gian chờ' };
    }

    throw err;
  } finally {
    clearTimeout(timeout);
  }
};

export const getProvinces = async () => {
  return get<ProvinceItem[]>('/?depth=1');
};

export const getWards = async (provinceCode: number) => {
  const province = await get<ProvinceDetail>(`/p/${provinceCode}?depth=2`);
  return province.wards ?? [];
};
