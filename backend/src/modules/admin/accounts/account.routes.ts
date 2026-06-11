import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.middleware';
import { authorize } from '../../../middlewares/role.middleware';
import * as accountController from './account.controller';

const accountRouter = Router();
const adminOnly = [authenticate, authorize('admin')];

accountRouter.get('/', adminOnly, accountController.listAccounts);
accountRouter.post('/staff', adminOnly, accountController.createStaffAccount);
accountRouter.patch('/:id/status', adminOnly, accountController.updateStaffStatus);
accountRouter.patch('/:id/permissions', adminOnly, accountController.updateStaffPermissions);
accountRouter.post('/:id/reset-password', adminOnly, accountController.resetStaffTemporaryPassword);

export default accountRouter;
