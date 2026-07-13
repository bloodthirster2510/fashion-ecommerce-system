import { Types } from 'mongoose';
import { SearchHistory } from '../../../database/models';
import { searchHistoryService } from '../search-history.service';

jest.mock('../../../database/models', () => ({
  SEARCH_HISTORY_TYPES: ['keyword', 'image'],
  SearchHistory: {
    aggregate: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
  },
  getSearchHistoryMaxResultProducts: () => 2,
}));

const mockedSearchHistory = SearchHistory as unknown as {
  create: jest.Mock;
};

describe('searchHistoryService', () => {
  const originalEnabled = process.env.SEARCH_HISTORY_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SEARCH_HISTORY_ENABLED = 'true';
    mockedSearchHistory.create.mockResolvedValue({ _id: new Types.ObjectId() });
  });

  afterAll(() => {
    if (originalEnabled === undefined) {
      delete process.env.SEARCH_HISTORY_ENABLED;
    } else {
      process.env.SEARCH_HISTORY_ENABLED = originalEnabled;
    }
  });

  it('records a keyword search and truncates the result snapshot', async () => {
    const productIds = [new Types.ObjectId(), new Types.ObjectId(), new Types.ObjectId()];

    const result = await searchHistoryService.recordSearch({
      sessionId: 'search-session',
      searchType: 'keyword',
      keyword: '  ao   polo  ',
      resultProducts: productIds.map((productId, index) => ({
        productId: productId.toString(),
        score: index === 0 ? 1.4 : 0.5,
      })),
      resultCount: 12,
    });

    expect(mockedSearchHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'search-session',
        keyword: 'ao polo',
        resultCount: 12,
        resultProducts: [
          expect.objectContaining({ productId: productIds[0], score: 1 }),
          expect.objectContaining({ productId: productIds[1], score: 0.5 }),
        ],
      }),
    );
    expect(result.recorded).toBe(true);
  });

  it('rejects a keyword search without a keyword', async () => {
    await expect(
      searchHistoryService.recordSearch({
        sessionId: 'search-session',
        searchType: 'keyword',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mockedSearchHistory.create).not.toHaveBeenCalled();
  });

  it('does not throw when best-effort persistence fails', async () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockedSearchHistory.create.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(
      searchHistoryService.recordSearchBestEffort({
        sessionId: 'search-session',
        searchType: 'keyword',
        keyword: 'ao',
      }),
    ).resolves.toBeNull();

    warning.mockRestore();
  });

  it('can be disabled without touching the database', async () => {
    process.env.SEARCH_HISTORY_ENABLED = 'false';

    await expect(
      searchHistoryService.recordSearch({
        sessionId: 'search-session',
        searchType: 'keyword',
        keyword: 'ao',
      }),
    ).resolves.toEqual({ recorded: false, skippedReason: 'tracking_disabled' });

    expect(mockedSearchHistory.create).not.toHaveBeenCalled();
  });
});
