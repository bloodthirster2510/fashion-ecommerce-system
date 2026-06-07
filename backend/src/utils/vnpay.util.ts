import crypto from 'crypto';

export const formatVNPayDate = (date = new Date()) => {
  const vnTime = new Date(
    date.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })
  );
  const pad = (value: number) => value.toString().padStart(2, '0');

  return (
    vnTime.getFullYear().toString() +
    pad(vnTime.getMonth() + 1) +
    pad(vnTime.getDate()) +
    pad(vnTime.getHours()) +
    pad(vnTime.getMinutes()) +
    pad(vnTime.getSeconds())
  );
};

export const sanitizeVNPayOrderInfo = (info: string) => {
  const sanitized = info
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^0-9A-Za-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (sanitized || 'Thanh toan don hang').slice(0, 255);
};

export const normalizeVNPayParams = (params: Record<string, unknown>) => {
  const normalized: Record<string, string> = {};

  // Query của Express có thể là mảng string; dữ liệu ký của VNPay cần mỗi tham số là một chuỗi đơn.
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    normalized[key] = Array.isArray(value) ? String(value[0]) : String(value);
  }

  return normalized;
};

export const sortObject = (obj: Record<string, unknown>) => {
  const sorted: Record<string, string> = {};

  // VNPay yêu cầu key được sắp xếp tăng dần trước khi tạo chuỗi ký/hash.
  const keys = Object.keys(obj).sort();

  for (const key of keys) {
    const value = obj[key];

    if (value === undefined || value === null || value === '') {
      continue;
    }

    sorted[key] = String(value);
  }

  return sorted;
};

export const buildVNPayQueryString = (params: Record<string, unknown>) => {
  const sortedParams = sortObject(params);

  return Object.keys(sortedParams)
    .map((key) => `${key}=${encodeURIComponent(sortedParams[key]).replace(/%20/g, '+')}`)
    .join('&');
};

export const createVNPaySecureHash = (
  params: Record<string, unknown>,
  hashSecret: string
) => {
  const signData = buildVNPayQueryString(params);

  return crypto
    .createHmac('sha512', hashSecret)
    .update(Buffer.from(signData, 'utf-8'))
    .digest('hex');
};
