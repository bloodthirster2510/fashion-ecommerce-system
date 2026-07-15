import type { Request, Response } from 'express';
import { auditLogService } from '../../audit-logs/audit-log.service';
import {
  deleteFromCloudinary,
  extractPublicIdFromUrl,
  uploadToCloudinary,
} from '../../../utils/cloudinary.util';
import {
  StorefrontSettingsServiceError,
  storefrontSettingsService,
} from '../storefront-settings.service';
import {
  getAdminStorefrontSettings,
  getPublicStorefrontSettings,
  updateAdminStorefrontSettings,
} from '../storefront-settings.controller';

jest.mock('../storefront-settings.service', () => {
  class MockStorefrontSettingsServiceError extends Error {
    statusCode: number;

    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
    }
  }

  return {
    StorefrontSettingsServiceError: MockStorefrontSettingsServiceError,
    storefrontSettingsService: {
      getAdminSettings: jest.fn(),
      getPublicSettings: jest.fn(),
      updateSettings: jest.fn(),
    },
  };
});

jest.mock('../../audit-logs/audit-log.service', () => ({
  auditLogService: { recordAuditLogBestEffort: jest.fn() },
}));

jest.mock('../../../utils/cloudinary.util', () => ({
  uploadToCloudinary: jest.fn(),
  deleteFromCloudinary: jest.fn(),
  extractPublicIdFromUrl: jest.fn(() => 'fashion-ecommerce/storefront/old-avatar'),
}));

const mockedService = storefrontSettingsService as jest.Mocked<typeof storefrontSettingsService>;
const mockedAuditLogService = auditLogService as jest.Mocked<typeof auditLogService>;
const mockedUpload = uploadToCloudinary as jest.MockedFunction<typeof uploadToCloudinary>;
const mockedDelete = deleteFromCloudinary as jest.MockedFunction<typeof deleteFromCloudinary>;
const mockedExtractPublicId = extractPublicIdFromUrl as jest.MockedFunction<typeof extractPublicIdFromUrl>;

const configuredSettings = {
  configured: true,
  identity: { name: 'CD Shop', avatarUrl: '', legalName: '', taxCode: '', tagline: '', description: '' },
  contact: { phone: '', email: '', hours: '', address: '', mapUrl: '' },
  socials: [],
  version: 1,
  updatedAt: '2026-07-14T00:00:00.000Z',
};

const mockResponse = () => {
  const response = {
    set: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
  };
  response.set.mockReturnValue(response);
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response as unknown as jest.Mocked<Response>;
};

describe('storefront settings controller', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns public settings with shared-cache headers', async () => {
    mockedService.getPublicSettings.mockResolvedValue(configuredSettings);
    const response = mockResponse();

    await getPublicStorefrontSettings({} as Request, response);

    expect(response.set).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=300, stale-while-revalidate=86400',
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ message: 'Success', data: configuredSettings });
  });

  it('returns admin settings without allowing response caching', async () => {
    mockedService.getAdminSettings.mockResolvedValue(configuredSettings);
    const response = mockResponse();

    await getAdminStorefrontSettings({} as Request, response);

    expect(response.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it('maps known validation and conflict errors to their service status', async () => {
    mockedService.getPublicSettings.mockRejectedValue(
      new StorefrontSettingsServiceError('stale settings', 409),
    );
    const response = mockResponse();

    await getPublicStorefrontSettings({} as Request, response);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({ message: 'stale settings' });
  });

  it('does not expose unexpected service errors', async () => {
    mockedService.getPublicSettings.mockRejectedValue(new Error('database unavailable'));
    const response = mockResponse();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await getPublicStorefrontSettings({} as Request, response);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.not.stringContaining('database unavailable'),
    }));
    consoleError.mockRestore();
  });

  it('rejects an update when the authenticated admin identity is missing', async () => {
    const response = mockResponse();

    await updateAdminStorefrontSettings({ body: {} } as Request, response);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(mockedService.updateSettings).not.toHaveBeenCalled();
  });

  it('updates settings and records the before/after audit event', async () => {
    const before = { ...configuredSettings, version: 1 };
    const after = { ...configuredSettings, version: 2 };
    mockedService.getAdminSettings.mockResolvedValue(before);
    mockedService.updateSettings.mockResolvedValue(after);
    mockedAuditLogService.recordAuditLogBestEffort.mockResolvedValue(undefined);
    const response = mockResponse();
    const request = {
      body: { version: 1 },
      user: { userId: '665000000000000000000001', email: 'admin@example.com', role: 'admin' },
    } as Request;

    await updateAdminStorefrontSettings(request, response);

    expect(mockedService.updateSettings).toHaveBeenCalledWith(request.body, request.user?.userId);
    expect(mockedAuditLogService.recordAuditLogBestEffort).toHaveBeenCalledWith(expect.objectContaining({
      action: 'storefront_settings.update',
      actorRole: 'admin',
      before,
      after,
    }));
    expect(response.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it('uploads a replacement avatar and removes the previous Cloudinary image', async () => {
    const oldAvatarUrl = 'https://res.cloudinary.com/demo/image/upload/storefront/old-avatar.png';
    const newAvatarUrl = 'https://res.cloudinary.com/demo/image/upload/storefront/new-avatar.png';
    const before = {
      ...configuredSettings,
      identity: { ...configuredSettings.identity, avatarUrl: oldAvatarUrl },
    };
    const after = {
      ...configuredSettings,
      identity: { ...configuredSettings.identity, avatarUrl: newAvatarUrl },
      version: 2,
    };
    mockedService.getAdminSettings.mockResolvedValue(before);
    mockedService.updateSettings.mockResolvedValue(after);
    mockedUpload.mockResolvedValue({
      public_id: 'fashion-ecommerce/storefront/new-avatar',
      secure_url: newAvatarUrl,
      url: newAvatarUrl,
      width: 512,
      height: 512,
      format: 'png',
      bytes: 1024,
    });
    mockedDelete.mockResolvedValue(undefined);
    const response = mockResponse();
    const payload = {
      version: 1,
      identity: configuredSettings.identity,
      contact: configuredSettings.contact,
      socials: [],
    };
    const request = {
      body: { settings: JSON.stringify(payload) },
      file: { buffer: Buffer.from('avatar'), originalname: 'avatar.png' },
      user: { userId: '665000000000000000000001', email: 'admin@example.com', role: 'admin' },
    } as unknown as Request;

    await updateAdminStorefrontSettings(request, response);

    expect(mockedUpload).toHaveBeenCalledWith(
      request.file?.buffer,
      'avatar.png',
      'fashion-ecommerce/storefront',
    );
    expect(mockedService.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        identity: expect.objectContaining({ avatarUrl: newAvatarUrl }),
      }),
      request.user?.userId,
    );
    expect(mockedExtractPublicId).toHaveBeenCalledWith(oldAvatarUrl);
    expect(mockedDelete).toHaveBeenCalledWith('fashion-ecommerce/storefront/old-avatar');
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it('does not write an audit event when the update fails', async () => {
    mockedService.getAdminSettings.mockResolvedValue(configuredSettings);
    mockedService.updateSettings.mockRejectedValue(
      new StorefrontSettingsServiceError('conflict', 409),
    );
    const response = mockResponse();
    const request = {
      body: { version: 1 },
      user: { userId: '665000000000000000000001', email: 'admin@example.com', role: 'admin' },
    } as Request;

    await updateAdminStorefrontSettings(request, response);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(mockedAuditLogService.recordAuditLogBestEffort).not.toHaveBeenCalled();
  });
});
