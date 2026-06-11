import { Request, Response, NextFunction } from 'express';
import { User, type StaffPermission } from '../database/models/user.model';

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
};

export const requirePermission = (permission: StaffPermission) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (req.user.role === 'admin') {
      return next();
    }

    if (req.user.role !== 'staff') {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const user = await User.findById(req.user.userId).select('permissions isActive').lean<{
      permissions?: StaffPermission[];
      isActive?: boolean;
    } | null>();

    if (!user?.isActive || !user.permissions?.includes(permission)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    return next();
  };
};
