import { AuditLog } from '../../../database/models';
import { auditLogService } from '../audit-log.service';

jest.mock('../../../database/models', () => ({
  AuditLog: {
    create: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

const mockedAuditLog = AuditLog as jest.Mocked<typeof AuditLog>;

const input = {
  actorRole: 'system' as const,
  action: 'order.status_update' as const,
  targetType: 'order',
  targetId: 'ORDER-CODE-1',
};

describe('auditLogService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('retries best-effort audit log recording once after a transient failure', async () => {
    mockedAuditLog.create
      .mockRejectedValueOnce(new Error('temporary write error'))
      .mockResolvedValueOnce({ _id: 'audit-log-id' } as never);

    await auditLogService.recordAuditLogBestEffort(input);

    expect(mockedAuditLog.create).toHaveBeenCalledTimes(2);
  });

  it('logs and does not throw when both best-effort audit log attempts fail', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockedAuditLog.create
      .mockRejectedValueOnce(new Error('first write error'))
      .mockRejectedValueOnce(new Error('retry write error'));

    await expect(auditLogService.recordAuditLogBestEffort(input)).resolves.toBeUndefined();

    expect(mockedAuditLog.create).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to record audit log after retry:', {
      firstError: 'first write error',
      retryError: 'retry write error',
    });
  });
});
