import { Request, Response, NextFunction } from 'express';
import {
  verifyAccessToken,
  wasTokenIssuedBeforePasswordChange,
  JwtPayload,
} from '../utils/jwt';
import { User } from '../database/models/user.model';

declare module 'express' {
  interface Request {
    user?: JwtPayload;
  }
}

type TokenAccountState = {
  mustChangePassword?: boolean;
  passwordChangedAt?: Date | null;
};

const getTokenAccountState = (userId: string) =>
  User.findById(userId)
    .select('mustChangePassword passwordChangedAt')
    .lean<TokenAccountState | null>();

const canUseTokenWhilePasswordChangeIsRequired = (req: Request) =>
  req.baseUrl.endsWith('/auth')
  && ['/change-password', '/logout'].includes(req.path);

const validateTokenAccountState = async (req: Request, res: Response, payload: JwtPayload) => {
  const account = await getTokenAccountState(payload.userId);
  if (!account || wasTokenIssuedBeforePasswordChange(payload, account.passwordChangedAt)) {
    res.status(401).json({ message: 'Access token has been revoked' });
    return false;
  }
  if (account.mustChangePassword && !canUseTokenWhilePasswordChangeIsRequired(req)) {
    res.status(403).json({
      message: 'Password change is required',
      errorCode: 'MUST_CHANGE_PASSWORD',
    });
    return false;
  }
  return true;
};

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access token is required' });
  }

  const token = authHeader.split(' ')[1];

  let decoded: JwtPayload;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired access token' });
  }

  try {
    if (!await validateTokenAccountState(req, res, decoded)) return;
    req.user = decoded;
    return next();
  } catch {
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const optionalAuthenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next();
  }

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];

  let decoded: JwtPayload;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired access token' });
  }

  try {
    if (!await validateTokenAccountState(req, res, decoded)) return;
    req.user = decoded;
    return next();
  } catch {
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const requireActiveAccount = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    // JWT chỉ phản ánh trạng thái tại thời điểm đăng nhập.
    // Kiểm tra lại DB ở route nhạy cảm để khóa tài khoản/đổi role có hiệu lực ngay.
    const user = await User.findById(req.user.userId).select('role isActive').lean<{
      role: string;
      isActive: boolean;
    } | null>();

    // Chặn token cũ nếu tài khoản bị vô hiệu hóa hoặc quyền trong DB đã thay đổi.
    if (!user?.isActive || user.role !== req.user.role) {
      return res.status(403).json({ message: 'Account is inactive or permissions have changed' });
    }

    return next();
  } catch {
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const requireActiveAccountIfAuthenticated = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user) return next();
  return requireActiveAccount(req, res, next);
};
