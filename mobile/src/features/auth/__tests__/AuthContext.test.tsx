import React from 'react';
import { authApi } from '../authApi';
import { AuthProvider, useAuth } from '../AuthContext';
import { sessionStorage } from '../sessionStorage';
import type { AuthSession } from '../types';

jest.mock('../authApi', () => ({
  authApi: {
    logout: jest.fn(),
    refreshToken: jest.fn(),
  },
}));

jest.mock('../sessionStorage', () => ({
  sessionStorage: {
    deleteItemAsync: jest.fn(),
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
  },
}));

const renderer = jest.requireActual('react-test-renderer') as {
  act: (action: () => void | Promise<void>) => Promise<void>;
  create: (element: React.ReactElement) => { unmount: () => void };
};
const mockedAuthApi = authApi as jest.Mocked<typeof authApi>;
const mockedSessionStorage = sessionStorage as jest.Mocked<typeof sessionStorage>;

const session: AuthSession = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  user: {
    _id: 'user-1',
    name: 'Mobile User',
    email: 'mobile@example.com',
    phone: '0900000000',
    role: 'user',
    profileCompleted: true,
    mustChangePassword: false,
  },
};

describe('mobile auth session lifecycle', () => {
  let auth: ReturnType<typeof useAuth>;
  let tree: { unmount: () => void } | null = null;

  const Consumer = () => {
    auth = useAuth();
    return null;
  };

  const renderProvider = async () => {
    await renderer.act(async () => {
      tree = renderer.create(
        <AuthProvider>
          <Consumer />
        </AuthProvider>,
      );
      await Promise.resolve();
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedSessionStorage.getItemAsync.mockResolvedValue(null);
    mockedSessionStorage.setItemAsync.mockResolvedValue(undefined);
    mockedSessionStorage.deleteItemAsync.mockResolvedValue(undefined);
    mockedAuthApi.logout.mockResolvedValue(null);
  });

  afterEach(async () => {
    if (tree) {
      await renderer.act(async () => tree?.unmount());
      tree = null;
    }
  });

  it('rejects valid JSON that is not a complete auth session', async () => {
    mockedSessionStorage.getItemAsync.mockResolvedValue(JSON.stringify({ user: {} }));

    await renderProvider();

    expect(auth.isAuthenticated).toBe(false);
    expect(mockedSessionStorage.deleteItemAsync).toHaveBeenCalledWith('fashionista.authSession');
  });

  it('restores an incomplete social profile that legitimately has no phone yet', async () => {
    mockedSessionStorage.getItemAsync.mockResolvedValue(JSON.stringify({
      ...session,
      user: {
        ...session.user,
        phone: '',
        profileCompleted: false,
      },
    }));

    await renderProvider();

    expect(auth.isAuthenticated).toBe(true);
    expect(auth.session?.user.profileCompleted).toBe(false);
    expect(mockedSessionStorage.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('clears local state and sends both tokens even when server logout is offline', async () => {
    mockedAuthApi.logout.mockRejectedValueOnce(new Error('network unavailable'));
    await renderProvider();
    await renderer.act(async () => auth.login(session));

    await renderer.act(async () => {
      await auth.logout();
    });

    expect(auth.isAuthenticated).toBe(false);
    expect(mockedSessionStorage.deleteItemAsync).toHaveBeenCalledWith('fashionista.authSession');
    expect(mockedAuthApi.logout).toHaveBeenCalledWith('access-token', 'refresh-token');
  });

  it('shares one refresh request across concurrent authenticated actions', async () => {
    mockedAuthApi.refreshToken.mockResolvedValue({
      accessToken: 'next-access-token',
      refreshToken: 'next-refresh-token',
    });
    await renderProvider();
    await renderer.act(async () => auth.login(session));
    const unauthorized = Object.assign(new Error('expired'), { status: 401 });
    const firstAction = jest.fn()
      .mockRejectedValueOnce(unauthorized)
      .mockResolvedValueOnce('first-result');
    const secondAction = jest.fn()
      .mockRejectedValueOnce(unauthorized)
      .mockResolvedValueOnce('second-result');
    let results: unknown[] = [];

    await renderer.act(async () => {
      results = await Promise.all([
        auth.runWithAuth(firstAction),
        auth.runWithAuth(secondAction),
      ]);
    });

    expect(results).toEqual(['first-result', 'second-result']);
    expect(mockedAuthApi.refreshToken).toHaveBeenCalledTimes(1);
    expect(firstAction).toHaveBeenLastCalledWith('next-access-token');
    expect(secondAction).toHaveBeenLastCalledWith('next-access-token');
  });

  it('does not restore a session when logout happens during token refresh', async () => {
    let resolveRefresh: (tokens: { accessToken: string; refreshToken: string }) => void = () => undefined;
    mockedAuthApi.refreshToken.mockReturnValue(new Promise((resolve) => {
      resolveRefresh = resolve;
    }));
    await renderProvider();
    await renderer.act(async () => auth.login(session));
    const action = jest.fn().mockRejectedValueOnce(
      Object.assign(new Error('expired'), { status: 401 }),
    );
    const operation = auth.runWithAuth(action);
    const rejection = expect(operation).rejects.toThrow('Phiên đăng nhập');
    await Promise.resolve();

    await renderer.act(async () => {
      await auth.logout();
    });
    resolveRefresh({
      accessToken: 'next-access-token',
      refreshToken: 'next-refresh-token',
    });

    await renderer.act(async () => {
      await rejection;
    });
    expect(auth.isAuthenticated).toBe(false);
    expect(mockedAuthApi.logout).toHaveBeenCalledWith('next-access-token', 'next-refresh-token');
  });
});
