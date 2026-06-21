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
  listTickets,
  markTicketRead,
  reorderFaqs,
  replyTicket,
  updateFaq,
  updateCannedResponse,
  updateTicket,
} from './admin-support.controller';

const router = Router();
const guard = [authenticate, authorize('admin', 'staff'), requirePermission('support.reply')];
const replyLimiter = createRateLimitMiddleware({ windowMs: 60_000, max: 60, keyPrefix: 'admin-support-message' });
const supportUpload = withMulterErrorHandling(uploadMultiple.array('attachments', 3));

router.use(...guard);
router.get('/summary', getSummary);
router.get('/analytics', getAnalytics);
router.get('/canned-responses', listCannedResponses);
router.post('/canned-responses', createCannedResponse);
router.patch('/canned-responses/:id', updateCannedResponse);
router.delete('/canned-responses/:id', deleteCannedResponse);
router.get('/tickets', listTickets);
router.get('/tickets/:id', getTicket);
router.post('/tickets/:id/messages', replyLimiter, supportUpload, replyTicket);
router.patch('/tickets/:id', updateTicket);
router.patch('/tickets/:id/read', markTicketRead);
router.get('/faqs', listFaqs);
router.post('/faqs', createFaq);
router.patch('/faqs/reorder', reorderFaqs);
router.patch('/faqs/:id', updateFaq);
router.delete('/faqs/:id', deleteFaq);

export default router;
