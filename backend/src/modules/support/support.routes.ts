import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { createRateLimitMiddleware } from '../../middlewares/security.middleware';
import { uploadMultiple, withMulterErrorHandling } from '../../middlewares/upload.middleware';
import {
  addMySupportMessage,
  closeMySupportTicket,
  createSupportTicket,
  createGuestFeedback,
  getMySupportSummary,
  getMySupportTicket,
  listMySupportTickets,
  listPublicFaqs,
  markMySupportTicketRead,
  reopenMySupportTicket,
  votePublicFaq,
  registerMyPushToken,
  unregisterMyPushToken,
  verifyGuestFeedback,
} from './support.controller';

const router = Router();
const ticketLimiter = createRateLimitMiddleware({ windowMs: 60_000, max: 10, keyPrefix: 'support-ticket-create' });
const messageLimiter = createRateLimitMiddleware({ windowMs: 60_000, max: 30, keyPrefix: 'support-message' });
const voteLimiter = createRateLimitMiddleware({ windowMs: 60_000, max: 20, keyPrefix: 'faq-vote' });
const supportUpload = withMulterErrorHandling(uploadMultiple.array('attachments', 3));
const guestFeedbackLimiter = createRateLimitMiddleware({ windowMs: 60 * 60_000, max: 5, keyPrefix: 'guest-feedback' });

router.get('/faqs', listPublicFaqs);
router.post('/faqs/:id/vote', authenticate, voteLimiter, votePublicFaq);
router.post('/guest-feedback', guestFeedbackLimiter, createGuestFeedback);
router.get('/guest-feedback/verify', guestFeedbackLimiter, verifyGuestFeedback);

router.use('/tickets', authenticate);
router.get('/tickets', listMySupportTickets);
router.post('/tickets', ticketLimiter, supportUpload, createSupportTicket);
router.get('/tickets/:id', getMySupportTicket);
router.post('/tickets/:id/messages', messageLimiter, supportUpload, addMySupportMessage);
router.patch('/tickets/:id/read', markMySupportTicketRead);
router.patch('/tickets/:id/reopen', reopenMySupportTicket);
router.patch('/tickets/:id/close', closeMySupportTicket);
router.get('/summary', authenticate, getMySupportSummary);
router.post('/push-token', authenticate, registerMyPushToken);
router.delete('/push-token', authenticate, unregisterMyPushToken);

export default router;
