describe('apiFetch endpoint failover', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  const loadApi = () => {
    jest.resetModules();
    process.env.EXPO_PUBLIC_API_URL = 'http://primary.example/api';
    process.env.EXPO_PUBLIC_API_HOST = 'fallback.example';
    process.env.EXPO_PUBLIC_API_DEBUG_LOGS = 'true';
    jest.doMock('react-native', () => ({
      NativeModules: { SourceCode: { scriptURL: undefined } },
      Platform: {
        OS: 'android',
        select: (values: Record<string, string>) => values.android ?? values.default,
      },
    }));
    return jest.requireActual('../api') as typeof import('../api');
  };

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.EXPO_PUBLIC_API_URL;
    delete process.env.EXPO_PUBLIC_API_HOST;
    delete process.env.EXPO_PUBLIC_API_DEBUG_LOGS;
  });

  it('tries another endpoint for an authenticated read after a network failure', async () => {
    const fetchMock = jest.fn()
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce({ ok: true });
    global.fetch = fetchMock as typeof fetch;
    const { apiFetch } = loadApi();

    await expect(apiFetch('/orders/me', {
      headers: { Authorization: 'Bearer token' },
    })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not replay a write request on another endpoint by default', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    global.fetch = fetchMock as typeof fetch;
    const { apiFetch } = loadApi();

    await expect(apiFetch('/orders', {
      method: 'POST',
      body: '{}',
    })).rejects.toThrow('Không thể kết nối máy chủ');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses native HTTP cache only for public reads', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as typeof fetch;
    const { apiFetch } = loadApi();

    await apiFetch('/products');
    await apiFetch('/orders/me', { headers: { Authorization: 'Bearer token' } });
    await apiFetch('/orders', { method: 'POST', body: '{}' });

    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({ cache: 'no-cache' }));
    expect(fetchMock.mock.calls[1][1]).toEqual(expect.objectContaining({ cache: 'no-store' }));
    expect(fetchMock.mock.calls[2][1]).toEqual(expect.objectContaining({ cache: 'no-store' }));
  });

  it('logs request diagnostics without query parameters, credentials, or bodies', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as typeof fetch;
    const { apiFetch } = loadApi();

    await apiFetch('/auth/login?debugToken=secret', {
      method: 'POST',
      headers: { Authorization: 'Bearer private-token' },
      body: JSON.stringify({ password: 'private-password' }),
    });

    const logs = (console.log as jest.Mock).mock.calls.flat().join(' ');
    expect(logs).toContain('[API] POST http://primary.example/api/auth/login');
    expect(logs).toContain('-> 200');
    expect(logs).not.toContain('debugToken');
    expect(logs).not.toContain('private-token');
    expect(logs).not.toContain('private-password');
  });
});
