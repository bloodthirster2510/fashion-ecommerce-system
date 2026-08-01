import { sessionStorage } from '../../auth/sessionStorage';
import { getRecommendationSessionId } from '../recommendationSession';

jest.mock('../../auth/sessionStorage', () => ({
  sessionStorage: {
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
  },
}));

const mockedSessionStorage = sessionStorage as jest.Mocked<typeof sessionStorage>;

describe('recommendation session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSessionStorage.setItemAsync.mockResolvedValue(undefined);
  });

  it('shares one generated id across concurrent first requests', async () => {
    let resolveStoredValue: (value: string | null) => void = () => undefined;
    const storedValue = new Promise<string | null>((resolve) => {
      resolveStoredValue = resolve;
    });
    mockedSessionStorage.getItemAsync.mockReturnValue(storedValue);
    const random = jest.spyOn(Math, 'random')
      .mockReturnValueOnce(0.123456)
      .mockReturnValueOnce(0.654321);

    const first = getRecommendationSessionId();
    const second = getRecommendationSessionId();
    resolveStoredValue(null);

    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.stringMatching(/^rec_session_/),
      expect.stringMatching(/^rec_session_/),
    ]);
    const [firstId, secondId] = await Promise.all([first, second]);
    expect(firstId).toBe(secondId);
    expect(mockedSessionStorage.getItemAsync).toHaveBeenCalledTimes(1);
    expect(mockedSessionStorage.setItemAsync).toHaveBeenCalledTimes(1);
    random.mockRestore();
  });

  it('retries initialization after a storage failure', async () => {
    mockedSessionStorage.getItemAsync
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValueOnce('rec_session_existing');

    await expect(getRecommendationSessionId()).rejects.toThrow('storage unavailable');
    await expect(getRecommendationSessionId()).resolves.toBe('rec_session_existing');
  });
});
