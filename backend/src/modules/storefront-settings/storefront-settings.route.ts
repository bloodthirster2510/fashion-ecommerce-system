import { Router } from 'express';
import { authenticate, requireActiveAccount } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/role.middleware';
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
adminStorefrontSettingsRouter.patch('/', updateAdminStorefrontSettings);

export { adminStorefrontSettingsRouter, storefrontSettingsRouter };
