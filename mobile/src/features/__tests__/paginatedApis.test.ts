import { apiFetch } from '../../config/api';
import { reviewApi } from '../reviews/reviewApi';
import { supportApi } from '../support/supportApi';
import { couponApi } from '../coupons/couponApi';

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

  it('sends the customer token when restoring helpful votes on product reviews', async () => {
    await reviewApi.listProductReviews('product-1', { page: 1, limit: 5 }, 'access-token');

    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/reviews/products/product-1?page=1&limit=5&sort=newest',
      expect.objectContaining({ timeoutMs: 30000 }),
    );
    const request = mockedApiFetch.mock.calls[0][1];
    expect(new Headers(request?.headers).get('Authorization')).toBe('Bearer access-token');
  });

  it('keeps the HTTP status on review API errors so authentication can refresh a session', async () => {
    mockedApiFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: jest.fn().mockResolvedValue(JSON.stringify({ message: 'Access token expired' })),
    } as unknown as Response);

    await expect(reviewApi.listMine('expired-token')).rejects.toMatchObject({
      message: 'Access token expired',
      status: 401,
    });
  });

  it('passes coupon pagination so Mobile can load vouchers after the first page', async () => {
    await couponApi.getAvailableCoupons('access-token', { page: 2, limit: 20 });

    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/coupons/available',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ page: 2, limit: 20 }),
      }),
    );
  });
});
