import { ValidationError } from './auth.validator';

const vietnamPhoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;

const isPositiveNumber = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value > 0;

export const validateUpdateProfile = (body: Record<string, unknown>): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 60) {
      errors.push({ field: 'name', message: 'Ho ten tu 2 den 60 ky tu' });
    }
  }

  if (body.phone !== undefined) {
    if (typeof body.phone !== 'string' || !vietnamPhoneRegex.test(body.phone.trim())) {
      errors.push({ field: 'phone', message: 'So dien thoai khong dung dinh dang' });
    }
  }

  if (body.gender !== undefined) {
    if (!['male', 'female'].includes(body.gender as string)) {
      errors.push({ field: 'gender', message: 'Gioi tinh phai la male hoac female' });
    }
  }

  if (body.dateOfBirth !== undefined) {
    if (typeof body.dateOfBirth !== 'string' || isNaN(Date.parse(body.dateOfBirth as string))) {
      errors.push({ field: 'dateOfBirth', message: 'Ngay sinh khong hop le' });
    }
  }

  if (body.avatarImage !== undefined && body.avatarImage !== null) {
    if (typeof body.avatarImage !== 'string' || body.avatarImage.trim().length > 1000) {
      errors.push({ field: 'avatarImage', message: 'Anh dai dien khong hop le' });
    }
  }

  return errors;
};

export const validateAddress = (body: Record<string, unknown>): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!body.customerName || typeof body.customerName !== 'string' || body.customerName.trim().length < 2 || body.customerName.trim().length > 60) {
    errors.push({ field: 'customerName', message: 'Ten nguoi nhan tu 2 den 60 ky tu' });
  }

  if (!body.phoneNumber || typeof body.phoneNumber !== 'string' || !vietnamPhoneRegex.test(body.phoneNumber.trim())) {
    errors.push({ field: 'phoneNumber', message: 'So dien thoai khong dung dinh dang' });
  }

  if (!body.province || typeof body.province !== 'string' || body.province.trim().length < 2 || body.province.trim().length > 80) {
    errors.push({ field: 'province', message: 'Tinh/thanh pho tu 2 den 80 ky tu' });
  }

  if (
    body.provinceCode !== undefined &&
    body.provinceCode !== null &&
    (typeof body.provinceCode !== 'string' || body.provinceCode.trim().length === 0)
  ) {
    errors.push({ field: 'provinceCode', message: 'Ma tinh/thanh pho khong hop le' });
  }

  if (body.provinceId !== undefined && body.provinceId !== null && !isPositiveNumber(body.provinceId)) {
    errors.push({ field: 'provinceId', message: 'Ma tinh/thanh GHN khong hop le' });
  }

  if (
    body.district !== undefined &&
    body.district !== null &&
    (typeof body.district !== 'string' || body.district.trim().length > 80)
  ) {
    errors.push({ field: 'district', message: 'Quan/huyen toi da 80 ky tu' });
  }

  if (body.districtId !== undefined && body.districtId !== null && !isPositiveNumber(body.districtId)) {
    errors.push({ field: 'districtId', message: 'Ma quan/huyen GHN khong hop le' });
  }

  if (!body.ward || typeof body.ward !== 'string' || body.ward.trim().length < 2 || body.ward.trim().length > 80) {
    errors.push({ field: 'ward', message: 'Phuong/xa tu 2 den 80 ky tu' });
  }

  if (!body.wardCode || typeof body.wardCode !== 'string' || body.wardCode.trim().length === 0) {
    errors.push({ field: 'wardCode', message: 'Ma phuong/xa khong hop le' });
  }

  if (body.ghnProvinceId !== undefined && body.ghnProvinceId !== null && !isPositiveNumber(body.ghnProvinceId)) {
    errors.push({ field: 'ghnProvinceId', message: 'Ma tinh/thanh GHN khong hop le' });
  }

  if (body.ghnDistrictId !== undefined && body.ghnDistrictId !== null && !isPositiveNumber(body.ghnDistrictId)) {
    errors.push({ field: 'ghnDistrictId', message: 'Ma quan/huyen GHN khong hop le' });
  }

  if (
    body.ghnWardCode !== undefined &&
    body.ghnWardCode !== null &&
    (typeof body.ghnWardCode !== 'string' || body.ghnWardCode.trim().length === 0)
  ) {
    errors.push({ field: 'ghnWardCode', message: 'Ma phuong/xa GHN khong hop le' });
  }

  if (!body.streetName || typeof body.streetName !== 'string' || body.streetName.trim().length < 5 || body.streetName.trim().length > 150) {
    errors.push({ field: 'streetName', message: 'Dia chi chi tiet tu 5 den 150 ky tu' });
  }

  return errors;
};
