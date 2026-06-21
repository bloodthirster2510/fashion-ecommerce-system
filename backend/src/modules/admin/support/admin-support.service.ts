import { Types } from 'mongoose';
import {
  FaqArticle,
  FAQ_CATEGORIES,
  Order,
  SupportMessage,
  SupportTicket,
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES,
  SUPPORT_TICKET_STATUSES,
  SUPPORT_TICKET_TYPES,
  User,
  type SupportTicketStatus,
} from '../../../database/models';
import { auditLogService } from '../../audit-logs/audit-log.service';
import { SupportServiceError, listFaqs } from '../../support/support.service';
import type {
  AdminSupportMessageInput,
  AdminTicketQuery,
  FaqPayload,
  UpdateSupportTicketInput,
} from '../../support/support.types';

type SupportActor = { userId: string; role: 'admin' | 'staff' };

const REOPEN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const transitions: Record<SupportTicketStatus, SupportTicketStatus[]> = {
  open: ['in_progress', 'waiting_customer', 'resolved', 'closed', 'spam'],
  in_progress: ['waiting_customer', 'resolved', 'closed', 'spam'],
  waiting_customer: ['in_progress', 'resolved', 'closed', 'spam'],
  resolved: ['in_progress', 'closed', 'spam'],
  closed: ['in_progress'],
  spam: [],
};

const objectId = (value: string, name: string) => {
  if (!Types.ObjectId.isValid(value)) throw new SupportServiceError(`${name} is invalid`);
  return new Types.ObjectId(value);
};

const pagination = (page = 1, limit = 20) => ({
  page: Math.max(1, Math.floor(page)),
  limit: Math.min(100, Math.max(1, Math.floor(limit))),
});

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const listAdminTickets = async (input: AdminTicketQuery = {}) => {
  const normalized = pagination(input.page, input.limit);
  const filter: Record<string, unknown> = {};
  if (input.status) {
    if (!SUPPORT_TICKET_STATUSES.includes(input.status)) throw new SupportServiceError('Status is invalid');
    filter.status = input.status;
  }
  if (input.type) {
    if (!SUPPORT_TICKET_TYPES.includes(input.type)) throw new SupportServiceError('Type is invalid');
    filter.type = input.type;
  }
  if (input.category) {
    if (!SUPPORT_CATEGORIES.includes(input.category)) throw new SupportServiceError('Category is invalid');
    filter.category = input.category;
  }
  if (input.priority) {
    if (!SUPPORT_PRIORITIES.includes(input.priority)) throw new SupportServiceError('Priority is invalid');
    filter.priority = input.priority;
  }
  if (input.assignedTo === 'unassigned') filter.assignedTo = null;
  else if (input.assignedTo) filter.assignedTo = objectId(input.assignedTo, 'assignedTo');
  if (typeof input.requiresReply === 'boolean') filter.requiresReply = input.requiresReply;
  if (typeof input.hasOrder === 'boolean') filter.orderId = input.hasOrder ? { $ne: null } : null;

  if (input.search?.trim()) {
    const regex = new RegExp(escapeRegex(input.search.trim().slice(0, 100)), 'i');
    const [users, orders] = await Promise.all([
      User.find({ $or: [{ name: regex }, { email: regex }, { phone: regex }] }).select('_id').limit(50).lean(),
      Order.find({ orderCode: regex }).select('_id').limit(50).lean(),
    ]);
    filter.$or = [
      { ticketCode: regex },
      { subject: regex },
      { userId: { $in: users.map((item) => item._id) } },
      { orderId: { $in: orders.map((item) => item._id) } },
    ];
  }

  const [items, totalItems] = await Promise.all([
    SupportTicket.find(filter)
      .sort({ requiresReply: -1, priority: -1, lastMessageAt: 1 })
      .skip((normalized.page - 1) * normalized.limit)
      .limit(normalized.limit)
      .populate('userId', 'name email phone avatarImage')
      .populate('assignedTo', 'name email')
      .lean(),
    SupportTicket.countDocuments(filter),
  ]);
  return { items, pagination: { ...normalized, totalItems, totalPages: Math.ceil(totalItems / normalized.limit) } };
};

export const getAdminTicket = async (ticketId: string) => {
  const id = objectId(ticketId, 'ticketId');
  const ticket = await SupportTicket.findById(id)
    .populate('userId', 'name email phone avatarImage membership loyaltyPoint')
    .populate('assignedTo', 'name email')
    .populate('orderId', 'orderCode status paymentMethod paymentStatus totalAmount shipping')
    .lean();
  if (!ticket) throw new SupportServiceError('Ticket not found', 404);
  const messages = await SupportMessage.find({ ticketId: id })
    .sort({ createdAt: 1 })
    .populate('senderId', 'name email role avatarImage')
    .lean();
  return { ticket, messages };
};

export const addAdminMessage = async (
  ticketId: string,
  actor: SupportActor,
  input: AdminSupportMessageInput,
) => {
  const id = objectId(ticketId, 'ticketId');
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  if (!body || body.length > 3000) throw new SupportServiceError('body must contain 1-3000 characters');
  const ticket = await SupportTicket.findById(id);
  if (!ticket) throw new SupportServiceError('Ticket not found', 404);
  if (ticket.status === 'spam' || ticket.status === 'closed') {
    throw new SupportServiceError('This ticket cannot receive messages', 409);
  }

  const message = await SupportMessage.create({
    ticketId: id,
    senderType: 'staff',
    senderId: objectId(actor.userId, 'actorId'),
    body,
    attachments: input.attachments ?? [],
    isInternal: Boolean(input.isInternal),
  });

  if (!input.isInternal) {
    const now = new Date();
    ticket.lastMessageAt = now;
    ticket.lastMessageSender = 'staff';
    ticket.requiresReply = false;
    ticket.firstResponseAt = ticket.firstResponseAt ?? now;
    if (ticket.status === 'open' || ticket.status === 'in_progress') ticket.status = 'waiting_customer';
    await ticket.save();
  }

  await auditLogService.recordAuditLogBestEffort({
    actorId: actor.userId,
    actorRole: actor.role,
    action: 'support_ticket.reply',
    targetType: 'SupportTicket',
    targetId: ticketId,
    metadata: { messageId: message._id.toString(), isInternal: Boolean(input.isInternal) },
  });
  return message.toObject();
};

export const updateAdminTicket = async (
  ticketId: string,
  actor: SupportActor,
  input: UpdateSupportTicketInput,
) => {
  const ticket = await SupportTicket.findById(objectId(ticketId, 'ticketId'));
  if (!ticket) throw new SupportServiceError('Ticket not found', 404);
  const before = {
    status: ticket.status,
    priority: ticket.priority,
    category: ticket.category,
    assignedTo: ticket.assignedTo?.toString() ?? null,
  };

  if (input.status && input.status !== ticket.status) {
    if (!SUPPORT_TICKET_STATUSES.includes(input.status)) throw new SupportServiceError('Status is invalid');
    const currentStatus = ticket.status as SupportTicketStatus;
    if (!transitions[currentStatus].includes(input.status)) {
      throw new SupportServiceError(`Cannot transition ticket from ${ticket.status} to ${input.status}`, 409);
    }
    if (input.status === 'spam' && actor.role !== 'admin') throw new SupportServiceError('Only admin can mark spam', 403);
    ticket.status = input.status;
    const now = new Date();
    if (input.status === 'resolved') {
      ticket.resolvedAt = now;
      ticket.reopenDeadline = new Date(now.getTime() + REOPEN_WINDOW_MS);
      ticket.requiresReply = false;
    } else if (input.status === 'closed') {
      ticket.closedAt = now;
      ticket.requiresReply = false;
    } else if (input.status === 'spam') {
      ticket.requiresReply = false;
    } else if (input.status === 'in_progress') {
      ticket.resolvedAt = null;
      ticket.closedAt = null;
      ticket.reopenDeadline = null;
    }
  }

  if (input.priority) {
    if (!SUPPORT_PRIORITIES.includes(input.priority)) throw new SupportServiceError('Priority is invalid');
    ticket.priority = input.priority;
  }
  if (input.category) {
    if (!SUPPORT_CATEGORIES.includes(input.category)) throw new SupportServiceError('Category is invalid');
    ticket.category = input.category;
  }
  if (input.assignedTo !== undefined) {
    if (input.assignedTo === null) ticket.assignedTo = null;
    else {
      const assigneeId = objectId(input.assignedTo, 'assignedTo');
      const assignee = await User.exists({ _id: assigneeId, role: { $in: ['admin', 'staff'] }, isActive: true });
      if (!assignee) throw new SupportServiceError('Assignee is not an active admin/staff member', 404);
      ticket.assignedTo = assigneeId;
    }
  }
  await ticket.save();

  const after = {
    status: ticket.status,
    priority: ticket.priority,
    category: ticket.category,
    assignedTo: ticket.assignedTo?.toString() ?? null,
  };
  await auditLogService.recordAuditLogBestEffort({
    actorId: actor.userId,
    actorRole: actor.role,
    action: before.status === after.status ? 'support_ticket.update' : 'support_ticket.status_update',
    targetType: 'SupportTicket',
    targetId: ticketId,
    before,
    after,
  });
  return ticket.toObject();
};

export const markAdminRead = async (ticketId: string) => {
  const ticket = await SupportTicket.findByIdAndUpdate(
    objectId(ticketId, 'ticketId'),
    { staffLastReadAt: new Date() },
    { new: true },
  ).lean();
  if (!ticket) throw new SupportServiceError('Ticket not found', 404);
  return ticket;
};

export const getAdminSupportSummary = async () => {
  const now = new Date();
  const needsReply = {
    status: { $in: ['open', 'in_progress', 'waiting_customer'] },
    lastMessageSender: 'customer',
    requiresReply: true,
  };
  const [totalOpen, waitingAdmin, waitingCustomer, resolved, unassigned, overdue] = await Promise.all([
    SupportTicket.countDocuments({ status: { $in: ['open', 'in_progress', 'waiting_customer'] } }),
    SupportTicket.countDocuments(needsReply),
    SupportTicket.countDocuments({ status: 'waiting_customer' }),
    SupportTicket.countDocuments({ status: 'resolved' }),
    SupportTicket.countDocuments({ ...needsReply, assignedTo: null }),
    SupportTicket.countDocuments({ ...needsReply, lastMessageAt: { $lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } }),
  ]);
  return { totalOpen, waitingAdmin, waitingCustomer, resolved, unassigned, overdue, generatedAt: now };
};

const cleanFaqPayload = (input: FaqPayload, partial = false) => {
  const payload: Record<string, unknown> = {};
  if (!partial || input.question !== undefined) {
    const question = input.question?.trim();
    if (!question || question.length < 5 || question.length > 300) throw new SupportServiceError('question must contain 5-300 characters');
    payload.question = question;
  }
  if (!partial || input.answer !== undefined) {
    const answer = input.answer?.trim();
    if (!answer || answer.length < 10 || answer.length > 5000) throw new SupportServiceError('answer must contain 10-5000 characters');
    payload.answer = answer;
  }
  if (!partial || input.category !== undefined) {
    if (!input.category || !FAQ_CATEGORIES.includes(input.category)) throw new SupportServiceError('category is invalid');
    payload.category = input.category;
  }
  if (input.keywords !== undefined) {
    if (!Array.isArray(input.keywords) || input.keywords.length > 20) throw new SupportServiceError('keywords are invalid');
    payload.keywords = [...new Set(input.keywords.map((item) => item.trim()).filter(Boolean))].slice(0, 20);
  }
  if (input.sortOrder !== undefined) payload.sortOrder = Math.max(0, Math.floor(input.sortOrder));
  if (input.isPublished !== undefined) {
    payload.isPublished = Boolean(input.isPublished);
    payload.publishedAt = input.isPublished ? new Date() : null;
  }
  return payload;
};

export const listAdminFaqs = (input: Parameters<typeof listFaqs>[0]) => listFaqs({ ...input, publishedOnly: false });

export const createFaq = async (actor: SupportActor, input: FaqPayload) => {
  const actorId = objectId(actor.userId, 'actorId');
  return FaqArticle.create({ ...cleanFaqPayload(input), createdBy: actorId, updatedBy: actorId });
};

export const updateFaq = async (faqId: string, actor: SupportActor, input: Partial<FaqPayload>) => {
  const updated = await FaqArticle.findByIdAndUpdate(
    objectId(faqId, 'faqId'),
    { ...cleanFaqPayload(input as FaqPayload, true), updatedBy: objectId(actor.userId, 'actorId') },
    { new: true, runValidators: true },
  ).lean();
  if (!updated) throw new SupportServiceError('FAQ not found', 404);
  return updated;
};

export const deleteFaq = async (faqId: string, actor: SupportActor) => {
  const faq = await FaqArticle.findById(objectId(faqId, 'faqId'));
  if (!faq) throw new SupportServiceError('FAQ not found', 404);
  if (faq.helpfulCount > 0 || faq.notHelpfulCount > 0) {
    faq.isPublished = false;
    faq.publishedAt = null;
    faq.updatedBy = objectId(actor.userId, 'actorId');
    await faq.save();
    return faq.toObject();
  }
  await faq.deleteOne();
  return { _id: faq._id, deleted: true };
};

export const reorderFaqs = async (actor: SupportActor, orderedIds: string[]) => {
  if (!Array.isArray(orderedIds) || orderedIds.length > 500) throw new SupportServiceError('orderedIds are invalid');
  const actorId = objectId(actor.userId, 'actorId');
  await FaqArticle.bulkWrite(orderedIds.map((id, index) => ({
    updateOne: { filter: { _id: objectId(id, 'faqId') }, update: { sortOrder: index, updatedBy: actorId } },
  })));
  return FaqArticle.find({ _id: { $in: orderedIds } }).sort({ sortOrder: 1 }).lean();
};

export const adminSupportService = {
  addAdminMessage,
  createFaq,
  deleteFaq,
  getAdminSupportSummary,
  getAdminTicket,
  listAdminFaqs,
  listAdminTickets,
  markAdminRead,
  reorderFaqs,
  updateAdminTicket,
  updateFaq,
};
