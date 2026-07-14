import { Router } from 'express';
import { authenticate, requireActiveAccount } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/role.middleware';
import { upload, withMulterErrorHandling } from '../../middlewares/upload.middleware';
import {
  getAdminStorefrontSettings,
  getPublicStorefrontSettings,
  updateAdminStorefrontSettings,
} from './storefront-settings.controller';

const storefrontSettingsRouter = Router();
const adminStorefrontSettingsRouter = Router();

storefrontSettingsRouter.get('/settings', getPublicStorefrontSettings);

adminStorefrontSettingsRouter.use(authenticate, requireActiveAccount, authorize('admin'));
adminStorefrontSettingsRouter.get('/', getAdminStorefrontSettings);
adminStorefrontSettingsRouter.patch(
  '/',
  withMulterErrorHandling(upload.single('avatar')),
  updateAdminStorefrontSettings,
);

export { adminStorefrontSettingsRouter, storefrontSettingsRouter };
