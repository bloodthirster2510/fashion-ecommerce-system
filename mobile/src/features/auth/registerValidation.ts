export type RegisterSelectOption = {
  label: string;
  value: string;
};

export const getDayOptions = (
  month: string,
  year: string,
  fallbackYear = new Date().getFullYear(),
): RegisterSelectOption[] => {
  const numericMonth = Number(month);
  const numericYear = Number(year) || fallbackYear;
  const dayCount = numericMonth ? new Date(numericYear, numericMonth, 0).getDate() : 31;

  return Array.from({ length: dayCount }, (_, index) => {
    const value = String(index + 1);
    return { label: value, value };
  });
};

export const buildDateOfBirth = (
  birthDay: string,
  birthMonth: string,
  birthYear: string,
  today = new Date(),
) => {
  const day = Number(birthDay);
  const month = Number(birthMonth);
  const year = Number(birthYear);

  if (!day || !month || !year) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  const isValidDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  if (!isValidDate) return null;

  let age = today.getFullYear() - year;
  const birthdayHasPassed =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!birthdayHasPassed) age -= 1;

  if (age < 13 || age > 100) return null;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const buildManualWardCode = (provinceCode: string, wardName: string) =>
  `manual-${provinceCode || 'unknown'}-${wardName.trim().replace(/\s+/g, '-').toLowerCase()}`;
