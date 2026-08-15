export const MINIMUM_CUSTOMER_AGE = 16;
const MAXIMUM_CUSTOMER_AGE = 100;

export const isValidCustomerBirthDate = (value: unknown) => {
  if (typeof value !== 'string') return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return false;

  const today = new Date();
  let age = today.getUTCFullYear() - year;
  const birthdayHasPassed = today.getUTCMonth() + 1 > month
    || (today.getUTCMonth() + 1 === month && today.getUTCDate() >= day);
  if (!birthdayHasPassed) age -= 1;

  return age >= MINIMUM_CUSTOMER_AGE && age <= MAXIMUM_CUSTOMER_AGE;
};

export const customerBirthDateMessage =
  `Ngày sinh không hợp lệ hoặc độ tuổi phải từ ${MINIMUM_CUSTOMER_AGE} đến ${MAXIMUM_CUSTOMER_AGE}`;
