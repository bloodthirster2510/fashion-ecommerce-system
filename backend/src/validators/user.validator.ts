import { ValidationError } from './auth.validator';

const vietnamPhoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;

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

  if (!body.district || typeof body.district !== 'string' || body.district.trim().length < 2 || body.district.trim().length > 80) {
    errors.push({ field: 'district', message: 'Quận/huyện từ 2 đến 80 ký tự' });
  }

  if (!body.ward || typeof body.ward !== 'string' || body.ward.trim().length < 2 || body.ward.trim().length > 80) {
    errors.push({ field: 'ward', message: 'Phường/xã từ 2 đến 80 ký tự' });
  }

  if (!body.streetName || typeof body.streetName !== 'string' || body.streetName.trim().length < 5 || body.streetName.trim().length > 150) {
    errors.push({ field: 'streetName', message: 'Địa chỉ chi tiết từ 5 đến 150 ký tự' });
  }

  return errors;
};
