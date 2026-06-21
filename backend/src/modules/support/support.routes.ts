import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { createRateLimitMiddleware } from '../../middlewares/security.middleware';
import { uploadMultiple, withMulterErrorHandling } from '../../middlewares/upload.middleware';
import {
  addMySupportMessage,
  closeMySupportTicket,
  createSupportTicket,
  getMySupportSummary,
  getMySupportTicket,
  listMySupportTickets,
  listPublicFaqs,
  markMySupportTicketRead,
  reopenMySupportTicket,
  votePublicFaq,
} from './support.controller';

const router = Router();
const ticketLimiter = createRateLimitMiddleware({ windowMs: 60_000, max: 10, keyPrefix: 'support-ticket-create' });
const messageLimiter = createRateLimitMiddleware({ windowMs: 60_000, max: 30, keyPrefix: 'support-message' });
const voteLimiter = createRateLimitMiddleware({ windowMs: 60_000, max: 20, keyPrefix: 'faq-vote' });
const supportUpload = withMulterErrorHandling(uploadMultiple.array('attachments', 3));

router.get('/faqs', listPublicFaqs);
router.post('/faqs/:id/vote', authenticate, voteLimiter, votePublicFaq);

router.use('/tickets', authenticate);
router.get('/tickets', listMySupportTickets);
router.post('/tickets', ticketLimiter, supportUpload, createSupportTicket);
router.get('/tickets/:id', getMySupportTicket);
router.post('/tickets/:id/messages', messageLimiter, supportUpload, addMySupportMessage);
router.patch('/tickets/:id/read', markMySupportTicketRead);
router.patch('/tickets/:id/reopen', reopenMySupportTicket);
router.patch('/tickets/:id/close', closeMySupportTicket);
router.get('/summary', authenticate, getMySupportSummary);

export default router;
