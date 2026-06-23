import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtPayload } from '../utils/jwt';
import { User } from '../database/models/user.model';

declare module 'express' {
  interface Request {
    user?: JwtPayload;
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access token is required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired access token' });
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
