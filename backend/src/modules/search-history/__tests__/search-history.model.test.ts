import { Types } from 'mongoose';
import {
  DEFAULT_SEARCH_HISTORY_MAX_RESULT_PRODUCTS,
  DEFAULT_SEARCH_HISTORY_TTL_SECONDS,
  SearchHistory,
} from '../../../database/models';

describe('SearchHistory model', () => {
  it('validates a keyword search with normalized result scores', async () => {
    const history = new SearchHistory({
      sessionId: 'search-session',
      searchType: 'keyword',
      keyword: 'ao polo',
      resultProducts: [
        {
          productId: new Types.ObjectId(),
          score: 0.8,
        },
      ],
      resultCount: 1,
    });

    await expect(history.validate()).resolves.toBeUndefined();
  });

  it('requires keyword or imageUrl according to searchType', async () => {
    const keywordSearch = new SearchHistory({
      sessionId: 'search-session',
      searchType: 'keyword',
    });
    const imageSearch = new SearchHistory({
      sessionId: 'search-session',
      searchType: 'image',
    });

    await expect(keywordSearch.validate()).rejects.toMatchObject({
      errors: { keyword: expect.anything() },
    });
    await expect(imageSearch.validate()).rejects.toMatchObject({
      errors: { imageUrl: expect.anything() },
    });
  });

  it('limits stored result products and configures the default TTL index', async () => {
    const history = new SearchHistory({
      sessionId: 'search-session',
      searchType: 'keyword',
      keyword: 'ao',
      resultProducts: Array.from(
        { length: DEFAULT_SEARCH_HISTORY_MAX_RESULT_PRODUCTS + 1 },
        () => ({ productId: new Types.ObjectId(), score: 1 }),
      ),
    });

    await expect(history.validate()).rejects.toMatchObject({
      errors: { resultProducts: expect.anything() },
    });

    expect(SearchHistory.schema.indexes()).toContainEqual([
      { createdAt: 1 },
      expect.objectContaining({ expireAfterSeconds: DEFAULT_SEARCH_HISTORY_TTL_SECONDS }),
    ]);
  });

  it('uses a partial unique index for idempotent event ids', () => {
    expect(SearchHistory.schema.indexes()).toContainEqual([
      { eventId: 1 },
      expect.objectContaining({
        unique: true,
        partialFilterExpression: { eventId: { $type: 'string' } },
      }),
    ]);
  });
});
