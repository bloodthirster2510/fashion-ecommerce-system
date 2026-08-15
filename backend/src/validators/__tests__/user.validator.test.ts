import { validateAddress, validateUpdateProfile } from '../user.validator';

describe('user validators', () => {
  it('rejects null and array request bodies', () => {
    expect(validateUpdateProfile(null as never)).toEqual([
      { field: 'body', message: 'Dữ liệu cập nhật không hợp lệ' },
    ]);
    expect(validateAddress([] as never)).toEqual([
      { field: 'body', message: 'Dữ liệu địa chỉ không hợp lệ' },
    ]);
  });

  it('rejects impossible and out-of-range birth dates', () => {
    expect(validateUpdateProfile({ dateOfBirth: '2010-02-31' })).toContainEqual({
      field: 'dateOfBirth',
      message: 'Ngày sinh không hợp lệ hoặc độ tuổi phải từ 16 đến 100',
    });
    expect(validateUpdateProfile({ dateOfBirth: '2999-01-01' })).toContainEqual({
      field: 'dateOfBirth',
      message: 'Ngày sinh không hợp lệ hoặc độ tuổi phải từ 16 đến 100',
    });
    expect(validateUpdateProfile({ dateOfBirth: '1990-01-01' })).toEqual([]);
  });
});
