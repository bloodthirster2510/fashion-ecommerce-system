import { Router, Request, Response } from 'express';
import * as userController from './user.controller';
import { authenticate, requireActiveAccount } from '../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../middlewares/role.middleware';
import { getUserMembership } from './membership.service';
import { User } from '../../database/models/user.model';
import { ok } from '../../utils/response';
import * as customerInsightController from './customer-insight.controller';

const customerUserRouter = Router();
const adminUserRouter = Router();
const canManageUsers = [authenticate, authorize('admin', 'staff')];
const adminOnly = [authenticate, authorize('admin')];
const canReadCustomers = [...canManageUsers, requirePermission('customers.read')];
const canManageCustomerStatus = [...canManageUsers, requirePermission('customers.manage')];

customerUserRouter.get('/me', authenticate, userController.getMe);
customerUserRouter.put('/me', authenticate, userController.updateMe);
customerUserRouter.post('/me/avatar', authenticate, userController.uploadAvatar);

customerUserRouter.get('/me/addresses', authenticate, userController.getAddresses);
customerUserRouter.post('/me/addresses', authenticate, userController.addAddress);
customerUserRouter.put('/me/addresses/:addressId', authenticate, userController.updateAddress);
customerUserRouter.delete('/me/addresses/:addressId', authenticate, userController.deleteAddress);
customerUserRouter.patch('/me/addresses/:addressId/default', authenticate, userController.setDefaultAddress);

customerUserRouter.get(
  '/me/membership',
  authenticate,
  requireActiveAccount,
  authorize('user'),
  async (req: Request, res: Response) => {
    const user = await User.findById(req.user!.userId).select('loyaltyPoint');
    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tồn tại' });
    }

    const result = await getUserMembership(req.user!.userId, user.loyaltyPoint);
    return ok(res, result);
  },
);

adminUserRouter.get('/', canReadCustomers, userController.getUsers);
adminUserRouter.get('/summary', canReadCustomers, userController.getCustomerSummary);
adminUserRouter.get('/:id/insights', canReadCustomers, customerInsightController.getCustomerInsights);
adminUserRouter.get('/:id/notes', canReadCustomers, customerInsightController.listCustomerNotes);
adminUserRouter.post('/:id/notes', canManageCustomerStatus, customerInsightController.createCustomerNote);
adminUserRouter.patch(
  '/:id/notes/:noteId',
  canManageCustomerStatus,
  customerInsightController.updateCustomerNote,
);
adminUserRouter.delete(
  '/:id/notes/:noteId',
  canManageCustomerStatus,
  customerInsightController.deleteCustomerNote,
);
adminUserRouter.get('/:id', canReadCustomers, userController.getUserById);
adminUserRouter.patch('/:id/status', canManageCustomerStatus, userController.updateUserStatus);
adminUserRouter.patch('/:id/role', adminOnly, userController.updateUserRole);
adminUserRouter.post('/:id/force-password-reset', canManageCustomerStatus, userController.forcePasswordReset);

export { adminUserRouter, customerUserRouter };
export default customerUserRouter;
