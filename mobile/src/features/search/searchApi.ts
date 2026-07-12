import { apiFetch } from '../../config/api';
import { parseApiResponse, CatalogApiError } from '../catalog/catalogApi';

export type SuggestProduct = {
  _id: string;
  name: string;
  image: string;
  price: number;
  discount: number;
  finalPrice: number;
  brandName?: string;
};

export type SuggestCategory = {
  _id: string;
  name: string;
  gender: string;
};

export type SuggestResponse = {
  products: SuggestProduct[];
  categories: SuggestCategory[];
  keywords: string[];
};

const request = async <T>(path: string, signal?: AbortSignal): Promise<T> => {
  const response = await apiFetch(path, { signal });
  const payload = parseApiResponse<T>(await response.text());

  if (!response.ok) {
    const validationMessage = payload.errors?.map((error) => error.message).join('\n');
    throw new CatalogApiError(
      validationMessage || payload.message || 'Không thể tải gợi ý tìm kiếm',
      payload.errors,
      response.status,
    );
  }

  if (payload.data === undefined) {
    throw new CatalogApiError(payload.message || 'Dữ liệu gợi ý không hợp lệ');
  }

  return payload.data;
};

export const searchApi = {
  suggest: (query: string, signal?: AbortSignal) => {
    const q = encodeURIComponent(query.trim());
    return request<SuggestResponse>(`/products/suggest?q=${q}&limit=5`, signal);
  },
};