import mongoose from 'mongoose';

type Env = NodeJS.ProcessEnv | Record<string, string | undefined>;

type ConnectDBOptions = {
  env?: Env;
  sleep?: (delayMs: number) => Promise<void>;
};

const DEFAULT_CONNECT_RETRIES = 3;
const DEFAULT_CONNECT_RETRY_DELAY_MS = 1_000;

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const defaultSleep = (delayMs: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, delayMs);
});

export const connectDB = async ({ env = process.env, sleep = defaultSleep }: ConnectDBOptions = {}) => {
  const uri = env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  const retries = parsePositiveInteger(env.MONGODB_CONNECT_RETRIES, DEFAULT_CONNECT_RETRIES);
  const retryDelayMs = parsePositiveInteger(
    env.MONGODB_CONNECT_RETRY_DELAY_MS,
    DEFAULT_CONNECT_RETRY_DELAY_MS,
  );
  const maxAttempts = retries + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await mongoose.connect(uri);
      console.log('MongoDB connected');
      return;
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts;
      console.error(`MongoDB connection attempt ${attempt}/${maxAttempts} failed:`, error);

      if (isLastAttempt) {
        throw error;
      }

      await sleep(retryDelayMs * attempt);
    }
  }
};
