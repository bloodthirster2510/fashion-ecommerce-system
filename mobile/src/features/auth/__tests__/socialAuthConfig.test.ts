import { resolveSocialAuthConfig } from '../socialAuthConfig';

describe('social auth configuration', () => {
  it('hides providers when credentials are absent or placeholders', () => {
    expect(resolveSocialAuthConfig({}, 'android')).toMatchObject({
      mode: 'auto',
      enabled: false,
      google: { enabled: false },
      facebook: { enabled: false },
    });
    expect(resolveSocialAuthConfig({
      googleClientId: 'your-google-client-id',
      facebookAppId: 'your-facebook-app-id',
    }, 'android').enabled).toBe(false);
  });

  it('enables only providers with valid public identifiers', () => {
    const googleOnly = resolveSocialAuthConfig({
      googleClientId: '123456-example.apps.googleusercontent.com',
    }, 'android');
    const facebookOnly = resolveSocialAuthConfig({
      facebookAppId: '123456789012345',
    }, 'ios');

    expect(googleOnly).toMatchObject({
      enabled: true,
      google: { enabled: true },
      facebook: { enabled: false },
    });
    expect(facebookOnly).toMatchObject({
      enabled: true,
      google: { enabled: false },
      facebook: { enabled: true },
    });
  });

  it('uses redirect URIs registered by the development build', () => {
    const config = resolveSocialAuthConfig({
      googleClientId: '123456-example.apps.googleusercontent.com',
      facebookAppId: '123456789012345',
    }, 'android');

    expect(config.google.redirectUri).toBe('com.fashionshop.app:/oauthredirect');
    expect(config.facebook.redirectUri).toBe('fb123456789012345://authorize');
  });

  it('allows social login to be disabled for an environment', () => {
    const config = resolveSocialAuthConfig({
      mode: 'disabled',
      googleClientId: '123456-example.apps.googleusercontent.com',
      facebookAppId: '123456789012345',
    }, 'android');

    expect(config.enabled).toBe(false);
    expect(config.google.enabled).toBe(false);
    expect(config.facebook.enabled).toBe(false);
  });
});
