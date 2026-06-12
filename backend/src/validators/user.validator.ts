import { ValidationError } from './auth.validator';

const vietnamPhoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;

const isPositiveNumber = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value > 0;

export const validateUpdateProfile = (body: Record<string, unknown>): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 60) {
      errors.push({ field: 'name', message: 'Họ tên từ 2 đến 60 ký tự' });
    }
  }

  if (body.phone !== undefined) {
    if (typeof body.phone !== 'string' || !vietnamPhoneRegex.test(body.phone.trim())) {
      errors.push({ field: 'phone', message: 'Số điện thoại không đúng định dạng' });
    }
  }

  if (body.gender !== undefined) {
    if (!['male', 'female'].includes(body.gender as string)) {
      errors.push({ field: 'gender', message: 'Giới tính phải là male hoặc female' });
    }
  }

  if (body.dateOfBirth !== undefined) {
    if (typeof body.dateOfBirth !== 'string' || isNaN(Date.parse(body.dateOfBirth as string))) {
      errors.push({ field: 'dateOfBirth', message: 'Ngày sinh không hợp lệ' });
    }
  }

  if (body.avatarImage !== undefined && body.avatarImage !== null) {
    if (typeof body.avatarImage !== 'string' || body.avatarImage.trim().length > 1000) {
      errors.push({ field: 'avatarImage', message: 'Ảnh đại diện không hợp lệ' });
    }
  }

  return errors;
};

export const validateAddress = (body: Record<string, unknown>): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!body.customerName || typeof body.customerName !== 'string' || body.customerName.trim().length < 2 || body.customerName.trim().length > 60) {
    errors.push({ field: 'customerName', message: 'Tên người nhận từ 2 đến 60 ký tự' });
  }

  if (!body.phoneNumber || typeof body.phoneNumber !== 'string' || !vietnamPhoneRegex.test(body.phoneNumber.trim())) {
    errors.push({ field: 'phoneNumber', message: 'Số điện thoại không đúng định dạng' });
  }

  if (!body.province || typeof body.province !== 'string' || body.province.trim().length < 2 || body.province.trim().length > 80) {
    errors.push({ field: 'province', message: 'Tỉnh/thành phố từ 2 đến 80 ký tự' });
  }

  if (
    body.provinceCode !== undefined &&
    body.provinceCode !== null &&
    (typeof body.provinceCode !== 'string' || body.provinceCode.trim().length === 0)
  ) {
    errors.push({ field: 'provinceCode', message: 'Mã tỉnh/thành phố không hợp lệ' });
  }

  if (body.provinceId !== undefined && body.provinceId !== null && !isPositiveNumber(body.provinceId)) {
    errors.push({ field: 'provinceId', message: 'Mã tỉnh/thành GHN không hợp lệ' });
  }

  if (
    body.district !== undefined &&
    body.district !== null &&
    (typeof body.district !== 'string' || body.district.trim().length > 80)
  ) {
    errors.push({ field: 'district', message: 'Quận/huyện tối đa 80 ký tự' });
  }

  if (body.districtId !== undefined && body.districtId !== null && !isPositiveNumber(body.districtId)) {
    errors.push({ field: 'districtId', message: 'Mã quận/huyện GHN không hợp lệ' });
  }

  if (!body.ward || typeof body.ward !== 'string' || body.ward.trim().length < 2 || body.ward.trim().length > 80) {
    errors.push({ field: 'ward', message: 'Phường/xã từ 2 đến 80 ký tự' });
  }

  if (!body.wardCode || typeof body.wardCode !== 'string' || body.wardCode.trim().length === 0) {
    errors.push({ field: 'wardCode', message: 'Mã phường/xã không hợp lệ' });
  }

  if (body.ghnProvinceId !== undefined && body.ghnProvinceId !== null && !isPositiveNumber(body.ghnProvinceId)) {
    errors.push({ field: 'ghnProvinceId', message: 'Mã tỉnh/thành GHN không hợp lệ' });
  }

  if (body.ghnDistrictId !== undefined && body.ghnDistrictId !== null && !isPositiveNumber(body.ghnDistrictId)) {
    errors.push({ field: 'ghnDistrictId', message: 'Mã quận/huyện GHN không hợp lệ' });
  }

  if (
    body.ghnWardCode !== undefined &&
    body.ghnWardCode !== null &&
    (typeof body.ghnWardCode !== 'string' || body.ghnWardCode.trim().length === 0)
  ) {
    errors.push({ field: 'ghnWardCode', message: 'Mã phường/xã GHN không hợp lệ' });
  }

  if (!body.streetName || typeof body.streetName !== 'string' || body.streetName.trim().length < 5 || body.streetName.trim().length > 150) {
    errors.push({ field: 'streetName', message: 'Địa chỉ chi tiết từ 5 đến 150 ký tự' });
  }

  return errors;
};
