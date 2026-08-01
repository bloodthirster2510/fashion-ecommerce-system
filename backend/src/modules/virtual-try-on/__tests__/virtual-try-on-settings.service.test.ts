import { Types } from 'mongoose';
import { VirtualTryOnSettings } from '../../../database/models';
import { auditLogService } from '../../audit-logs/audit-log.service';
import {
  virtualTryOnSettingsService,
  VirtualTryOnSettingsServiceError,
} from '../virtual-try-on-settings.service';

jest.mock('../../../database/models', () => ({
  VirtualTryOnSettings: {
    create: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));

jest.mock('../../audit-logs/audit-log.service', () => ({
  auditLogService: {
    recordAuditLogBestEffort: jest.fn(),
  },
}));

const mockedSettings = VirtualTryOnSettings as jest.Mocked<typeof VirtualTryOnSettings>;
const mockedAudit = auditLogService as jest.Mocked<typeof auditLogService>;
const actor = {
  actorId: new Types.ObjectId('665000000000000000000301').toString(),
  actorRole: 'admin' as const,
};
const configuration = {
  enabled: true,
  maxConcurrentJobsPerUser: 2,
  maxVideoJobsPerUserPerDay: 5,
  maxConcurrentVideoJobsPerUser: 1,
  promptMaxLength: 240,
  promptViolationLimitPerDay: 4,
};
const previousConfiguration = {
  ...configuration,
  enabled: false,
  maxConcurrentJobsPerUser: 1,
};
const updatedAt = new Date('2026-07-29T02:00:00.000Z');

const mockFindOne = (value: unknown) => {
  mockedSettings.findOne.mockReturnValue({
    lean: jest.fn().mockResolvedValue(value),
  } as never);
};

const mockFindOneAndUpdate = (value: unknown) => {
  mockedSettings.findOneAndUpdate.mockReturnValue({
    lean: jest.fn().mockResolvedValue(value),
  } as never);
};

describe('virtualTryOnSettingsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAudit.recordAuditLogBestEffort.mockResolvedValue(undefined);
  });

  it('returns bounded environment defaults without persisting secrets', async () => {
    mockFindOne(null);

    const result = await virtualTryOnSettingsService.getRuntimeSettings();

    expect(result).toMatchObject({
      version: 0,
      persisted: false,
      historyVersions: [],
    });
    expect(result).not.toHaveProperty('apiKey');
    expect(result).not.toHaveProperty('endpoint');
  });

  it('rejects invalid configuration before writing', async () => {
    await expect(virtualTryOnSettingsService.updateSettings({
      expectedVersion: 0,
      configuration: { ...configuration, promptMaxLength: 501 },
    }, actor)).rejects.toBeInstanceOf(VirtualTryOnSettingsServiceError);

    expect(mockedSettings.create).not.toHaveBeenCalled();
  });

  it.each([
    ['a null update body', null],
    ['an array update body', []],
  ])('rejects %s as a validation error', async (_label, input) => {
    await expect(virtualTryOnSettingsService.updateSettings(input as never, actor))
      .rejects.toMatchObject({ statusCode: 400 });

    expect(mockedSettings.findOne).not.toHaveBeenCalled();
    expect(mockedSettings.create).not.toHaveBeenCalled();
  });

  it.each([
    ['a null rollback body', null],
    ['an array rollback body', []],
  ])('rejects %s as a validation error', async (_label, input) => {
    await expect(virtualTryOnSettingsService.rollbackSettings(input as never, actor))
      .rejects.toMatchObject({ statusCode: 400 });

    expect(mockedSettings.findOne).not.toHaveBeenCalled();
    expect(mockedSettings.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('creates the singleton at version one and records an audit event', async () => {
    mockFindOne(null);
    const created = {
      key: 'virtual_try_on',
      ...configuration,
      version: 1,
      history: [],
      updatedAt,
    };
    mockedSettings.create.mockResolvedValue({
      ...created,
      toObject: () => created,
    } as never);

    const result = await virtualTryOnSettingsService.updateSettings({
      expectedVersion: 0,
      configuration,
    }, actor);

    expect(result).toMatchObject({ version: 1, persisted: true });
    expect(mockedSettings.create).toHaveBeenCalledWith(expect.objectContaining({
      key: 'virtual_try_on',
      version: 1,
      updatedBy: expect.any(Types.ObjectId),
    }));
    expect(mockedAudit.recordAuditLogBestEffort).toHaveBeenCalledWith(expect.objectContaining({
      action: 'virtual_try_on.settings_update',
      metadata: { fromVersion: 0, toVersion: 1 },
    }));
  });

  it('uses the expected version in the atomic update and reports conflicts', async () => {
    mockFindOne({
      key: 'virtual_try_on',
      ...configuration,
      version: 3,
      history: [],
      updatedAt,
      updatedBy: new Types.ObjectId(actor.actorId),
    });
    mockFindOneAndUpdate(null);

    await expect(virtualTryOnSettingsService.updateSettings({
      expectedVersion: 3,
      configuration: { ...configuration, maxConcurrentJobsPerUser: 3 },
    }, actor)).rejects.toMatchObject({ statusCode: 409 });

    expect(mockedSettings.findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'virtual_try_on', version: 3 },
      expect.objectContaining({
        $inc: { version: 1 },
        $push: expect.objectContaining({
          history: expect.objectContaining({ $slice: -20 }),
        }),
      }),
      { returnDocument: 'after', runValidators: true },
    );
  });

  it('rolls back a retained snapshot as a new audited version', async () => {
    const current = {
      key: 'virtual_try_on',
      ...configuration,
      version: 2,
      history: [{
        version: 1,
        configuration: previousConfiguration,
        changedBy: null,
        changedAt: new Date('2026-07-28T02:00:00.000Z'),
      }],
      updatedAt,
      updatedBy: new Types.ObjectId(actor.actorId),
    };
    mockFindOne(current);
    mockFindOneAndUpdate({
      ...current,
      ...previousConfiguration,
      version: 3,
      history: [
        ...current.history,
        {
          version: 2,
          configuration,
          changedBy: current.updatedBy,
          changedAt: updatedAt,
        },
      ],
    });

    const result = await virtualTryOnSettingsService.rollbackSettings({
      expectedVersion: 2,
      targetVersion: 1,
    }, actor);

    expect(result).toMatchObject({
      version: 3,
      enabled: false,
      maxConcurrentJobsPerUser: 1,
    });
    expect(mockedSettings.findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'virtual_try_on', version: 2 },
      expect.objectContaining({
        $set: expect.objectContaining(previousConfiguration),
        $inc: { version: 1 },
      }),
      { returnDocument: 'after', runValidators: true },
    );
    expect(mockedAudit.recordAuditLogBestEffort).toHaveBeenCalledWith(expect.objectContaining({
      action: 'virtual_try_on.settings_rollback',
      metadata: { fromVersion: 2, targetVersion: 1, toVersion: 3 },
    }));
  });
});
