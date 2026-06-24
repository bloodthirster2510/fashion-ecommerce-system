describe('apiFetch endpoint failover', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  const loadApi = () => {
    jest.resetModules();
    process.env.EXPO_PUBLIC_API_URL = 'http://primary.example/api';
    process.env.EXPO_PUBLIC_API_HOST = 'fallback.example';
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
});
