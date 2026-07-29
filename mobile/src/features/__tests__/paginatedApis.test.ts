import { apiFetch } from '../../config/api';
import { reviewApi } from '../reviews/reviewApi';
import { supportApi } from '../support/supportApi';

jest.mock('../../config/api', () => ({
  apiFetch: jest.fn(),
}));

const mockedApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;
const paginatedData = {
  items: [],
  pagination: { page: 2, limit: 20, totalItems: 25, totalPages: 2 },
};

describe('paginated mobile APIs', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    mockedApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(JSON.stringify({ data: paginatedData })),
    } as unknown as Response);
  });

  it('passes the requested support ticket page instead of forcing the first 100 items', async () => {
    await supportApi.listTickets('access-token', { page: 2, limit: 20 });

    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/support/tickets?page=2&limit=20',
      expect.objectContaining({ timeoutMs: 30000 }),
    );
  });

  it('paginates FAQ search and personal reviews', async () => {
    await supportApi.listFaqs('đổi trả', 'returns', { page: 2, limit: 20 });
    await reviewApi.listMine('access-token', { page: 2, limit: 20 });

    expect(mockedApiFetch).toHaveBeenNthCalledWith(
      1,
      '/support/faqs?page=2&limit=20&search=%C4%91%E1%BB%95i+tr%E1%BA%A3&category=returns',
      expect.any(Object),
    );
    expect(mockedApiFetch).toHaveBeenNthCalledWith(
      2,
      '/reviews/me?page=2&limit=20&sort=newest',
      expect.any(Object),
    );
  });
});
