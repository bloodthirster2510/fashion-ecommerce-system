import type { Request, Response } from 'express';
import { created, error, ok } from '../../utils/response';
import { cleanupSupportAttachments, uploadSupportAttachments } from './support-attachments';
import { SupportServiceError, supportService } from './support.service';
import type { CreateSupportTicketInput } from './support.types';

const actorId = (req: Request) => {
  if (!req.user?.userId) throw new SupportServiceError('Authentication required', 401);
  return req.user.userId;
};

const handleError = (res: Response, caught: unknown) => {
  if (caught instanceof SupportServiceError) return error(res, caught.message, caught.statusCode);
  console.error('Support request failed:', caught);
  return error(res, 'Unable to process support request', 500);
};

const numberQuery = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseContext = (value: unknown) => {
  if (!value) return null;
  if (typeof value === 'object') return value as CreateSupportTicketInput['context'];
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value) as CreateSupportTicketInput['context'];
  } catch {
    throw new SupportServiceError('context must be valid JSON');
  }
};

export const listPublicFaqs = async (req: Request, res: Response) => {
  try {
    return ok(res, await supportService.listFaqs({
      category: req.query.category as never,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      page: numberQuery(req.query.page, 1),
      limit: numberQuery(req.query.limit, 50),
    }));
  } catch (caught) {
    return handleError(res, caught);
  }
};

export const votePublicFaq = async (req: Request, res: Response) => {
  try {
    return ok(res, await supportService.voteFaq(req.params.id as string, actorId(req), req.body));
  } catch (caught) {
    return handleError(res, caught);
  }
};

export const createSupportTicket = async (req: Request, res: Response) => {
  let attachments: Awaited<ReturnType<typeof uploadSupportAttachments>> = [];
  try {
    attachments = await uploadSupportAttachments((req.files as Express.Multer.File[] | undefined) ?? []);
    const result = await supportService.createTicket(actorId(req), {
      ...req.body,
      requiresReply: req.body.requiresReply === undefined
        ? undefined
        : req.body.requiresReply === true || req.body.requiresReply === 'true',
      context: parseContext(req.body.context),
      attachments,
    });
    return created(res, result, 'Support ticket created');
  } catch (caught) {
    if (attachments.length) await cleanupSupportAttachments(attachments);
    return handleError(res, caught);
  }
};

export const listMySupportTickets = async (req: Request, res: Response) => {
  try {
    return ok(res, await supportService.listCustomerTickets(actorId(req), {
      page: numberQuery(req.query.page, 1),
      limit: numberQuery(req.query.limit, 20),
    }));
  } catch (caught) {
    return handleError(res, caught);
  }
};

export const getMySupportTicket = async (req: Request, res: Response) => {
  try {
    return ok(res, await supportService.getCustomerTicket(req.params.id as string, actorId(req)));
  } catch (caught) {
    return handleError(res, caught);
  }
};

export const addMySupportMessage = async (req: Request, res: Response) => {
  let attachments: Awaited<ReturnType<typeof uploadSupportAttachments>> = [];
  try {
    attachments = await uploadSupportAttachments((req.files as Express.Multer.File[] | undefined) ?? []);
    const result = await supportService.addCustomerMessage(req.params.id as string, actorId(req), {
      body: req.body.body,
      attachments,
    });
    return created(res, result, 'Message sent');
  } catch (caught) {
    if (attachments.length) await cleanupSupportAttachments(attachments);
    return handleError(res, caught);
  }
};

export const markMySupportTicketRead = async (req: Request, res: Response) => {
  try {
    return ok(res, await supportService.markCustomerRead(req.params.id as string, actorId(req)));
  } catch (caught) {
    return handleError(res, caught);
  }
};

export const reopenMySupportTicket = async (req: Request, res: Response) => {
  try {
    return ok(res, await supportService.reopenCustomerTicket(req.params.id as string, actorId(req)));
  } catch (caught) {
    return handleError(res, caught);
  }
};

export const closeMySupportTicket = async (req: Request, res: Response) => {
  try {
    return ok(res, await supportService.closeCustomerTicket(req.params.id as string, actorId(req)));
  } catch (caught) {
    return handleError(res, caught);
  }
};

export const getMySupportSummary = async (req: Request, res: Response) => {
  try {
    return ok(res, await supportService.getCustomerSupportSummary(actorId(req)));
  } catch (caught) {
    return handleError(res, caught);
  }
};
