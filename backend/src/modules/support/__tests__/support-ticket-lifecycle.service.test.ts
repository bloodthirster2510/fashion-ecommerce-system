import { SupportTicket } from '../../../database/models';
import { closeExpiredResolvedTickets } from '../support-ticket-lifecycle.service';

jest.mock('../../../database/models', () => ({
  SupportTicket: { updateMany: jest.fn() },
}));

const mockedSupportTicket = SupportTicket as jest.Mocked<typeof SupportTicket>;

describe('support ticket lifecycle service', () => {
  it('closes resolved tickets after their reopen deadline', async () => {
    const now = new Date('2026-06-21T00:00:00.000Z');
    mockedSupportTicket.updateMany.mockResolvedValue({ modifiedCount: 3 } as never);

    await expect(closeExpiredResolvedTickets(now)).resolves.toEqual({ closedCount: 3 });
    expect(mockedSupportTicket.updateMany).toHaveBeenCalledWith(
      { status: 'resolved', reopenDeadline: { $ne: null, $lte: now } },
      { $set: { status: 'closed', closedAt: now, requiresReply: false, reopenDeadline: null } },
    );
  });
});
