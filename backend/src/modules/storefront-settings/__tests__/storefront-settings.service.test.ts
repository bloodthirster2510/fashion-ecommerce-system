import { Types } from 'mongoose';
import { StorefrontSettings } from '../../../database/models/storefront-settings.model';
import {
  StorefrontSettingsServiceError,
  normalizeStorefrontSettingsInput,
  storefrontSettingsService,
  type StorefrontSettingsInput,
} from '../storefront-settings.service';

jest.mock('../../../database/models/storefront-settings.model', () => ({
  storefrontSocialPlatforms: ['facebook', 'instagram', 'tiktok', 'youtube', 'zalo', 'other'],
  StorefrontSettings: {
    create: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));

const mockedStorefrontSettings = StorefrontSettings as jest.Mocked<typeof StorefrontSettings>;
const actorId = new Types.ObjectId('665000000000000000000301').toString();

const validInput = (overrides: Partial<StorefrontSettingsInput> = {}): StorefrontSettingsInput => ({
  version: 0,
  identity: {
    name: 'CD Shop',
    avatarUrl: 'https://res.cloudinary.com/demo/image/upload/storefront/avatar.png',
    legalName: 'CD Shop Company',
    taxCode: '0123456789',
    tagline: 'Wear your style',
    description: 'Modern fashion.',
  },
  contact: {
    phone: '0123 456 789',
    email: 'shop@example.com',
    hours: '08:30 - 21:45',
    address: 'District 1, Ho Chi Minh City',
    mapUrl: 'https://maps.google.com/example',
  },
  socials: [
    { platform: 'facebook', label: 'Facebook', url: 'https://facebook.com/cdshop', enabled: true, sortOrder: 0 },
  ],
  ...overrides,
});

const storedSettings = (overrides: Record<string, unknown> = {}) => ({
  key: 'storefront',
  identity: validInput().identity,
  contact: validInput().contact,
  socials: validInput().socials,
  version: 2,
  updatedAt: new Date('2026-07-14T00:00:00.000Z'),
  ...overrides,
});

describe('normalizeStorefrontSettingsInput', () => {
  it.each([
    ['a non-object payload', null],
    ['a null version', validInput({ version: null })],
    ['a string version', validInput({ version: '1' })],
    ['a boolean version', validInput({ version: false })],
    ['an invalid version', validInput({ version: -1 })],
    ['a fractional version', validInput({ version: 1.5 })],
    ['missing identity data', validInput({ identity: undefined })],
    ['missing contact data', validInput({ contact: undefined })],
    ['missing social data', validInput({ socials: undefined })],
    ['a short shop name', validInput({ identity: { ...validInput().identity, name: 'A' } })],
    ['a non-HTTPS avatar link', validInput({ identity: { ...validInput().identity, avatarUrl: 'http://example.com/avatar.png' } })],
    ['an invalid tax code', validInput({ identity: { ...validInput().identity, taxCode: '12 34' } })],
    ['a tax code without letters or digits', validInput({ identity: { ...validInput().identity, taxCode: '---' } })],
    ['an invalid phone number', validInput({ contact: { ...validInput().contact, phone: 'call-me' } })],
    ['a phone number without digits', validInput({ contact: { ...validInput().contact, phone: '-------' } })],
    ['an invalid email', validInput({ contact: { ...validInput().contact, email: 'not-an-email' } })],
    ['a non-HTTPS map link', validInput({ contact: { ...validInput().contact, mapUrl: 'http://maps.example.com' } })],
    ['a malformed social item', validInput({ socials: [null as never] })],
    ['a non-boolean social visibility flag', validInput({ socials: [{ platform: 'facebook', label: 'Facebook', url: 'https://facebook.com/cdshop', enabled: 'yes' as never }] })],
    ['an unknown social platform', validInput({ socials: [{ platform: 'myspace', label: 'MySpace', url: 'https://example.com' }] })],
    ['a short social label', validInput({ socials: [{ platform: 'other', label: 'A', url: 'https://example.com' }] })],
    ['a non-HTTPS social link', validInput({ socials: [{ platform: 'facebook', label: 'Facebook', url: 'http://facebook.com/cdshop' }] })],
  ])('rejects %s', (_label, payload) => {
    expect(() => normalizeStorefrontSettingsInput(payload as StorefrontSettingsInput))
      .toThrow(StorefrontSettingsServiceError);
  });

  it('rejects more than twelve social links', () => {
    const socials = Array.from({ length: 13 }, (_, index) => ({
      platform: 'other',
      label: `Link ${index}`,
      url: `https://example.com/${index}`,
    }));

    expect(() => normalizeStorefrontSettingsInput(validInput({ socials })))
      .toThrow(StorefrontSettingsServiceError);
  });

  it('rejects duplicate known social platforms', () => {
    expect(() => normalizeStorefrontSettingsInput(validInput({
      socials: [
        { platform: 'facebook', label: 'Main Facebook', url: 'https://facebook.com/cdshop' },
        { platform: 'facebook', label: 'Backup Facebook', url: 'https://facebook.com/cdshop-2' },
      ],
    }))).toThrow(StorefrontSettingsServiceError);
  });

  it('normalizes fields, permits multiple custom links, and derives display order', () => {
    const normalized = normalizeStorefrontSettingsInput(validInput({
      identity: { ...validInput().identity, name: '  CD Shop  ' },
      contact: { ...validInput().contact, email: '  SHOP@EXAMPLE.COM  ' },
      socials: [
        { platform: 'OTHER', label: ' Website ', url: 'https://example.com/shop' },
        { platform: 'other', label: 'Community', url: 'https://community.example.com', enabled: false },
      ],
    }));

    expect(normalized.identity.name).toBe('CD Shop');
    expect(normalized.contact.email).toBe('shop@example.com');
    expect(normalized.socials).toEqual([
      expect.objectContaining({ platform: 'other', label: 'Website', enabled: true, sortOrder: 0 }),
      expect.objectContaining({ platform: 'other', label: 'Community', enabled: false, sortOrder: 1 }),
    ]);
  });
});

describe('storefrontSettingsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an unconfigured fallback when no document exists', async () => {
    mockedStorefrontSettings.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    } as never);

    const settings = await storefrontSettingsService.getAdminSettings();

    expect(settings.configured).toBe(false);
    expect(settings.version).toBe(0);
    expect(settings.identity.name).toBeTruthy();
  });

  it('serializes configured settings and sorts social links', async () => {
    mockedStorefrontSettings.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(storedSettings({
        socials: [
          { platform: 'instagram', label: 'Instagram', url: 'https://instagram.com/shop', enabled: true, sortOrder: 2 },
          { platform: 'facebook', label: 'Facebook', url: 'https://facebook.com/shop', enabled: false, sortOrder: 0 },
        ],
      })),
    } as never);

    const settings = await storefrontSettingsService.getAdminSettings();

    expect(settings).toMatchObject({ configured: true, version: 2, updatedAt: '2026-07-14T00:00:00.000Z' });
    expect(settings.socials.map((social) => social.platform)).toEqual(['facebook', 'instagram']);
  });

  it('hides disabled social links from the public response', async () => {
    mockedStorefrontSettings.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(storedSettings({
        socials: [
          { platform: 'facebook', label: 'Facebook', url: 'https://facebook.com/shop', enabled: false, sortOrder: 0 },
          { platform: 'instagram', label: 'Instagram', url: 'https://instagram.com/shop', enabled: true, sortOrder: 1 },
        ],
      })),
    } as never);

    const settings = await storefrontSettingsService.getPublicSettings();

    expect(settings.socials).toEqual([
      expect.objectContaining({ platform: 'instagram', enabled: true }),
    ]);
  });

  it('rejects an invalid administrator id', async () => {
    await expect(storefrontSettingsService.updateSettings(validInput(), 'invalid-id'))
      .rejects.toMatchObject({ statusCode: 401 });
    expect(mockedStorefrontSettings.create).not.toHaveBeenCalled();
  });

  it('creates the singleton at version one', async () => {
    const createdSettings = storedSettings({ version: 1 });
    mockedStorefrontSettings.create.mockResolvedValue({
      ...createdSettings,
      toObject: () => createdSettings,
    } as never);

    const settings = await storefrontSettingsService.updateSettings(validInput(), actorId);

    expect(settings.configured).toBe(true);
    expect(settings.version).toBe(1);
    expect(mockedStorefrontSettings.create).toHaveBeenCalledWith(expect.objectContaining({
      key: 'storefront',
      version: 1,
      updatedBy: expect.any(Types.ObjectId),
    }));
  });

  it('converts a competing singleton create into a conflict', async () => {
    mockedStorefrontSettings.create.mockRejectedValue({ code: 11000 });

    await expect(storefrontSettingsService.updateSettings(validInput(), actorId))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  it('does not hide unexpected create failures', async () => {
    const databaseError = new Error('database unavailable');
    mockedStorefrontSettings.create.mockRejectedValue(databaseError);

    await expect(storefrontSettingsService.updateSettings(validInput(), actorId))
      .rejects.toBe(databaseError);
  });

  it('updates the matching version and increments it atomically', async () => {
    mockedStorefrontSettings.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockResolvedValue(storedSettings({ version: 5 })),
    } as never);

    const settings = await storefrontSettingsService.updateSettings(validInput({ version: 4 }), actorId);

    expect(settings.version).toBe(5);
    expect(mockedStorefrontSettings.findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'storefront', version: 4 },
      expect.objectContaining({
        $set: expect.objectContaining({ updatedBy: expect.any(Types.ObjectId) }),
        $inc: { version: 1 },
      }),
      { returnDocument: 'after', runValidators: true },
    );
  });

  it('reports a conflict when the expected version is stale', async () => {
    mockedStorefrontSettings.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    } as never);

    await expect(storefrontSettingsService.updateSettings(validInput({ version: 4 }), actorId))
      .rejects.toMatchObject({ statusCode: 409 });
  });
});
