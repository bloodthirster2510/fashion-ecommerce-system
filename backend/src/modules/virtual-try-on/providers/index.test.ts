import { createVirtualTryOnProvider } from './index';

describe('createVirtualTryOnProvider', () => {
  it.each(['fashionshop-tryon', '/fashionshop-tryon'])(
    'uses the real try-on provider alias %s',
    (providerName) => {
      expect(createVirtualTryOnProvider(providerName)).toEqual(expect.objectContaining({
        generate: expect.any(Function),
      }));
    },
  );

  it('keeps mock provider for local mobile testing', () => {
    expect(createVirtualTryOnProvider('mock')).toEqual(expect.objectContaining({
      generate: expect.any(Function),
    }));
  });
});
