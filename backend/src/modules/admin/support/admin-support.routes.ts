import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../../middlewares/role.middleware';
import { createRateLimitMiddleware } from '../../../middlewares/security.middleware';
import { uploadMultiple, withMulterErrorHandling } from '../../../middlewares/upload.middleware';
import {
  createFaq,
  createCannedResponse,
  deleteCannedResponse,
  deleteFaq,
  getSummary,
  getAnalytics,
  getTicket,
  listFaqs,
  listCannedResponses,
  listAssignees,
  listTickets,
  markTicketRead,
  reorderFaqs,
  replyTicket,
  updateFaq,
  updateCannedResponse,
  updateTicket,
} from './admin-support.controller';

const router = Router();
const replyLimiter = createRateLimitMiddleware({ windowMs: 60_000, max: 60, keyPrefix: 'admin-support-message' });
const supportUpload = withMulterErrorHandling(uploadMultiple.array('attachments', 3));

router.use(authenticate, authorize('admin', 'staff'));

router.get('/summary', requirePermission('support.reply'), getSummary);
router.get('/assignees', requirePermission('support.reply'), listAssignees);
router.get('/tickets', requirePermission('support.reply'), listTickets);
router.get('/tickets/:id', requirePermission('support.reply'), getTicket);
router.post('/tickets/:id/messages', requirePermission('support.reply'), replyLimiter, supportUpload, replyTicket);
router.patch('/tickets/:id', requirePermission('support.reply'), updateTicket);
router.patch('/tickets/:id/read', requirePermission('support.reply'), markTicketRead);

router.get('/analytics', requirePermission('support.manage'), getAnalytics);
router.get('/canned-responses', requirePermission('support.manage'), listCannedResponses);
router.post('/canned-responses', requirePermission('support.manage'), createCannedResponse);
router.patch('/canned-responses/:id', requirePermission('support.manage'), updateCannedResponse);
router.delete('/canned-responses/:id', requirePermission('support.manage'), deleteCannedResponse);
router.get('/faqs', requirePermission('support.manage'), listFaqs);
router.post('/faqs', requirePermission('support.manage'), createFaq);
router.patch('/faqs/reorder', requirePermission('support.manage'), reorderFaqs);
router.patch('/faqs/:id', requirePermission('support.manage'), updateFaq);
router.delete('/faqs/:id', requirePermission('support.manage'), deleteFaq);

export default router;
