import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/database';
import {
  processVirtualTryOnImageJob,
  processVirtualTryOnVideoJob,
  resumePendingVirtualTryOnJobs,
} from '../modules/virtual-try-on/virtual-try-on.service';
import {
  getVirtualTryOnQueueConfig,
  startVirtualTryOnQueue,
  stopVirtualTryOnQueue,
} from '../modules/virtual-try-on/virtual-try-on.queue';

const startWorker = async () => {
  if (!getVirtualTryOnQueueConfig().enabled) {
    throw new Error('VIRTUAL_TRY_ON_QUEUE_ENABLED=true is required for the standalone worker');
  }

  await connectDB();
  await startVirtualTryOnQueue(
    {
      image: processVirtualTryOnImageJob,
      video: processVirtualTryOnVideoJob,
    },
    { startWorker: true },
  );

  const resumedJobs = await resumePendingVirtualTryOnJobs();
  console.log(
    `[virtual-try-on-worker] Ready; resumed ${resumedJobs.image} image and ${resumedJobs.video} video job(s)`,
  );

  let isShuttingDown = false;
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`[virtual-try-on-worker] ${signal} received; shutting down`);
    await stopVirtualTryOnQueue();
    await mongoose.disconnect();
  };

  process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.once('SIGINT', () => { void shutdown('SIGINT'); });
};

startWorker().catch((error) => {
  console.error('[virtual-try-on-worker] Failed to start:', error);
  process.exit(1);
});
