import { apiFetch } from '../../../config/api';
import { FavoriteApiError, favoritesApi } from '../favoritesApi';

jest.mock('../../../config/api', () => ({ apiFetch: jest.fn() }));

const mockedApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

const response = (body: unknown, options: { ok?: boolean; status?: number } = {}) => ({
  ok: options.ok ?? true,
  status: options.status ?? 200,
  text: jest.fn().mockResolvedValue(JSON.stringify(body)),
} as unknown as Response);

describe('favoritesApi', () => {
  beforeEach(() => mockedApiFetch.mockReset());

  it('encodes search and paging values in the favorites URL', async () => {
    mockedApiFetch.mockResolvedValue(response({
      data: {
        items: [],
        pagination: { page: 2, limit: 10, totalItems: 0, totalPages: 0 },
      },
    }));

    await favoritesApi.getFavorites('access-token', {
      keyword: 'áo & váy',
      page: 2,
      limit: 10,
    });

    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/favorites?keyword=%C3%A1o%20%26%20v%C3%A1y&page=2&limit=10',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      }),
    );
  });

  it('rejects a successful response that omits data', async () => {
    mockedApiFetch.mockResolvedValue(response({ message: 'Missing payload' }));

    await expect(favoritesApi.getFavorites('access-token')).rejects.toEqual(
      expect.objectContaining<Partial<FavoriteApiError>>({
        name: 'FavoriteApiError',
        message: 'Missing payload',
        status: 200,
      }),
    );
  });
});
