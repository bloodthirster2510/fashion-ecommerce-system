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
  district: string;
  ward: string;
  streetName: string;
  phoneNumber: string;
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

export type SessionUser = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  avatarImage?: string | null;
  profileCompleted: boolean;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
};

export class AuthApiError extends Error {
  errors?: ApiValidationError[];
  status?: number;

  constructor(message: string, errors?: ApiValidationError[], status?: number) {
    super(message);
    this.name = 'AuthApiError';
    this.errors = errors;
    this.status = status;
  }
}
