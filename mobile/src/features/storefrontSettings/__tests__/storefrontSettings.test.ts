import {
  isStorefrontSettings,
  preferFreshStorefrontSettings,
  resolveStorefrontSettings,
} from '../StorefrontSettingsProvider';
import type { StorefrontSettings } from '../storefrontSettings.types';

const settings = (
  configured: boolean,
  overrides: Partial<StorefrontSettings> = {},
): StorefrontSettings => ({
  configured,
  identity: { name: 'Configured Shop', avatarUrl: '', legalName: '', taxCode: '', tagline: '', description: '' },
  contact: { phone: '', email: '', hours: '', address: '', mapUrl: '' },
  socials: [
    { platform: 'facebook', label: 'Facebook', url: 'https://facebook.com/shop', enabled: false, sortOrder: 0 },
  ],
  version: configured ? 1 : 0,
  updatedAt: configured ? '2026-08-01T00:00:00.000Z' : null,
  ...overrides,
});

describe('resolveStorefrontSettings', () => {
  it('keeps intentionally cleared fields after settings are configured', () => {
    const result = resolveStorefrontSettings(settings(true));

    expect(result.contact.phone).toBe('');
    expect(result.socials).toEqual([]);
  });

  it('filters and sorts configured social links without mutating the API value', () => {
    const source = settings(true, {
      socials: [
        { platform: 'instagram', label: 'Instagram', url: 'https://instagram.com/shop', enabled: true, sortOrder: 2 },
        { platform: 'facebook', label: 'Facebook', url: 'https://facebook.com/shop', enabled: true, sortOrder: 0 },
        { platform: 'youtube', label: 'YouTube', url: 'https://youtube.com/shop', enabled: false, sortOrder: 1 },
      ],
    });
    const originalOrder = source.socials.map((social) => social.platform);

    const result = resolveStorefrontSettings(source);

    expect(result.socials.map((social) => social.platform)).toEqual(['facebook', 'instagram']);
    expect(source.socials.map((social) => social.platform)).toEqual(originalOrder);
  });

  it('uses bundled contact fallbacks before the first admin save', () => {
    const result = resolveStorefrontSettings(settings(false));

    expect(result.contact.phone).toBeTruthy();
    expect(result.contact.email).toBeTruthy();
  });

  it('preserves available server values while filling only missing unconfigured values', () => {
    const result = resolveStorefrontSettings(settings(false, {
      identity: {
        name: 'Server Shop',
        avatarUrl: 'https://res.cloudinary.com/demo/image/upload/avatar.png',
        legalName: '',
        taxCode: '',
        tagline: 'Server tagline',
        description: '',
      },
      contact: {
        phone: '0900000000',
        email: '',
        hours: '',
        address: 'Server address',
        mapUrl: '',
      },
    }));

    expect(result.identity.name).toBe('Server Shop');
    expect(result.identity.tagline).toBe('Server tagline');
    expect(result.contact.phone).toBe('0900000000');
    expect(result.contact.address).toBe('Server address');
    expect(result.contact.email).toBeTruthy();
  });

  it('uses valid server social links before configuration and still filters disabled entries', () => {
    const result = resolveStorefrontSettings(settings(false, {
      socials: [
        { platform: 'tiktok', label: 'TikTok', url: 'https://tiktok.com/@shop', enabled: true, sortOrder: 2 },
        { platform: 'facebook', label: 'Facebook', url: 'https://facebook.com/shop', enabled: false, sortOrder: 0 },
      ],
    }));

    expect(result.socials).toEqual([
      expect.objectContaining({ platform: 'tiktok', enabled: true }),
    ]);
  });
});

describe('isStorefrontSettings', () => {
  it('accepts a complete API or cached payload', () => {
    expect(isStorefrontSettings(settings(true))).toBe(true);
  });

  it.each([
    ['a null payload', null],
    ['a missing configured flag', { ...settings(true), configured: undefined }],
    ['an incomplete identity', { ...settings(true), identity: { name: 'Shop' } }],
    ['an incomplete contact', { ...settings(true), contact: { phone: '0900000000' } }],
    ['a configured payload at version zero', { ...settings(true), version: 0 }],
    ['an unconfigured payload above version zero', { ...settings(false), version: 2 }],
    ['a negative version', { ...settings(true), version: -1 }],
    ['a fractional version', { ...settings(true), version: 1.5 }],
    ['an invalid update timestamp type', { ...settings(true), updatedAt: 123 }],
    ['an invalid update timestamp value', { ...settings(true), updatedAt: 'not-a-date' }],
    ['a configured payload without an update timestamp', { ...settings(true), updatedAt: null }],
    ['an unconfigured payload with an update timestamp', { ...settings(false), updatedAt: '2026-08-01T00:00:00.000Z' }],
    ['a non-HTTPS avatar link', {
      ...settings(true),
      identity: { ...settings(true).identity, avatarUrl: 'http://example.com/avatar.png' },
    }],
    ['a non-HTTPS map link', {
      ...settings(true),
      contact: { ...settings(true).contact, mapUrl: 'http://maps.example.com' },
    }],
    ['an unsupported social platform', {
      ...settings(true),
      socials: [{ platform: 'myspace', label: 'MySpace', url: 'https://example.com', enabled: true, sortOrder: 0 }],
    }],
    ['an invalid social enabled flag', {
      ...settings(true),
      socials: [{ platform: 'facebook', label: 'Facebook', url: 'https://example.com', enabled: 'yes', sortOrder: 0 }],
    }],
    ['an invalid social sort order', {
      ...settings(true),
      socials: [{ platform: 'facebook', label: 'Facebook', url: 'https://example.com', enabled: true, sortOrder: 0.5 }],
    }],
    ['a negative social sort order', {
      ...settings(true),
      socials: [{ platform: 'facebook', label: 'Facebook', url: 'https://example.com', enabled: true, sortOrder: -1 }],
    }],
    ['duplicate known social platforms', {
      ...settings(true),
      socials: [
        { platform: 'facebook', label: 'Facebook', url: 'https://example.com/one', enabled: true, sortOrder: 0 },
        { platform: 'facebook', label: 'Backup', url: 'https://example.com/two', enabled: true, sortOrder: 1 },
      ],
    }],
    ['more than twelve social links', {
      ...settings(true),
      socials: Array.from({ length: 13 }, (_, index) => ({
        platform: 'other', label: `Link ${index}`, url: `https://example.com/${index}`, enabled: true, sortOrder: index,
      })),
    }],
    ['a non-HTTPS social link', {
      ...settings(true),
      socials: [{ platform: 'facebook', label: 'Facebook', url: 'http://example.com', enabled: true, sortOrder: 0 }],
    }],
  ])('rejects %s', (_label, payload) => {
    expect(isStorefrontSettings(payload)).toBe(false);
  });
});

describe('preferFreshStorefrontSettings', () => {
  it('keeps the current settings when a slower response has an older version', () => {
    const current = settings(true, { version: 3 });
    const staleResponse = settings(true, { version: 2, identity: { ...settings(true).identity, name: 'Old Shop' } });

    expect(preferFreshStorefrontSettings(current, staleResponse)).toBe(current);
  });

  it('accepts a response with the same or a newer version', () => {
    const current = settings(true, { version: 2 });
    const refreshed = settings(true, { version: 3 });

    expect(preferFreshStorefrontSettings(current, refreshed)).toBe(refreshed);
    expect(preferFreshStorefrontSettings(refreshed, { ...refreshed })).not.toBe(refreshed);
  });
});
