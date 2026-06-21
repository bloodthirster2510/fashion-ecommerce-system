import { createHash, randomBytes } from 'crypto';
import { Types } from 'mongoose';
import {
  Coupon,
  FaqArticle,
  FaqVote,
  FAQ_CATEGORIES,
  Order,
  SupportMessage,
  SupportTicket,
  SUPPORT_CATEGORIES,
  SUPPORT_TICKET_TYPES,
  type ISupportContext,
} from '../../database/models';
import type {
  AddSupportMessageInput,
  CreateSupportTicketInput,
  ListFaqInput,
  PaginationQuery,
  VoteFaqInput,
  CreateGuestFeedbackInput,
} from './support.types';
import { sendGuestFeedbackVerificationEmail } from '../../utils/email';
import { emitTicketMessage, emitTicketRead, emitTicketUpdated } from '../realtime/support.gateway';

export class SupportServiceError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
  }
}

const normalizePagination = ({ page = 1, limit = 20 }: PaginationQuery) => ({
  page: Math.max(1, Math.floor(page)),
  limit: Math.min(100, Math.max(1, Math.floor(limit))),
});

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const assertObjectId = (value: string, name: string) => {
  if (!Types.ObjectId.isValid(value)) throw new SupportServiceError(`${name} is invalid`);
  return new Types.ObjectId(value);
};

const cleanText = (value: unknown, name: string, min: number, max: number) => {
  if (typeof value !== 'string') throw new SupportServiceError(`${name} is required`);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new SupportServiceError(`${name} must contain ${min}-${max} characters`);
  }
  return normalized;
};

const sanitizeContext = (value?: Partial<ISupportContext> | null): ISupportContext | null => {
  if (!value) return null;
  const sources = ['support_home', 'order_detail', 'payment_result', 'coupon', 'loyalty', 'error_screen', 'footer'];
  if (!value.source || !sources.includes(value.source)) return null;

  const context: ISupportContext = { source: value.source };
  if (value.appPlatform && ['ios', 'android', 'web'].includes(value.appPlatform)) context.appPlatform = value.appPlatform;
  if (typeof value.appVersion === 'string') context.appVersion = value.appVersion.trim().slice(0, 40);
  if (typeof value.screen === 'string') context.screen = value.screen.trim().slice(0, 100);
  if (typeof value.errorCode === 'string') context.errorCode = value.errorCode.trim().slice(0, 100);
  return context;
};

const generateTicketCode = () => {
  const month = new Date().toISOString().slice(0, 7).replace('-', '');
  const suffix = randomBytes(5).toString('base64url').replace(/[_-]/g, '').slice(0, 6).toUpperCase();
  return `SUP-${month}-${suffix.padEnd(6, '0')}`;
};

export const listFaqs = async ({
  category,
  search,
  publishedOnly = true,
  ...paginationInput
}: ListFaqInput) => {
  const pagination = normalizePagination(paginationInput);
  const filter: Record<string, unknown> = {};
  if (publishedOnly) filter.isPublished = true;
  if (category) {
    if (!FAQ_CATEGORIES.includes(category)) throw new SupportServiceError('FAQ category is invalid');
    filter.category = category;
  }
  if (search?.trim()) {
    const regex = new RegExp(escapeRegex(search.trim().slice(0, 100)), 'i');
    filter.$or = [{ question: regex }, { answer: regex }, { keywords: regex }];
  }

  const [items, totalItems] = await Promise.all([
    FaqArticle.find(filter)
      .sort({ sortOrder: 1, createdAt: -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .lean(),
    FaqArticle.countDocuments(filter),
  ]);

  return {
    items,
    pagination: { ...pagination, totalItems, totalPages: Math.ceil(totalItems / pagination.limit) },
  };
};

export const voteFaq = async (faqId: string, userId: string, input: VoteFaqInput) => {
  const faqObjectId = assertObjectId(faqId, 'faqId');
  const userObjectId = assertObjectId(userId, 'userId');
  if (!['helpful', 'not_helpful'].includes(input.value)) throw new SupportServiceError('Vote value is invalid');
  const faq = await FaqArticle.findOne({ _id: faqObjectId, isPublished: true });
  if (!faq) throw new SupportServiceError('FAQ not found', 404);

  try {
    await FaqVote.create({ faqId: faqObjectId, userId: userObjectId, value: input.value });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new SupportServiceError('You already voted for this FAQ', 409);
    throw error;
  }

  const counter = input.value === 'helpful' ? 'helpfulCount' : 'notHelpfulCount';
  const updated = await FaqArticle.findByIdAndUpdate(faqObjectId, { $inc: { [counter]: 1 } }, { new: true }).lean();
  return updated;
};

const createTicketDocument = async (payload: Record<string, unknown>) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await SupportTicket.create({ ...payload, ticketCode: generateTicketCode() });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000 || attempt === 4) throw error;
    }
  }
  throw new SupportServiceError('Could not generate ticket code', 500);
};

export const createTicket = async (userId: string, input: CreateSupportTicketInput) => {
  const userObjectId = assertObjectId(userId, 'userId');
  if (!SUPPORT_TICKET_TYPES.includes(input.type)) throw new SupportServiceError('Ticket type is invalid');
  if (!SUPPORT_CATEGORIES.includes(input.category)) throw new SupportServiceError('Ticket category is invalid');
  const subject = cleanText(input.subject, 'subject', 5, 150);
  const body = cleanText(input.body, 'body', 10, 3000);
  const orderRequired = ['orders', 'returns', 'payments'].includes(input.category);
  let orderId: Types.ObjectId | null = null;

  if (input.orderId) {
    orderId = assertObjectId(input.orderId, 'orderId');
    const orderExists = await Order.exists({ _id: orderId, user_id: userObjectId });
    if (!orderExists) throw new SupportServiceError('Order not found for this customer', 404);
  } else if (orderRequired) {
    throw new SupportServiceError('orderId is required for this category');
  }

  const couponCode = input.couponCode?.trim().toUpperCase() || null;
  if (couponCode) {
    const couponExists = await Coupon.exists({ code: couponCode, deletedAt: null });
    if (!couponExists) throw new SupportServiceError('Coupon not found', 404);
  }

  const defaultRequiresReply = !['feedback', 'suggestion'].includes(input.type);
  const now = new Date();
  const ticket = await createTicketDocument({
    userId: userObjectId,
    type: input.type,
    category: input.category,
    subject,
    priority: input.type === 'complaint' ? 'high' : 'normal',
    requiresReply: input.requiresReply ?? defaultRequiresReply,
    orderId,
    couponCode,
    context: sanitizeContext(input.context),
    lastMessageAt: now,
    lastMessageSender: 'customer',
    customerLastReadAt: now,
  });

  try {
    await SupportMessage.create({
      ticketId: ticket._id,
      senderType: 'customer',
      senderId: userObjectId,
      body,
      attachments: input.attachments ?? [],
      isInternal: false,
    });
  } catch (error) {
    await SupportTicket.deleteOne({ _id: ticket._id });
    throw error;
  }

  const result = await getCustomerTicket(ticket._id.toString(), userId);
  emitTicketMessage(ticket._id.toString(), result.messages[result.messages.length - 1], { customerUserId: userId });
  emitTicketUpdated(ticket._id.toString(), result.ticket, { customerUserId: userId });
  return result;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const createGuestFeedback = async (input: CreateGuestFeedbackInput) => {
  if (input.website?.trim()) return { pendingVerification: true };
  if (!['feedback', 'suggestion'].includes(input.type)) throw new SupportServiceError('Guest submission must be feedback or suggestion');
  if (!SUPPORT_CATEGORIES.includes(input.category)) throw new SupportServiceError('Ticket category is invalid');
  const name = cleanText(input.name, 'name', 2, 100);
  const email = cleanText(input.email, 'email', 5, 254).toLowerCase();
  if (!emailPattern.test(email)) throw new SupportServiceError('email is invalid');
  const subject = cleanText(input.subject, 'subject', 5, 150);
  const body = cleanText(input.body, 'body', 10, 3000);
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const ticket = await createTicketDocument({
    userId: null,
    guestContact: {
      name,
      email,
      verificationTokenHash: createHash('sha256').update(token).digest('hex'),
      verificationExpiresAt: new Date(now.getTime() + 30 * 60 * 1000),
    },
    type: input.type,
    category: input.category,
    subject,
    status: 'pending_verification',
    priority: 'normal',
    requiresReply: false,
    context: { source: 'support_home', appPlatform: 'web' },
    lastMessageAt: now,
    lastMessageSender: 'customer',
  });
  try {
    await SupportMessage.create({ ticketId: ticket._id, senderType: 'customer', senderId: null, body, isInternal: false });
    const delivered = await sendGuestFeedbackVerificationEmail({ to: email, name, ticketCode: ticket.ticketCode, token });
    if (!delivered && process.env.NODE_ENV === 'production') {
      throw new SupportServiceError('Verification email is temporarily unavailable', 503);
    }
  } catch (error) {
    await Promise.all([SupportMessage.deleteMany({ ticketId: ticket._id }), SupportTicket.deleteOne({ _id: ticket._id })]);
    throw error;
  }
  return { pendingVerification: true, ticketCode: ticket.ticketCode };
};

export const verifyGuestFeedback = async (token: string) => {
  if (typeof token !== 'string' || token.length < 20) throw new SupportServiceError('Verification token is invalid');
  const now = new Date();
  const ticket = await SupportTicket.findOneAndUpdate(
    {
      status: 'pending_verification',
      'guestContact.verificationTokenHash': createHash('sha256').update(token).digest('hex'),
      'guestContact.verificationExpiresAt': { $gte: now },
    },
    {
      status: 'open',
      'guestContact.verifiedAt': now,
      'guestContact.verificationTokenHash': null,
      'guestContact.verificationExpiresAt': null,
    },
    { new: true },
  ).select('+guestContact.verificationTokenHash').lean();
  if (!ticket) throw new SupportServiceError('Verification link is invalid or expired', 410);
  return { verified: true, ticketCode: ticket.ticketCode };
};

export const listCustomerTickets = async (userId: string, input: PaginationQuery = {}) => {
  const userObjectId = assertObjectId(userId, 'userId');
  const pagination = normalizePagination(input);
  const filter = { userId: userObjectId, status: { $ne: 'spam' } };
  const [items, totalItems] = await Promise.all([
    SupportTicket.find(filter)
      .sort({ updatedAt: -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .lean(),
    SupportTicket.countDocuments(filter),
  ]);
  return { items, pagination: { ...pagination, totalItems, totalPages: Math.ceil(totalItems / pagination.limit) } };
};

export const getCustomerTicket = async (ticketId: string, userId: string) => {
  const ticketObjectId = assertObjectId(ticketId, 'ticketId');
  const userObjectId = assertObjectId(userId, 'userId');
  const ticket = await SupportTicket.findOne({ _id: ticketObjectId, userId: userObjectId, status: { $ne: 'spam' } }).lean();
  if (!ticket) throw new SupportServiceError('Ticket not found', 404);
  const messages = await SupportMessage.find({ ticketId: ticketObjectId, isInternal: false }).sort({ createdAt: 1 }).lean();
  return { ticket, messages };
};

export const addCustomerMessage = async (ticketId: string, userId: string, input: AddSupportMessageInput) => {
  const ticketObjectId = assertObjectId(ticketId, 'ticketId');
  const userObjectId = assertObjectId(userId, 'userId');
  const body = cleanText(input.body, 'body', 1, 3000);
  const ticket = await SupportTicket.findOne({ _id: ticketObjectId, userId: userObjectId });
  if (!ticket || ticket.status === 'spam') throw new SupportServiceError('Ticket not found', 404);
  if (ticket.status === 'closed') throw new SupportServiceError('Closed ticket cannot receive messages', 409);
  if (ticket.status === 'resolved' && (!ticket.reopenDeadline || ticket.reopenDeadline < new Date())) {
    throw new SupportServiceError('Reopen period has expired', 409);
  }

  const message = await SupportMessage.create({
    ticketId: ticketObjectId,
    senderType: 'customer',
    senderId: userObjectId,
    body,
    attachments: input.attachments ?? [],
    isInternal: false,
  });
  const now = new Date();
  ticket.status = ticket.status === 'open' ? 'open' : 'in_progress';
  ticket.requiresReply = true;
  ticket.lastMessageAt = now;
  ticket.lastMessageSender = 'customer';
  ticket.customerLastReadAt = now;
  ticket.resolvedAt = null;
  ticket.reopenDeadline = null;
  await ticket.save();
  const messageObj = message.toObject();
  emitTicketMessage(ticketId, messageObj, { customerUserId: userId });
  emitTicketUpdated(ticketId, ticket.toObject(), { customerUserId: userId });
  return messageObj;
};

export const markCustomerRead = async (ticketId: string, userId: string) => {
  const ticket = await SupportTicket.findOneAndUpdate(
    { _id: assertObjectId(ticketId, 'ticketId'), userId: assertObjectId(userId, 'userId'), status: { $ne: 'spam' } },
    { customerLastReadAt: new Date() },
    { new: true },
  ).lean();
  if (!ticket) throw new SupportServiceError('Ticket not found', 404);
  emitTicketRead(ticketId, 'customer');
  return ticket;
};

export const reopenCustomerTicket = async (ticketId: string, userId: string) => {
  const now = new Date();
  const ticket = await SupportTicket.findOneAndUpdate(
    {
      _id: assertObjectId(ticketId, 'ticketId'),
      userId: assertObjectId(userId, 'userId'),
      status: 'resolved',
      reopenDeadline: { $gte: now },
    },
    {
      status: 'in_progress',
      requiresReply: true,
      lastMessageSender: 'customer',
      lastMessageAt: now,
      resolvedAt: null,
      reopenDeadline: null,
    },
    { new: true },
  ).lean();
  if (!ticket) throw new SupportServiceError('Ticket cannot be reopened', 409);
  emitTicketUpdated(ticketId, ticket, { customerUserId: userId });
  return ticket;
};

export const closeCustomerTicket = async (ticketId: string, userId: string) => {
  const ticket = await SupportTicket.findOneAndUpdate(
    {
      _id: assertObjectId(ticketId, 'ticketId'),
      userId: assertObjectId(userId, 'userId'),
      status: { $nin: ['closed', 'spam'] },
    },
    { status: 'closed', closedAt: new Date(), requiresReply: false },
    { new: true },
  ).lean();
  if (!ticket) throw new SupportServiceError('Ticket cannot be closed', 409);
  emitTicketUpdated(ticketId, ticket, { customerUserId: userId });
  return ticket;
};

export const getCustomerSupportSummary = async (userId: string) => {
  const userObjectId = assertObjectId(userId, 'userId');
  const unreadFilter = {
    userId: userObjectId,
    status: { $nin: ['closed', 'spam'] },
    lastMessageSender: 'staff',
    $expr: { $gt: ['$lastMessageAt', { $ifNull: ['$customerLastReadAt', new Date(0)] }] },
  };
  const [unreadReplies, waitingCustomer, total] = await Promise.all([
    SupportTicket.countDocuments(unreadFilter),
    SupportTicket.countDocuments({
      userId: userObjectId,
      status: 'waiting_customer',
    }),
    SupportTicket.countDocuments({
      userId: userObjectId,
      status: { $nin: ['closed', 'spam'] },
      $or: [
        {
          lastMessageSender: 'staff',
          $expr: { $gt: ['$lastMessageAt', { $ifNull: ['$customerLastReadAt', new Date(0)] }] },
        },
        { status: 'waiting_customer' },
      ],
    }),
  ]);
  return { unreadReplies, waitingCustomer, total };
};

export const supportService = {
  addCustomerMessage,
  closeCustomerTicket,
  createTicket,
  createGuestFeedback,
  getCustomerSupportSummary,
  getCustomerTicket,
  listCustomerTickets,
  listFaqs,
  markCustomerRead,
  reopenCustomerTicket,
  voteFaq,
  verifyGuestFeedback,
};
