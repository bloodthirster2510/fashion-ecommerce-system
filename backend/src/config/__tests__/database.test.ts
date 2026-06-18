import mongoose from 'mongoose';
import { connectDB } from '../database';

jest.mock('mongoose', () => ({
  __esModule: true,
  default: {
    connect: jest.fn(),
  },
}));

const mockedMongoose = mongoose as jest.Mocked<typeof mongoose>;

describe('connectDB', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('retries transient MongoDB connection failures with backoff', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const sleep = jest.fn().mockResolvedValue(undefined);
    const firstError = new Error('temporary network failure');

    mockedMongoose.connect
      .mockRejectedValueOnce(firstError)
      .mockResolvedValueOnce(mongoose as never);

    await connectDB({
      env: {
        MONGODB_URI: 'mongodb://localhost:27017/test',
        MONGODB_CONNECT_RETRIES: '2',
        MONGODB_CONNECT_RETRY_DELAY_MS: '25',
      },
      sleep,
    });

    expect(mockedMongoose.connect).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(25);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'MongoDB connection attempt 1/3 failed:',
      firstError,
    );
    expect(consoleLogSpy).toHaveBeenCalledWith('MongoDB connected');
  });

  it('throws after exhausting configured connection retries', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const sleep = jest.fn().mockResolvedValue(undefined);
    const connectionError = new Error('mongo unavailable');

    mockedMongoose.connect.mockRejectedValue(connectionError);

    await expect(
      connectDB({
        env: {
          MONGODB_URI: 'mongodb://localhost:27017/test',
          MONGODB_CONNECT_RETRIES: '1',
          MONGODB_CONNECT_RETRY_DELAY_MS: '10',
        },
        sleep,
      }),
    ).rejects.toBe(connectionError);

    expect(mockedMongoose.connect).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenLastCalledWith(
      'MongoDB connection attempt 2/2 failed:',
      connectionError,
    );
  });
});
