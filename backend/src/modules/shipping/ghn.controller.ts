import { Request, Response } from 'express';
import { error as errorResponse, ok } from '../../utils/response';
import { GHNService, GHNServiceError } from './ghn.service';

const parsePositiveInteger = (value: unknown) => {
  if (Array.isArray(value)) {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
};

const parseString = (value: unknown) => {
  if (Array.isArray(value)) {
    return parseString(value[0]);
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue || null;
};

const parseOrderItem = (item: unknown) => {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const orderItem = item as { name?: unknown; quantity?: unknown; price?: unknown };
  const name = parseString(orderItem.name);
  const quantity = parsePositiveInteger(orderItem.quantity);
  const price = Number(orderItem.price);

  if (!name || !quantity || !Number.isFinite(price) || price < 0) {
    return null;
  }

  return { name, quantity, price };
};

const isGhnConfigurationError = (err: GHNServiceError) => (
  err.message.includes('environment variable')
);

const handleError = (res: Response, err: unknown) => {
  if (err instanceof GHNServiceError) {
    const message = isGhnConfigurationError(err)
      ? 'Dịch vụ địa chỉ GHN chưa được cấu hình. Checkout vẫn có thể dùng phí giao hàng tạm tính.'
      : err.message;

    return errorResponse(res, message, err.statusCode);
  }

  return errorResponse(res, 'Lỗi server', 500);
};

export const getProvinces = async (_req: Request, res: Response) => {
  try {
    const result = await GHNService.getProvinces();
    return ok(res, result, 'Lấy danh sách tỉnh/thành GHN thành công');
  } catch (err) {
    return handleError(res, err);
  }
};

export const getDistricts = async (req: Request, res: Response) => {
  const provinceId = parsePositiveInteger(req.query.provinceId);

  if (!provinceId) {
    return errorResponse(res, 'provinceId không hợp lệ');
  }

  try {
    const result = await GHNService.getDistricts(provinceId);
    return ok(res, result, 'Lấy danh sách quận/huyện GHN thành công');
  } catch (err) {
    return handleError(res, err);
  }
};

export const getWards = async (req: Request, res: Response) => {
  const districtId = parsePositiveInteger(req.query.districtId);

  if (!districtId) {
    return errorResponse(res, 'districtId không hợp lệ');
  }

  try {
    const result = await GHNService.getWards(districtId);
    return ok(res, result, 'Lấy danh sách phường/xã GHN thành công');
  } catch (err) {
    return handleError(res, err);
  }
};

export const getAvailableServices = async (req: Request, res: Response) => {
  const toDistrictId = parsePositiveInteger(req.query.toDistrictId);
  const fromDistrictId = parsePositiveInteger(req.query.fromDistrictId) || parsePositiveInteger(process.env.SHOP_DISTRICT_ID);

  if (!toDistrictId) {
    return errorResponse(res, 'toDistrictId không hợp lệ');
  }

  if (!fromDistrictId) {
    return errorResponse(res, 'SHOP_DISTRICT_ID chưa được cấu hình', 500);
  }

  try {
    const result = await GHNService.getAvailableServices({ fromDistrictId, toDistrictId });
    return ok(res, result, 'Lấy danh sách dịch vụ GHN thành công');
  } catch (err) {
    return handleError(res, err);
  }
};

export const calculateFee = async (req: Request, res: Response) => {
  const toDistrictId = parsePositiveInteger(req.body.toDistrictId);
  const toWardCode = parseString(req.body.toWardCode);
  const weight = parsePositiveInteger(req.body.weight);

  if (!toDistrictId || !toWardCode || !weight) {
    return errorResponse(res, 'toDistrictId, toWardCode và weight là bắt buộc');
  }

  try {
    const result = await GHNService.calculateShippingFee({
      ...req.body,
      toDistrictId,
      toWardCode,
      weight,
      length: parsePositiveInteger(req.body.length) || undefined,
      width: parsePositiveInteger(req.body.width) || undefined,
      height: parsePositiveInteger(req.body.height) || undefined,
      insuranceValue: parsePositiveInteger(req.body.insuranceValue) || undefined,
      serviceId: parsePositiveInteger(req.body.serviceId) || undefined,
      serviceTypeId: parsePositiveInteger(req.body.serviceTypeId) || undefined,
    });

    return ok(res, result, 'Tính phí vận chuyển GHN thành công');
  } catch (err) {
    return handleError(res, err);
  }
};

export const createShippingOrder = async (req: Request, res: Response) => {
  const toDistrictId = parsePositiveInteger(req.body.toDistrictId);
  const toWardCode = parseString(req.body.toWardCode);
  const weight = parsePositiveInteger(req.body.weight);
  const requiredStrings = [
    'clientOrderCode',
    'toName',
    'toPhone',
    'toAddress',
    'content',
  ] as const;
  const hasMissingString = requiredStrings.some((field) => !parseString(req.body[field]));
  const items = Array.isArray(req.body.items) ? (req.body.items as unknown[]).map(parseOrderItem) : null;

  if (!toDistrictId || !toWardCode || !weight || hasMissingString || !items?.length || items.some((item) => !item)) {
    return errorResponse(res, 'Thông tin tạo đơn GHN không hợp lệ');
  }

  const validItems = items.filter((item): item is NonNullable<typeof item> => Boolean(item));

  try {
    const result = await GHNService.createShippingOrder({
      clientOrderCode: parseString(req.body.clientOrderCode)!,
      toName: parseString(req.body.toName)!,
      toPhone: parseString(req.body.toPhone)!,
      toAddress: parseString(req.body.toAddress)!,
      toWardCode,
      toDistrictId,
      codAmount: parsePositiveInteger(req.body.codAmount) || 0,
      content: parseString(req.body.content)!,
      weight,
      length: parsePositiveInteger(req.body.length) || undefined,
      width: parsePositiveInteger(req.body.width) || undefined,
      height: parsePositiveInteger(req.body.height) || undefined,
      items: validItems,
    });

    return ok(res, result, 'Tạo đơn vận chuyển GHN thành công');
  } catch (err) {
    return handleError(res, err);
  }
};

export const getOrderDetail = async (req: Request, res: Response) => {
  const orderCode = parseString(req.params.orderCode);

  if (!orderCode) {
    return errorResponse(res, 'orderCode không hợp lệ');
  }

  try {
    const result = await GHNService.getOrderDetail(orderCode);
    return ok(res, result, 'Lấy chi tiết đơn GHN thành công');
  } catch (err) {
    return handleError(res, err);
  }
};

export const cancelOrder = async (req: Request, res: Response) => {
  const orderCodes = Array.isArray(req.body.orderCodes)
    ? (req.body.orderCodes as unknown[])
        .map((orderCode: unknown) => parseString(orderCode))
        .filter((orderCode): orderCode is string => Boolean(orderCode))
    : [];

  if (!orderCodes.length) {
    return errorResponse(res, 'orderCodes là bắt buộc');
  }

  try {
    const result = await GHNService.cancelOrder(orderCodes);
    return ok(res, result, 'Hủy đơn GHN thành công');
  } catch (err) {
    return handleError(res, err);
  }
};
