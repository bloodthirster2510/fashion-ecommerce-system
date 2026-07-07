import { Router } from 'express';
import { authenticate, requireActiveAccount } from '../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../middlewares/role.middleware';
import {
  cancelAdminJob,
  getAdminSettings,
  getAdminSummary,
  hideAdminJob,
  listAdminJobs,
  retryAdminJob,
  testAdminPrompt,
} from './virtual-try-on.controller';

const router = Router();

router.use(authenticate);
router.use(requireActiveAccount);
router.use(authorize('admin', 'staff'));

router.get('/summary', requirePermission('virtual_try_on.read'), getAdminSummary);
router.get('/settings', requirePermission('virtual_try_on.read'), getAdminSettings);
router.get('/jobs', requirePermission('virtual_try_on.read'), listAdminJobs);
router.post('/prompt/test', requirePermission('virtual_try_on.read'), testAdminPrompt);
router.post('/jobs/:jobId/retry', requirePermission('virtual_try_on.manage'), retryAdminJob);
router.post('/jobs/:jobId/cancel', requirePermission('virtual_try_on.manage'), cancelAdminJob);
router.delete('/jobs/:jobId', requirePermission('virtual_try_on.manage'), hideAdminJob);

export default router;
