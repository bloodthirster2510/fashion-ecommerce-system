import { apiFetch } from '../../config/api';

export type ProvinceApiItem = {
  name: string;
  code: number;
};

export type WardApiItem = {
  name: string;
  code: number;
};

type ApiResponse<T> = {
  message?: string;
  data?: T;
};

const requestTimeoutMs = 8000;

const get = async <T>(path: string): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await apiFetch(path, {
      signal: controller.signal,
    });
    const payload = (await response.json()) as ApiResponse<T>;

    if (!response.ok) {
      throw new Error(payload.message || 'Không thể tải dữ liệu địa chỉ');
    }

    return payload.data as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Tải dữ liệu địa chỉ quá thời gian chờ');
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export const locationApi = {
  getProvinces: () => get<ProvinceApiItem[]>('/locations/provinces'),
  getWards: (provinceCode: number) =>
    get<WardApiItem[]>(`/locations/provinces/${provinceCode}/wards`),
};
