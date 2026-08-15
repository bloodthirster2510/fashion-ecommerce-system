import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/database';
import { visualSearchService } from '../modules/visual-search/visual-search.service';

dotenv.config();

// Kiểm tra script có được chạy kèm một cờ như --active-only hoặc --dry-run hay không.
const hasFlag = (flag: string) => process.argv.includes(flag);

// Đọc tham số dạng --ten=value để có thể override .env khi chạy thực nghiệm nhiều model.
const getStringArg = (name: string) => {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)?.trim();
};

// Đọc tham số số dương, ví dụ --limit=100.
const getNumberArg = (name: string) => {
  const rawValue = getStringArg(name);
  const value = Number(rawValue);

  return Number.isInteger(value) && value > 0 ? value : undefined;
};

// Cho phép mỗi lần backfill chỉ định model trực tiếp bằng CLI, tránh dùng nhầm .env cũ.
const applyEmbeddingOverrides = () => {
  const provider = getStringArg('provider');
  const serviceUrl = getStringArg('embedding-service-url');
  const model = getStringArg('model');
  const modelVersion = getStringArg('model-version');
  const timeoutMs = getStringArg('embedding-timeout-ms');

  if (provider) process.env.VISUAL_EMBEDDING_PROVIDER = provider;
  if (serviceUrl) process.env.VISUAL_EMBEDDING_SERVICE_URL = serviceUrl;
  if (model) process.env.VISUAL_EMBEDDING_MODEL = model;
  if (modelVersion) process.env.VISUAL_EMBEDDING_VERSION = modelVersion;
  if (timeoutMs) process.env.VISUAL_EMBEDDING_TIMEOUT_MS = timeoutMs;
};

// Luồng chính: kết nối DB và tạo/cập nhật visual index cho các ảnh sản phẩm.
const run = async () => {
  applyEmbeddingOverrides();
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
