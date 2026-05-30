import { Router, Request, Response } from 'express';
import * as userController from './user.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/role.middleware';
import { getUserMembership } from './membership.service';
import { User } from '../../database/models/user.model';
import { ok } from '../../utils/response';

const router = Router();

router.get('/me', authenticate, userController.getMe);
router.put('/me', authenticate, userController.updateMe);
router.post('/me/avatar', authenticate, userController.uploadAvatar);

router.get('/me/addresses', authenticate, userController.getAddresses);
router.post('/me/addresses', authenticate, userController.addAddress);
router.put('/me/addresses/:addressId', authenticate, userController.updateAddress);
router.delete('/me/addresses/:addressId', authenticate, userController.deleteAddress);
router.patch('/me/addresses/:addressId/default', authenticate, userController.setDefaultAddress);

router.get('/me/membership', authenticate, async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.userId).select('loyaltyPoint');
  if (!user) {
    return res.status(404).json({ message: 'Người dùng không tồn tại' });
  }
  const result = await getUserMembership(req.user!.userId, user.loyaltyPoint);
  return ok(res, result);
});

router.get('/', authenticate, authorize('admin', 'staff'), userController.getUsers);
router.get('/:id', authenticate, authorize('admin', 'staff'), userController.getUserById);
router.patch('/:id/status', authenticate, authorize('admin'), userController.updateUserStatus);
router.patch('/:id/role', authenticate, authorize('admin'), userController.updateUserRole);
router.post('/:id/force-password-reset', authenticate, authorize('admin'), userController.forcePasswordReset);

export default router;
