export type ApiValidationError = {
  field: string;
  message: string;
};

export type ApiResponse<T> = {
  message?: string;
  data?: T;
  errors?: ApiValidationError[];
  errorCode?: string;
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
  ghnMappingConfidence?: 'exact' | 'manual' | 'legacy' | null;
  ghnMappingVerifiedAt?: string | null;
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
  acceptedTerms: true;
  policyVersion: string;
};

export type SessionUser = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  avatarImage?: string | null;
  profileCompleted: boolean;
  mustChangePassword: boolean;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
};

export type OtpDeliveryInfo = {
  mode: 'mock' | 'real';
  provider: 'mock' | 'twilio' | 'esms';
  testOtp?: string;
};

export type EmailDeliveryInfo = {
  mode: 'mock' | 'real';
  provider: 'mock' | 'smtp';
  testToken?: string;
  testUrl?: string;
};

export type PasswordRecoveryResult =
  | { method: 'email'; delivery?: EmailDeliveryInfo }
  | { method: 'phone'; delivery?: OtpDeliveryInfo };

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
