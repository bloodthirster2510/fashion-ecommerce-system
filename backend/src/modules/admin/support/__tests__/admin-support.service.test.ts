import { Types } from 'mongoose';
import { FaqArticle, SupportTicket, User } from '../../../../database/models';
import { createFaq, reorderFaqs, updateAdminTicket } from '../admin-support.service';

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
const firstFaqId = '665000000000000000000005';
const secondFaqId = '665000000000000000000006';
const omittedFaqId = '665000000000000000000007';
const adminActor = { userId: actorId, role: 'admin' as const };

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

describe('admin FAQ validation and ordering', () => {
  const createFaqSpy = jest.spyOn(FaqArticle, 'create');
  const findFaqSpy = jest.spyOn(FaqArticle, 'find');
  const bulkWriteFaqSpy = jest.spyOn(FaqArticle, 'bulkWrite');

  beforeEach(() => {
    jest.clearAllMocks();
    createFaqSpy.mockResolvedValue({ _id: new Types.ObjectId(firstFaqId) } as never);
    bulkWriteFaqSpy.mockResolvedValue({ matchedCount: 3 } as never);

    const storedFaqs = [
      { _id: new Types.ObjectId(firstFaqId), sortOrder: 0 },
      { _id: new Types.ObjectId(omittedFaqId), sortOrder: 0 },
      { _id: new Types.ObjectId(secondFaqId), sortOrder: 0 },
    ];
    const query: Record<string, jest.Mock> = {};
    query.select = jest.fn().mockReturnValue(query);
    query.sort = jest.fn().mockReturnValue(query);
    query.lean = jest.fn().mockResolvedValue(storedFaqs);
    findFaqSpy.mockReturnValue(query as never);
  });

  afterAll(() => {
    createFaqSpy.mockRestore();
    findFaqSpy.mockRestore();
    bulkWriteFaqSpy.mockRestore();
  });

  const validFaq = {
    question: 'Làm sao cập nhật thông tin tài khoản?',
    answer: 'Bạn mở trang hồ sơ và chọn chỉnh sửa thông tin.',
    category: 'account' as const,
  };

  it('rejects malformed keyword, publish, and sort-order values before writing', async () => {
    await expect(createFaq(adminActor, {
      ...validFaq,
      keywords: ['hồ sơ', 42] as unknown as string[],
    })).rejects.toMatchObject({ message: 'keywords are invalid', statusCode: 400 });

    await expect(createFaq(adminActor, {
      ...validFaq,
      isPublished: 'false' as unknown as boolean,
    })).rejects.toMatchObject({ message: 'isPublished must be boolean', statusCode: 400 });

    await expect(createFaq(adminActor, {
      ...validFaq,
      sortOrder: Number.POSITIVE_INFINITY,
    })).rejects.toMatchObject({ message: 'sortOrder must be a non-negative safe integer', statusCode: 400 });

    expect(createFaqSpy).not.toHaveBeenCalled();
  });

  it('rejects duplicate FAQ ids in a reorder request', async () => {
    await expect(reorderFaqs(adminActor, [firstFaqId, firstFaqId]))
      .rejects.toMatchObject({ message: 'orderedIds must contain unique FAQ ids', statusCode: 400 });

    expect(bulkWriteFaqSpy).not.toHaveBeenCalled();
  });

  it('preserves the existing global sort positions when reordering a filtered subset', async () => {
    await reorderFaqs(adminActor, [secondFaqId, firstFaqId]);

    expect(bulkWriteFaqSpy).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: { _id: new Types.ObjectId(secondFaqId) },
          update: { sortOrder: 0, updatedBy: expect.anything() },
        },
      },
      {
        updateOne: {
          filter: { _id: new Types.ObjectId(omittedFaqId) },
          update: { sortOrder: 1, updatedBy: expect.anything() },
        },
      },
      {
        updateOne: {
          filter: { _id: new Types.ObjectId(firstFaqId) },
          update: { sortOrder: 2, updatedBy: expect.anything() },
        },
      },
    ]);
  });
});
