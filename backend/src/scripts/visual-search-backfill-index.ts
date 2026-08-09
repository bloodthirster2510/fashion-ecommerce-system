import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/database';
import { visualSearchService } from '../modules/visual-search/visual-search.service';

dotenv.config();

// Kiểm tra script có được chạy kèm một cờ như --active-only hoặc --dry-run hay không.
const hasFlag = (flag: string) => process.argv.includes(flag);

// Đọc tham số số dương, ví dụ --limit=100.
const getNumberArg = (name: string) => {
  const prefix = `--${name}=`;
  const rawValue = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const value = Number(rawValue);

  return Number.isInteger(value) && value > 0 ? value : undefined;
};

// Luồng chính: kết nối DB và tạo/cập nhật visual index cho các ảnh sản phẩm.
const run = async () => {
  await connectDB();

  const result = await visualSearchService.backfillVisualIndex({
    activeOnly: hasFlag('--active-only'),
    dryRun: hasFlag('--dry-run'),
    limit: getNumberArg('limit'),
  });

  console.log(JSON.stringify(result, null, 2));
};

run()
  .catch((error) => {
    console.error('Visual search index backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
