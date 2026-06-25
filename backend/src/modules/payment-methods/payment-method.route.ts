import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../middlewares/role.middleware';
import {
  adminListUserPaymentMethods,
  adminRevealPaymentMethodAccountNumber,
  adminUpdatePaymentMethodStatus,
  createPaymentMethod,
  deletePaymentMethod,
  listPaymentMethods,
  setDefaultPaymentMethod,
  updatePaymentMethod,
} from './payment-method.controller';

const router = Router();
const adminPaymentMethodRouter = Router();

router.use(authenticate);
router.get('/', listPaymentMethods);
router.post('/', createPaymentMethod);
router.patch('/:id', updatePaymentMethod);
router.patch('/:id/default', setDefaultPaymentMethod);
router.delete('/:id', deletePaymentMethod);

adminPaymentMethodRouter.use(authenticate);
adminPaymentMethodRouter.use(authorize('admin', 'staff'));
adminPaymentMethodRouter.get(
  '/users/:userId/payment-methods',
  requirePermission('customers.read'),
  adminListUserPaymentMethods,
);
adminPaymentMethodRouter.patch(
  '/payment-methods/:id/status',
  requirePermission('customers.manage'),
  adminUpdatePaymentMethodStatus,
);
adminPaymentMethodRouter.post(
  '/payment-methods/:id/reveal-account',
  requirePermission('payments.adjust'),
  adminRevealPaymentMethodAccountNumber,
);

export { adminPaymentMethodRouter };
export default router;
