import { Types } from 'mongoose';
import {
  FaqArticle,
  FAQ_CATEGORIES,
  Order,
  SupportMessage,
  SupportCannedResponse,
  SupportTicket,
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES,
  SUPPORT_TICKET_STATUSES,
  SUPPORT_TICKET_TYPES,
  User,
  type SupportTicketStatus,
} from '../../../database/models';
import { auditLogService } from '../../audit-logs/audit-log.service';
import { sendSupportReplyEmail } from '../../../utils/email';
import { pushNotificationService } from '../../notifications/push-notification.service';
import {
  SupportServiceError,
  listFaqs,
  toCustomerSupportMessage,
  toCustomerSupportTicket,
} from '../../support/support.service';
import { emitTicketMessage, emitTicketRead, emitTicketUpdated, emitSupportSummaryRefresh } from '../../realtime/support.gateway';
import type {
  AdminSupportMessageInput,
  AdminTicketQuery,
  CannedResponsePayload,
  FaqPayload,
  UpdateSupportTicketInput,
} from '../../support/support.types';

type SupportActor = { userId: string; role: 'admin' | 'staff' };

const REOPEN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const transitions: Record<SupportTicketStatus, SupportTicketStatus[]> = {
  pending_verification: [],
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
  const filter: Record<string, unknown> = { status: { $ne: 'pending_verification' } };
  if (input.status) {
    if (input.status === 'pending_verification' || !SUPPORT_TICKET_STATUSES.includes(input.status)) {
      throw new SupportServiceError('Status is invalid');
    }
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
  if (input.dateFrom || input.dateTo) {
    const createdAt: { $gte?: Date; $lte?: Date } = {};
    if (input.dateFrom) {
      const value = new Date(input.dateFrom);
      if (Number.isNaN(value.getTime())) throw new SupportServiceError('dateFrom is invalid');
      createdAt.$gte = value;
    }
    if (input.dateTo) {
      const value = new Date(input.dateTo);
      if (Number.isNaN(value.getTime())) throw new SupportServiceError('dateTo is invalid');
      value.setHours(23, 59, 59, 999);
      createdAt.$lte = value;
    }
    if (createdAt.$gte && createdAt.$lte && createdAt.$gte > createdAt.$lte) {
      throw new SupportServiceError('dateFrom must not be after dateTo');
    }
    filter.createdAt = createdAt;
  }

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
      { 'guestContact.name': regex },
      { 'guestContact.email': regex },
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
  if (ticket.status === 'pending_verification') throw new SupportServiceError('Ticket not found', 404);
  const messages = await SupportMessage.find({ ticketId: id })
    .sort({ createdAt: 1 })
    .populate('senderId', 'name email role avatarImage')
    .lean();
  return { ticket, messages };
};

export const listSupportAssignees = async () => User.find({
  isActive: true,
  $or: [
    { role: 'admin' },
    { role: 'staff', permissions: 'support.reply' },
  ],
}).select('_id name email role').sort({ role: 1, name: 1 }).lean();

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
  if (ticket.status === 'pending_verification') throw new SupportServiceError('Ticket not found', 404);
  if (ticket.status === 'spam' || ticket.status === 'closed' || ticket.status === 'resolved') {
    throw new SupportServiceError('This ticket cannot receive messages', 409);
  }
  let cannedResponseId: Types.ObjectId | null = null;
  if (input.cannedResponseId) {
    cannedResponseId = objectId(input.cannedResponseId, 'cannedResponseId');
    const canned = await SupportCannedResponse.exists({
      _id: cannedResponseId,
      isActive: true,
    });
    if (!canned) throw new SupportServiceError('Canned response not found', 404);
  }

  const message = await SupportMessage.create({
    ticketId: id,
    senderType: 'staff',
    senderId: objectId(actor.userId, 'actorId'),
    body,
    attachments: input.attachments ?? [],
    isInternal: Boolean(input.isInternal),
  });
  let effectiveTicket = ticket;
  if (!input.isInternal) {
    const messageAt = message.createdAt ?? new Date();
    const nextStatus = ticket.status === 'open' || ticket.status === 'in_progress'
      ? 'waiting_customer'
      : ticket.status;
    const updatedTicket = await SupportTicket.findOneAndUpdate(
      {
        _id: id,
        status: { $nin: ['pending_verification', 'spam', 'closed', 'resolved'] },
        lastMessageAt: { $lte: messageAt },
      },
      {
        $set: {
          lastMessageAt: messageAt,
          lastMessageSender: 'staff',
          requiresReply: false,
          firstResponseAt: ticket.firstResponseAt ?? messageAt,
          status: nextStatus,
        },
      },
      { returnDocument: 'after' },
    );

    if (updatedTicket) {
      effectiveTicket = updatedTicket;
    } else {
      const currentTicket = await SupportTicket.findById(id);
      if (!currentTicket || ['pending_verification', 'spam', 'closed', 'resolved'].includes(currentTicket.status)) {
        await SupportMessage.deleteOne({ _id: message._id });
        throw new SupportServiceError(
          currentTicket ? 'This ticket cannot receive messages' : 'Ticket not found',
          currentTicket ? 409 : 404,
        );
      }
      effectiveTicket = currentTicket;
    }

    const customer = effectiveTicket.userId
      ? await User.findById(effectiveTicket.userId).select('email').lean<{ email?: string } | null>()
      : null;
    const customerEmail = customer?.email || effectiveTicket.guestContact?.email;
    if (customerEmail) {
      await sendSupportReplyEmail({
        to: customerEmail,
        ticketId: effectiveTicket._id.toString(),
        ticketCode: effectiveTicket.ticketCode,
        subject: effectiveTicket.subject,
        reply: body,
        isGuest: !effectiveTicket.userId,
      });
    }
    if (effectiveTicket.userId) {
      await pushNotificationService.sendSupportReplyPush({
        userId: effectiveTicket.userId.toString(),
        ticketId: effectiveTicket._id.toString(),
        ticketCode: effectiveTicket.ticketCode,
        subject: effectiveTicket.subject,
        messageId: message._id.toString(),
      }).catch((error) => {
        console.error('Failed to send support reply push:', error instanceof Error ? error.message : String(error));
      });
    }
  }
  if (cannedResponseId) await SupportCannedResponse.updateOne({ _id: cannedResponseId }, { $inc: { useCount: 1 } });

  await auditLogService.recordAuditLogBestEffort({
    actorId: actor.userId,
    actorRole: actor.role,
    action: 'support_ticket.reply',
    targetType: 'SupportTicket',
    targetId: ticketId,
    metadata: { messageId: message._id.toString(), isInternal: Boolean(input.isInternal) },
  });
  const messageObj = message.toObject();
  emitTicketMessage(ticketId, messageObj, {
    isInternal: Boolean(input.isInternal),
    customerUserId: effectiveTicket.userId?.toString() ?? null,
    customerMessage: toCustomerSupportMessage(messageObj),
  });
  if (!input.isInternal) {
    const ticketObj = effectiveTicket.toObject();
    emitTicketUpdated(ticketId, ticketObj, {
      customerUserId: effectiveTicket.userId?.toString() ?? null,
      customerTicket: toCustomerSupportTicket(ticketObj),
    });
    emitSupportSummaryRefresh();
  }
  return messageObj;
};

export const updateAdminTicket = async (
  ticketId: string,
  actor: SupportActor,
  input: UpdateSupportTicketInput,
) => {
  const ticket = await SupportTicket.findById(objectId(ticketId, 'ticketId'));
  if (!ticket) throw new SupportServiceError('Ticket not found', 404);
  if (ticket.status === 'pending_verification') throw new SupportServiceError('Ticket not found', 404);
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
    if (input.status === 'waiting_customer' && ticket.lastMessageSender !== 'staff') {
      throw new SupportServiceError('Reply to the customer before setting waiting customer', 409);
    }
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
      ticket.requiresReply = ticket.lastMessageSender === 'customer';
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
      const assignee = await User.exists({
        _id: assigneeId,
        isActive: true,
        $or: [
          { role: 'admin' },
          { role: 'staff', permissions: 'support.reply' },
        ],
      });
      if (!assignee) throw new SupportServiceError('Assignee is not an active support admin/staff member', 404);
      ticket.assignedTo = assigneeId;
    }
  }
  if (
    !input.status
    && input.assignedTo !== undefined
    && input.assignedTo !== null
    && ticket.status === 'open'
  ) {
    ticket.status = 'in_progress';
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
  const ticketObj = ticket.toObject();
  emitTicketUpdated(ticketId, ticketObj, {
    customerUserId: ticket.userId?.toString() ?? null,
    customerTicket: toCustomerSupportTicket(ticketObj),
  });
  if (before.status !== after.status) emitSupportSummaryRefresh();
  return ticketObj;
};

export const markAdminRead = async (ticketId: string) => {
  const ticket = await SupportTicket.findOneAndUpdate(
    { _id: objectId(ticketId, 'ticketId'), status: { $ne: 'pending_verification' } },
    { staffLastReadAt: new Date() },
    { returnDocument: 'after' },
  ).lean();
  if (!ticket) throw new SupportServiceError('Ticket not found', 404);
  emitTicketRead(ticketId, 'admin');
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

const dateRange = (dateFrom?: string, dateTo?: string) => {
  const createdAt: { $gte?: Date; $lte?: Date } = {};
  if (dateFrom) {
    const value = new Date(dateFrom);
    if (Number.isNaN(value.getTime())) throw new SupportServiceError('dateFrom is invalid');
    createdAt.$gte = value;
  }
  if (dateTo) {
    const value = new Date(dateTo);
    if (Number.isNaN(value.getTime())) throw new SupportServiceError('dateTo is invalid');
    value.setHours(23, 59, 59, 999);
    createdAt.$lte = value;
  }
  return { status: { $ne: 'pending_verification' }, ...(Object.keys(createdAt).length ? { createdAt } : {}) };
};

export const getSupportAnalytics = async (dateFrom?: string, dateTo?: string) => {
  const match = dateRange(dateFrom, dateTo);
  const [ticketStats, byCategory, byType, dailyVolume, faq] = await Promise.all([
    SupportTicket.aggregate([
      { $match: match },
      { $group: {
        _id: null,
        total: { $sum: 1 },
        open: { $sum: { $cond: [{ $in: ['$status', ['open', 'in_progress', 'waiting_customer']] }, 1, 0] } },
        resolved: { $sum: { $cond: [{ $in: ['$status', ['resolved', 'closed']] }, 1, 0] } },
        responded: { $sum: { $cond: ['$firstResponseAt', 1, 0] } },
        avgFirstResponseMs: { $avg: { $cond: ['$firstResponseAt', { $subtract: ['$firstResponseAt', '$createdAt'] }, null] } },
        avgResolutionMs: { $avg: { $cond: ['$resolvedAt', { $subtract: ['$resolvedAt', '$createdAt'] }, null] } },
      } },
    ]),
    SupportTicket.aggregate([{ $match: match }, { $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    SupportTicket.aggregate([{ $match: match }, { $group: { _id: '$type', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    SupportTicket.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { date: '$createdAt', format: '%Y-%m-%d' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    FaqArticle.aggregate([{ $group: { _id: null, helpful: { $sum: '$helpfulCount' }, notHelpful: { $sum: '$notHelpfulCount' } } }]),
  ]);
  const tickets = ticketStats[0] ?? { total: 0, open: 0, resolved: 0, responded: 0, avgFirstResponseMs: 0, avgResolutionMs: 0 };
  const votes = faq[0] ?? { helpful: 0, notHelpful: 0 };
  const totalVotes = votes.helpful + votes.notHelpful;
  return {
    tickets,
    byCategory: byCategory.map((item) => ({ key: item._id, count: item.count })),
    byType: byType.map((item) => ({ key: item._id, count: item.count })),
    dailyVolume: dailyVolume.map((item) => ({ date: item._id, count: item.count })),
    faq: { ...votes, totalVotes, helpfulRate: totalVotes ? votes.helpful / totalVotes : 0 },
    generatedAt: new Date(),
  };
};

const cleanCannedResponse = (input: Partial<CannedResponsePayload>, partial = false) => {
  const payload: Record<string, unknown> = {};
  if (!partial || input.title !== undefined) {
    const title = input.title?.trim();
    if (!title || title.length < 2 || title.length > 100) throw new SupportServiceError('title must contain 2-100 characters');
    payload.title = title;
  }
  if (!partial || input.body !== undefined) {
    const body = input.body?.trim();
    if (!body || body.length < 2 || body.length > 3000) throw new SupportServiceError('body must contain 2-3000 characters');
    payload.body = body;
  }
  if (input.category !== undefined) {
    if (input.category !== null && !SUPPORT_CATEGORIES.includes(input.category)) throw new SupportServiceError('category is invalid');
    payload.category = input.category;
  }
  if (input.isActive !== undefined) payload.isActive = Boolean(input.isActive);
  return payload;
};

export const listCannedResponses = (activeOnly = false) => SupportCannedResponse
  .find(activeOnly ? { isActive: true } : {})
  .sort({ category: 1, title: 1 })
  .lean();

export const createCannedResponse = (actor: SupportActor, input: CannedResponsePayload) => {
  const actorId = objectId(actor.userId, 'actorId');
  return SupportCannedResponse.create({ ...cleanCannedResponse(input), createdBy: actorId, updatedBy: actorId });
};

export const updateCannedResponse = async (id: string, actor: SupportActor, input: Partial<CannedResponsePayload>) => {
  const updated = await SupportCannedResponse.findByIdAndUpdate(
    objectId(id, 'cannedResponseId'),
    { ...cleanCannedResponse(input, true), updatedBy: objectId(actor.userId, 'actorId') },
    { returnDocument: 'after', runValidators: true },
  ).lean();
  if (!updated) throw new SupportServiceError('Canned response not found', 404);
  return updated;
};

export const deleteCannedResponse = async (id: string) => {
  const deleted = await SupportCannedResponse.findByIdAndDelete(objectId(id, 'cannedResponseId')).lean();
  if (!deleted) throw new SupportServiceError('Canned response not found', 404);
  return { _id: deleted._id, deleted: true };
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
    { returnDocument: 'after', runValidators: true },
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
  createCannedResponse,
  createFaq,
  deleteFaq,
  deleteCannedResponse,
  getAdminSupportSummary,
  getSupportAnalytics,
  getAdminTicket,
  listAdminFaqs,
  listAdminTickets,
  listSupportAssignees,
  listCannedResponses,
  markAdminRead,
  reorderFaqs,
  updateAdminTicket,
  updateCannedResponse,
  updateFaq,
};
