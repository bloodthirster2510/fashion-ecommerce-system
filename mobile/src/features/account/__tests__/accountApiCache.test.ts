jest.mock('../../../config/api', () => ({ apiFetch: jest.fn() }));

import { apiFetch } from '../../../config/api';
import { invalidateCache } from '../../../config/apiCache';
import { accountApi } from '../accountApi';

const mockedApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

describe('account API cache isolation', () => {
  beforeEach(() => {
    invalidateCache();
    mockedApiFetch.mockReset();
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: { pagination: { totalItems: 1 } } }),
    } as Response);
  });

  it('never reuses an order summary across access tokens', async () => {
    await accountApi.getMyOrderSummary('token-user-a');
    await accountApi.getMyOrderSummary('token-user-b');
    await accountApi.getMyOrderSummary('token-user-a');

    expect(mockedApiFetch).toHaveBeenCalledTimes(2);
  });
});
