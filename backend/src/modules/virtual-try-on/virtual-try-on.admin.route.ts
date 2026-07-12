import { Router } from 'express';
import { authenticate, requireActiveAccount } from '../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../middlewares/role.middleware';
import {
  cancelAdminJob,
  createPromptRule,
  deletePromptRule,
  getAdminSettings,
  getAdminSummary,
  hideAdminJob,
  listAccountLocks,
  listAdminJobs,
  listPromptRules,
  lockAccount,
  retryAdminJob,
  testAdminPrompt,
  unlockAccount,
  updatePromptRule,
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

router.get('/prompt-rules', requirePermission('virtual_try_on.read'), listPromptRules);
router.post('/prompt-rules', requirePermission('virtual_try_on.manage'), createPromptRule);
router.patch('/prompt-rules/:ruleId', requirePermission('virtual_try_on.manage'), updatePromptRule);
router.delete('/prompt-rules/:ruleId', requirePermission('virtual_try_on.manage'), deletePromptRule);

router.get('/account-locks', requirePermission('virtual_try_on.read'), listAccountLocks);
router.post('/account-locks', requirePermission('virtual_try_on.manage'), lockAccount);
router.delete('/account-locks/:userId', requirePermission('virtual_try_on.manage'), unlockAccount);

export default router;
