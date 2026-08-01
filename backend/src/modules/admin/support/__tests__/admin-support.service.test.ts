import { Types } from 'mongoose';
import { SupportTicket, User } from '../../../../database/models';
import { updateAdminTicket } from '../admin-support.service';

jest.mock('../../../audit-logs/audit-log.service', () => ({
  auditLogService: { recordAuditLogBestEffort: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../../realtime/support.gateway', () => ({
  emitTicketMessage: jest.fn(),
  emitTicketRead: jest.fn(),
  emitTicketUpdated: jest.fn(),
  emitSupportSummaryRefresh: jest.fn(),
}));

const actorId = '665000000000000000000001';
const ticketId = '665000000000000000000002';
const assigneeId = '665000000000000000000003';

describe('admin support assignment rules', () => {
  const findTicketSpy = jest.spyOn(SupportTicket, 'findById');
  const findAssigneeSpy = jest.spyOn(User, 'exists');

  beforeEach(() => {
    jest.clearAllMocks();
    findTicketSpy.mockResolvedValue({
      _id: new Types.ObjectId(ticketId),
      status: 'open',
      priority: 'normal',
      category: 'other',
      assignedTo: null,
      lastMessageSender: 'customer',
      userId: new Types.ObjectId('665000000000000000000004'),
      save: jest.fn().mockResolvedValue(undefined),
      toObject: jest.fn().mockReturnValue({ _id: ticketId, status: 'in_progress' }),
    } as never);
  });

  afterAll(() => {
    findTicketSpy.mockRestore();
    findAssigneeSpy.mockRestore();
  });

  it('rejects an active staff assignee who lacks support.reply permission', async () => {
    findAssigneeSpy.mockReturnValue(null as never);

    await expect(updateAdminTicket(
      ticketId,
      { userId: actorId, role: 'admin' },
      { assignedTo: assigneeId },
    )).rejects.toMatchObject({
      message: 'Assignee is not an active support admin/staff member',
      statusCode: 404,
    });

    expect(findAssigneeSpy).toHaveBeenCalledWith({
      _id: expect.any(Types.ObjectId),
      isActive: true,
      $or: [
        { role: 'admin' },
        { role: 'staff', permissions: 'support.reply' },
      ],
    });
  });
});
