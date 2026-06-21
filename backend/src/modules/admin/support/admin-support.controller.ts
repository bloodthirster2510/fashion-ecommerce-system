import type { Request, Response } from 'express';
import { created, error, ok } from '../../../utils/response';
import { cleanupSupportAttachments, uploadSupportAttachments } from '../../support/support-attachments';
import { SupportServiceError } from '../../support/support.service';
import { adminSupportService } from './admin-support.service';

const actor = (req: Request) => {
  if (!req.user?.userId || !['admin', 'staff'].includes(req.user.role)) {
    throw new SupportServiceError('Authentication required', 401);
  }
  return { userId: req.user.userId, role: req.user.role as 'admin' | 'staff' };
};

const handleError = (res: Response, caught: unknown) => {
  if (caught instanceof SupportServiceError) return error(res, caught.message, caught.statusCode);
  console.error('Admin support request failed:', caught);
  return error(res, 'Unable to process admin support request', 500);
};

const numberQuery = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const booleanQuery = (value: unknown) => value === 'true' ? true : value === 'false' ? false : undefined;

export const listTickets = async (req: Request, res: Response) => {
  try {
    return ok(res, await adminSupportService.listAdminTickets({
      page: numberQuery(req.query.page, 1),
      limit: numberQuery(req.query.limit, 20),
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      status: req.query.status as never,
      type: req.query.type as never,
      category: req.query.category as never,
      priority: req.query.priority as never,
      assignedTo: typeof req.query.assignedTo === 'string' ? req.query.assignedTo : undefined,
      requiresReply: booleanQuery(req.query.requiresReply),
      hasOrder: booleanQuery(req.query.hasOrder),
    }));
  } catch (caught) {
    return handleError(res, caught);
  }
};

export const getTicket = async (req: Request, res: Response) => {
  try {
    return ok(res, await adminSupportService.getAdminTicket(req.params.id as string));
  } catch (caught) {
    return handleError(res, caught);
  }
};

export const replyTicket = async (req: Request, res: Response) => {
  let attachments: Awaited<ReturnType<typeof uploadSupportAttachments>> = [];
  try {
    attachments = await uploadSupportAttachments((req.files as Express.Multer.File[] | undefined) ?? []);
    const result = await adminSupportService.addAdminMessage(req.params.id as string, actor(req), {
      body: req.body.body,
      isInternal: req.body.isInternal === true || req.body.isInternal === 'true',
      cannedResponseId: typeof req.body.cannedResponseId === 'string' ? req.body.cannedResponseId : undefined,
      attachments,
    });
    return created(res, result, 'Reply sent');
  } catch (caught) {
    if (attachments.length) await cleanupSupportAttachments(attachments);
    return handleError(res, caught);
  }
};

export const updateTicket = async (req: Request, res: Response) => {
  try {
    return ok(res, await adminSupportService.updateAdminTicket(req.params.id as string, actor(req), req.body));
  } catch (caught) {
    return handleError(res, caught);
  }
};

export const markTicketRead = async (req: Request, res: Response) => {
  try {
    actor(req);
    return ok(res, await adminSupportService.markAdminRead(req.params.id as string));
  } catch (caught) {
    return handleError(res, caught);
  }
};

export const getSummary = async (_req: Request, res: Response) => {
  try {
    return ok(res, await adminSupportService.getAdminSupportSummary());
  } catch (caught) {
    return handleError(res, caught);
  }
};

export const getAnalytics = async (req: Request, res: Response) => {
  try {
    return ok(res, await adminSupportService.getSupportAnalytics(
      typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined,
      typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined,
    ));
  } catch (caught) {
    return handleError(res, caught);
  }
};

export const listCannedResponses = async (req: Request, res: Response) => {
  try {
    return ok(res, await adminSupportService.listCannedResponses(req.query.activeOnly === 'true'));
  } catch (caught) {
    return handleError(res, caught);
  }
};

export const createCannedResponse = async (req: Request, res: Response) => {
  try {
    return created(res, await adminSupportService.createCannedResponse(actor(req), req.body));
  } catch (caught) {
    return handleError(res, caught);
  }
};

export const updateCannedResponse = async (req: Request, res: Response) => {
  try {
    return ok(res, await adminSupportService.updateCannedResponse(req.params.id as string, actor(req), req.body));
  } catch (caught) {
    return handleError(res, caught);
  }
};

export const deleteCannedResponse = async (req: Request, res: Response) => {
  try {
    actor(req);
    return ok(res, await adminSupportService.deleteCannedResponse(req.params.id as string));
  } catch (caught) {
    return handleError(res, caught);
  }
};

export const listFaqs = async (req: Request, res: Response) => {
  try {
    return ok(res, await adminSupportService.listAdminFaqs({
      page: numberQuery(req.query.page, 1),
      limit: numberQuery(req.query.limit, 100),
      category: req.query.category as never,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
    }));
  } catch (caught) {
    return handleError(res, caught);
  }
};

export const createFaq = async (req: Request, res: Response) => {
  try {
    return created(res, await adminSupportService.createFaq(actor(req), req.body));
  } catch (caught) {
    return handleError(res, caught);
  }
};

export const updateFaq = async (req: Request, res: Response) => {
  try {
    return ok(res, await adminSupportService.updateFaq(req.params.id as string, actor(req), req.body));
  } catch (caught) {
    return handleError(res, caught);
  }
};

export const deleteFaq = async (req: Request, res: Response) => {
  try {
    return ok(res, await adminSupportService.deleteFaq(req.params.id as string, actor(req)));
  } catch (caught) {
    return handleError(res, caught);
  }
};

export const reorderFaqs = async (req: Request, res: Response) => {
  try {
    return ok(res, await adminSupportService.reorderFaqs(actor(req), req.body.orderedIds));
  } catch (caught) {
    return handleError(res, caught);
  }
};
