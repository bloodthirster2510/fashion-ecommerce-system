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
  listPromptViolations,
  listPromptRules,
  lockAccount,
  retryAdminJob,
  retryAdminVideo,
  rollbackAdminSettings,
  testAdminPrompt,
  unlockAccount,
  updateAdminSettings,
  updatePromptRule,
} from './virtual-try-on.controller';

const router = Router();

router.use(authenticate);
router.use(requireActiveAccount);
router.use(authorize('admin', 'staff'));

router.get('/summary', requirePermission('virtual_try_on.read'), getAdminSummary);
router.get('/settings', requirePermission('virtual_try_on.settings'), getAdminSettings);
router.patch('/settings', requirePermission('virtual_try_on.settings'), updateAdminSettings);
router.post('/settings/rollback', requirePermission('virtual_try_on.settings'), rollbackAdminSettings);
router.get('/jobs', requirePermission('virtual_try_on.read'), listAdminJobs);
router.post('/prompt/test', requirePermission('virtual_try_on.settings'), testAdminPrompt);
router.post('/jobs/:jobId/retry', requirePermission('virtual_try_on.manage'), retryAdminJob);
router.post('/jobs/:jobId/video/retry', requirePermission('virtual_try_on.manage'), retryAdminVideo);
router.post('/jobs/:jobId/cancel', requirePermission('virtual_try_on.manage'), cancelAdminJob);
router.delete('/jobs/:jobId', requirePermission('virtual_try_on.manage'), hideAdminJob);

router.get('/prompt-violations', requirePermission('virtual_try_on.manage'), listPromptViolations);
router.get('/prompt-rules', requirePermission('virtual_try_on.settings'), listPromptRules);
router.post('/prompt-rules', requirePermission('virtual_try_on.settings'), createPromptRule);
router.patch('/prompt-rules/:ruleId', requirePermission('virtual_try_on.settings'), updatePromptRule);
router.delete('/prompt-rules/:ruleId', requirePermission('virtual_try_on.settings'), deletePromptRule);

router.get('/account-locks', requirePermission('virtual_try_on.manage'), listAccountLocks);
router.post('/account-locks', requirePermission('virtual_try_on.manage'), lockAccount);
router.delete('/account-locks/:userId', requirePermission('virtual_try_on.manage'), unlockAccount);

export default router;
