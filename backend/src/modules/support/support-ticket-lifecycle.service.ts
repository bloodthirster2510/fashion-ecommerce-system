import { SupportTicket } from '../../database/models';

export const closeExpiredResolvedTickets = async (now = new Date()) => {
  const result = await SupportTicket.updateMany(
    {
      status: 'resolved',
      reopenDeadline: { $ne: null, $lte: now },
    },
    {
      $set: {
        status: 'closed',
        closedAt: now,
        requiresReply: false,
        reopenDeadline: null,
      },
    },
  );

  return { closedCount: result.modifiedCount };
};

export const supportTicketLifecycleService = { closeExpiredResolvedTickets };
