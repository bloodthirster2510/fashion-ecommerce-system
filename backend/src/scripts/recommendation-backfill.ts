import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/database';
import { recommendationBackfillService } from '../modules/recommendations/recommendation-backfill.service';

dotenv.config();

const hasFlag = (flag: string) => process.argv.includes(flag);

const getNumberArg = (name: string) => {
  const prefix = `--${name}=`;
  const rawValue = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const value = Number(rawValue);

  return Number.isInteger(value) && value > 0 ? value : undefined;
};

const run = async () => {
  await connectDB();

  const result = await recommendationBackfillService.backfillRecommendationInteractions({
    dryRun: hasFlag('--dry-run'),
    limit: getNumberArg('limit'),
  });

  console.log(JSON.stringify(result, null, 2));
};

run()
  .catch((error) => {
    console.error('Recommendation backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
