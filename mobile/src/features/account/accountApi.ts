import { apiFetch } from '../../config/api';
import type { ApiResponse, ApiValidationError, UserAddressPayload } from '../auth/types';

export type Gender = 'male' | 'female';

export type UserAddress = UserAddressPayload & {
  _id?: string;
};

export type UserProfile = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  gender?: Gender;
  dateOfBirth?: string;
  address?: UserAddress[];
  avatarImage?: string | null;
  loyaltyPoint?: number;
  profileCompleted?: boolean;
};

export type MembershipTier = {
  _id?: string;
  name: string;
  level: number;
  minPoint: number;
  maxPoint: number | null;
  discountPercent: number;
  benefitDescription?: string;
  cardColor?: string;
  textColor?: string;
  badgeColor?: string;
  iconName?: string;
};

export type MembershipResponse = {
  currentTier: MembershipTier | null;
  nextTier: MembershipTier | null;
  loyaltyPoint: number;
  pointToNextTier: number | null;
  progressPercent: number;
  tiers: MembershipTier[];
};

export type OrderListSummaryResponse = {
  pagination?: {
    totalItems?: number;
  };
};

export type UpdateProfilePayload = {
  name?: string;
  phone?: string;
  gender?: Gender;
  dateOfBirth?: string;
  avatarImage?: string | null;
};

export class AccountApiError extends Error {
  errors?: ApiValidationError[];
  status?: number;

  constructor(message: string, errors?: ApiValidationError[], status?: number) {
    super(message);
    this.name = 'AccountApiError';
    this.errors = errors;
    this.status = status;
  }
}

const parseApiResponse = <T>(text: string): ApiResponse<T> => {
  if (!text) return {};

  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    return { message: text };
  }
};

const request = async <T>(
  path: string,
  token: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: Record<string, unknown>;
    timeoutMs?: number;
    retryOnTimeout?: boolean;
  } = {},
): Promise<T> => {
  const response = await apiFetch(path, {
    method: options.method ?? 'GET',
    timeoutMs: options.timeoutMs,
    retryOnTimeout: options.retryOnTimeout,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = parseApiResponse<T>(await response.text());

  if (!response.ok) {
    const validationMessage = payload.errors?.map((error) => error.message).join('\n');
    throw new AccountApiError(
      validationMessage || payload.message || 'Không thể kết nối máy chủ',
      payload.errors,
      response.status,
    );
  }

  return payload.data as T;
};

export const accountApi = {
  getMe: (token: string) => request<UserProfile>('/users/me', token),
  updateMe: (token: string, payload: UpdateProfilePayload) =>
    request<UserProfile>('/users/me', token, { method: 'PUT', body: payload }),
  uploadAvatar: (token: string, imageBase64: string, mimeType: string) =>
    request<UserProfile>('/users/me/avatar', token, {
      method: 'POST',
      timeoutMs: 30000,
      retryOnTimeout: false,
      body: { imageBase64, mimeType },
    }),
  getAddresses: (token: string) => request<UserAddress[]>('/users/me/addresses', token),
  addAddress: (token: string, payload: UserAddressPayload) =>
    request<UserAddress[]>('/users/me/addresses', token, { method: 'POST', body: payload }),
  updateAddress: (token: string, addressId: string, payload: UserAddressPayload) =>
    request<UserAddress[]>(`/users/me/addresses/${addressId}`, token, { method: 'PUT', body: payload }),
  deleteAddress: (token: string, addressId: string) =>
    request<undefined>(`/users/me/addresses/${addressId}`, token, { method: 'DELETE' }),
  setDefaultAddress: (token: string, addressId: string) =>
    request<UserAddress[]>(`/users/me/addresses/${addressId}/default`, token, { method: 'PATCH' }),
  changePassword: (token: string, currentPassword: string, newPassword: string, confirmPassword: string) =>
    request<null>('/auth/change-password', token, {
      method: 'POST',
      body: { currentPassword, newPassword, confirmPassword },
    }),
  getMembership: (token: string) => request<MembershipResponse>('/users/me/membership', token),
  getMyOrderSummary: (token: string, status?: string) => {
    const query = new URLSearchParams({ page: '1', limit: '1' });
    if (status) {
      query.set('status', status);
    }

    return request<OrderListSummaryResponse>(`/orders/me?${query.toString()}`, token);
  },
};
