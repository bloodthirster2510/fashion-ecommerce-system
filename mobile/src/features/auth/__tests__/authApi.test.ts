import { apiFetch } from '../../../config/api';
import { authApi } from '../authApi';

jest.mock('../../../config/api', () => ({
  apiFetch: jest.fn(),
}));

const mockedApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

describe('mobile auth API', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 204,
      text: jest.fn().mockResolvedValue(''),
    } as unknown as Response);
  });

  it('sends both tokens so logout can revoke a session after access expiry', async () => {
    await authApi.logout('access-token', 'refresh-token');

    expect(mockedApiFetch).toHaveBeenCalledWith('/auth/logout', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer access-token',
      }),
      body: JSON.stringify({ refreshToken: 'refresh-token' }),
    }));
  });
});
