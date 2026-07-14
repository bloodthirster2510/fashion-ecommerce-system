import {
  isStorefrontSettings,
  resolveStorefrontSettings,
} from '../StorefrontSettingsProvider';
import type { StorefrontSettings } from '../storefrontSettings.types';

const settings = (
  configured: boolean,
  overrides: Partial<StorefrontSettings> = {},
): StorefrontSettings => ({
  configured,
  identity: { name: 'Configured Shop', legalName: '', taxCode: '', tagline: '', description: '' },
  contact: { phone: '', email: '', hours: '', address: '', mapUrl: '' },
  socials: [
    { platform: 'facebook', label: 'Facebook', url: 'https://facebook.com/shop', enabled: false, sortOrder: 0 },
  ],
  version: configured ? 1 : 0,
  updatedAt: null,
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
    ['a fractional version', { ...settings(true), version: 1.5 }],
    ['an invalid update timestamp', { ...settings(true), updatedAt: 123 }],
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
    ['a non-HTTPS social link', {
      ...settings(true),
      socials: [{ platform: 'facebook', label: 'Facebook', url: 'http://example.com', enabled: true, sortOrder: 0 }],
    }],
  ])('rejects %s', (_label, payload) => {
    expect(isStorefrontSettings(payload)).toBe(false);
  });
});
