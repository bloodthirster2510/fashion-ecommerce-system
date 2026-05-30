import { Request, Response } from 'express';
import * as locationService from './location.service';
import { ok } from '../../utils/response';

const parseCode = (value: unknown) => {
  if (Array.isArray(value)) return null;

  const code = Number(value);
  return Number.isInteger(code) && code > 0 ? code : null;
};

const handleError = (res: Response, err: unknown) => {
  if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
    return res.status((err as { status: number }).status).json({ message: (err as { message: string }).message });
  }

  return res.status(500).json({ message: 'Lỗi server' });
};

export const getProvinces = async (_req: Request, res: Response) => {
  try {
    const result = await locationService.getProvinces();
    return ok(res, result, 'Lấy danh sách tỉnh/thành phố thành công');
  } catch (err) {
    return handleError(res, err);
  }
};

export const getWards = async (req: Request, res: Response) => {
  const provinceCode = parseCode(req.params.provinceCode);
  if (!provinceCode) {
    return res.status(400).json({ message: 'Mã tỉnh/thành phố không hợp lệ' });
  }

  try {
    const result = await locationService.getWards(provinceCode);
    return ok(res, result, 'Lấy danh sách phường/xã thành công');
  } catch (err) {
    return handleError(res, err);
  }
};
