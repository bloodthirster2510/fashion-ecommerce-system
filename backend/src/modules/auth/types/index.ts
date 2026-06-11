export type ApiValidationError = {
  field: string;
  message: string;
};

export type ApiResponse<T> = {
  message?: string;
  data?: T;
  errors?: ApiValidationError[];
};

export type UserAddressPayload = {
  customerName: string;
  province: string;
  provinceCode?: string | null;
  provinceId?: number | null;
  district?: string | null;
  districtId?: number | null;
  ward: string;
  wardCode: string;
  streetName: string;
  phoneNumber: string;
  ghnProvinceId?: number | null;
  ghnDistrictId?: number | null;
  ghnWardCode?: string | null;
  ghnMappingStatus?: 'mapped' | 'missing' | 'manual';
  isDefault: boolean;
};

export type RegisterPayload = {
  name: string;
  phone: string;
  email: string;
  gender: 'male' | 'female';
  dateOfBirth: string;
  address: UserAddressPayload;
  password: string;
  confirmPassword: string;
  otpToken: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: {
    _id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    avatarImage?: string | null;
    profileCompleted: boolean;
  };
};

export class AuthApiError extends Error {
  errors?: ApiValidationError[];

  constructor(message: string, errors?: ApiValidationError[]) {
    super(message);
    this.name = 'AuthApiError';
    this.errors = errors;
  }
}
