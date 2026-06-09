import { Router, Request, Response } from 'express';
import * as userController from './user.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/role.middleware';
import { getUserMembership } from './membership.service';
import { User } from '../../database/models/user.model';
import { ok } from '../../utils/response';

const customerUserRouter = Router();
const adminUserRouter = Router();
const canManageUsers = [authenticate, authorize('admin', 'staff')];
const adminOnly = [authenticate, authorize('admin')];

customerUserRouter.get('/me', authenticate, userController.getMe);
customerUserRouter.put('/me', authenticate, userController.updateMe);
customerUserRouter.post('/me/avatar', authenticate, userController.uploadAvatar);

customerUserRouter.get('/me/addresses', authenticate, userController.getAddresses);
customerUserRouter.post('/me/addresses', authenticate, userController.addAddress);
customerUserRouter.put('/me/addresses/:addressId', authenticate, userController.updateAddress);
customerUserRouter.delete('/me/addresses/:addressId', authenticate, userController.deleteAddress);
customerUserRouter.patch('/me/addresses/:addressId/default', authenticate, userController.setDefaultAddress);

customerUserRouter.get('/me/membership', authenticate, async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.userId).select('loyaltyPoint');
  if (!user) {
    return res.status(404).json({ message: 'Người dùng không tồn tại' });
  }

  const result = await getUserMembership(req.user!.userId, user.loyaltyPoint);
  return ok(res, result);
});

adminUserRouter.get('/', canManageUsers, userController.getUsers);
adminUserRouter.get('/:id', canManageUsers, userController.getUserById);
adminUserRouter.patch('/:id/status', adminOnly, userController.updateUserStatus);
adminUserRouter.patch('/:id/role', adminOnly, userController.updateUserRole);
adminUserRouter.post('/:id/force-password-reset', adminOnly, userController.forcePasswordReset);

export { adminUserRouter, customerUserRouter };
export default customerUserRouter;
