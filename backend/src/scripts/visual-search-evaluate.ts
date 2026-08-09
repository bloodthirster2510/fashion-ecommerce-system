import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { connectDB } from '../config/database';
import { visualSearchService } from '../modules/visual-search/visual-search.service';
import type { VisualSearchQueryOptions } from '../modules/visual-search/visual-search.types';

dotenv.config();

type CsvRow = Record<string, string>;

type QueryLabel = {
  queryId: string;
  queryImagePath: string;
  querySource?: string;
  expectedProductIds: string[];
  relevantProductIds: string[];
  expectedCategoryId?: string;
  expectedColor?: string;
  difficulty?: string;
  note?: string;
};

type QueryEvaluationDetail = {
  queryId: string;
  queryImagePath: string;
  expectedProductIds: string;
  relevantProductIds: string;
  returnedProductIds: string;
  firstRelevantRank: number;
  recallAt1: number;
  recallAt5: number;
  recallAt10: number;
  precisionAt5: number;
  precisionAt10: number;
  reciprocalRank: number;
  ndcgAt10: number;
  latencyMs: number;
  topScore: number;
  error: string;
};

const DEFAULT_LABELS_PATH = 'docs_vs/visual-search-query-labels.csv';
const FALLBACK_LABELS_PATH = 'docs_vs/visual-search-query-label-template.csv';
const DEFAULT_SUMMARY_OUTPUT = 'docs_vs/visual-search-experiment-results.csv';
const DEFAULT_DETAIL_OUTPUT = 'docs_vs/visual-search-evaluation-details.csv';
const DEFAULT_LIMIT = 10;
const IMAGE_DOWNLOAD_TIMEOUT_MS = 30_000;

// Kiểm tra script có được chạy kèm một cờ như --use-label-filters hay không.
const hasFlag = (flag: string) => process.argv.includes(flag);

// Đọc tham số dạng --ten=value; nếu không có thì trả về giá trị mặc định.
const getStringArg = (name: string, fallback?: string) => {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
};

// Đọc tham số dạng số, ví dụ --limit=10 hoặc --score-threshold=0.2.
const getNumberArg = (name: string, fallback?: number) => {
  const rawValue = getStringArg(name);
  const value = Number(rawValue);

  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

// Xác định thư mục gốc dự án dù script chạy ở root hay trong backend.
const getRepoRoot = () => {
  return path.basename(process.cwd()) === 'backend'
    ? path.resolve(process.cwd(), '..')
    : process.cwd();
};

// Chuyển đường dẫn tương đối thành đường dẫn đầy đủ để đọc/ghi file ổn định.
const resolveWorkspacePath = (filePath: string) => {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  const candidates = [
    path.resolve(process.cwd(), filePath),
    path.resolve(getRepoRoot(), filePath),
    path.resolve(getRepoRoot(), 'backend', filePath),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? path.resolve(getRepoRoot(), 'backend', filePath);
};

// Chọn file nhãn đánh giá; nếu file chính chưa có thì dùng template dự phòng.
const resolveLabelsPath = () => {
  const requestedPath = getStringArg('labels', DEFAULT_LABELS_PATH)!;
  const resolvedPath = resolveWorkspacePath(requestedPath);

  if (existsSync(resolvedPath)) {
    return resolvedPath;
  }

  return resolveWorkspacePath(FALLBACK_LABELS_PATH);
};

// Tách một dòng CSV, có xử lý ô chứa dấu phẩy trong dấu nháy.
const parseCsvLine = (line: string) => {
  const values: string[] = [];
  let currentValue = '';
  let isQuoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && isQuoted && nextChar === '"') {
      currentValue += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      isQuoted = !isQuoted;
      continue;
    }

    if (char === ',' && !isQuoted) {
      values.push(currentValue);
      currentValue = '';
      continue;
    }

    currentValue += char;
  }

  values.push(currentValue);
  return values;
};

// Đọc nội dung CSV thành danh sách object theo tên cột.
const parseCsv = (content: string): CsvRow[] => {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length <= 1) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<CsvRow>((row, header, index) => {
      row[header] = values[index]?.trim() ?? '';
      return row;
    }, {});
  });
};

// Tách danh sách id trong một ô CSV thành mảng id sạch.
const splitIds = (value?: string) => {
  if (!value) {
    return [];
  }

  return value
    .split(/[|;,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
};

// Chuyển một dòng nhãn CSV thành cấu trúc dùng cho đánh giá.
const mapLabel = (row: CsvRow): QueryLabel => ({
  queryId: row.queryId,
  queryImagePath: row.queryImagePath,
  querySource: row.querySource || undefined,
  expectedProductIds: splitIds(row.expectedProductIds),
  relevantProductIds: splitIds(row.relevantProductIds),
  expectedCategoryId: row.expectedCategoryId || undefined,
  expectedColor: row.expectedColor || undefined,
  difficulty: row.difficulty || undefined,
  note: row.note || undefined,
});

// Xác định loại ảnh để gửi đúng thông tin file vào service tìm kiếm.
const getMimeType = (filePath: string, fallback?: string) => {
  if (fallback?.startsWith('image/')) {
    return fallback;
  }

  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';

  return 'application/octet-stream';
};

// Nhận biết ảnh truy vấn là URL online hay file local.
const isRemoteUrl = (value: string) => /^https?:\/\//i.test(value);

// Tải ảnh truy vấn từ URL hoặc đọc từ máy để đưa vào visual search service.
const loadQueryImage = async (label: QueryLabel) => {
  if (isRemoteUrl(label.queryImagePath)) {
    const response = await axios.get<ArrayBuffer>(label.queryImagePath, {
      responseType: 'arraybuffer',
      timeout: IMAGE_DOWNLOAD_TIMEOUT_MS,
    });
    const contentType = String(response.headers['content-type'] ?? '');
    const fileName = new URL(label.queryImagePath).pathname.split('/').pop() || label.queryId;

    return {
      buffer: Buffer.from(response.data),
      originalName: fileName,
      mimeType: getMimeType(fileName, contentType),
    };
  }

  const imagePath = resolveWorkspacePath(label.queryImagePath);
  const buffer = await fs.readFile(imagePath);

  return {
    buffer,
    originalName: path.basename(imagePath),
    mimeType: getMimeType(imagePath),
  };
};

// Gộp sản phẩm đúng tuyệt đối và sản phẩm liên quan thành tập kết quả chấp nhận được.
const getRelevantSet = (label: QueryLabel) => {
  return new Set([...label.expectedProductIds, ...label.relevantProductIds]);
};

// Chấm mức liên quan: đúng sản phẩm điểm cao hơn, sản phẩm tương tự điểm thấp hơn.
const getRelevanceGrade = (productId: string, label: QueryLabel) => {
  if (label.expectedProductIds.includes(productId)) {
    return 2;
  }

  if (label.relevantProductIds.includes(productId)) {
    return 1;
  }

  return 0;
};

// Tính DCG để đánh giá thứ tự xếp hạng kết quả trả về.
const getDcg = (grades: number[]) => {
  return grades.reduce((sum, grade, index) => {
    return sum + (Math.pow(2, grade) - 1) / Math.log2(index + 2);
  }, 0);
};

// Tính NDCG@K, giúp biết sản phẩm đúng có được xếp ở vị trí tốt hay không.
const getNdcgAtK = (productIds: string[], label: QueryLabel, k: number) => {
  const grades = productIds.slice(0, k).map((productId) => getRelevanceGrade(productId, label));
  const idealGrades = [
    ...label.expectedProductIds.map(() => 2),
    ...label.relevantProductIds.map(() => 1),
  ]
    .sort((first, second) => second - first)
    .slice(0, k);
  const idealDcg = getDcg(idealGrades);

  return idealDcg ? getDcg(grades) / idealDcg : 0;
};

// Kiểm tra trong top K có ít nhất một sản phẩm đúng hoặc liên quan hay không.
const getHitAtK = (productIds: string[], relevantSet: Set<string>, k: number) => {
  return productIds.slice(0, k).some((productId) => relevantSet.has(productId)) ? 1 : 0;
};

// Tính tỷ lệ sản phẩm đúng/liên quan trong top K kết quả đầu tiên.
const getPrecisionAtK = (productIds: string[], relevantSet: Set<string>, k: number) => {
  const hitCount = productIds.slice(0, k).filter((productId) => relevantSet.has(productId)).length;
  return hitCount / k;
};

// Tìm vị trí đầu tiên mà hệ thống trả về sản phẩm đúng hoặc liên quan.
const getFirstRelevantRank = (productIds: string[], relevantSet: Set<string>) => {
  const index = productIds.findIndex((productId) => relevantSet.has(productId));
  return index >= 0 ? index + 1 : 0;
};

// Chạy tìm kiếm cho một ảnh truy vấn và tính toàn bộ chỉ số đánh giá của ảnh đó.
const evaluateQuery = async (
  label: QueryLabel,
  options: VisualSearchQueryOptions,
): Promise<QueryEvaluationDetail> => {
  const relevantSet = getRelevantSet(label);
  const image = await loadQueryImage(label);
  const result = await visualSearchService.searchByImage(image, options);
  const returnedProductIds = result.items.map((item) => item._id);
  const firstRelevantRank = getFirstRelevantRank(returnedProductIds, relevantSet);

  return {
    queryId: label.queryId,
    queryImagePath: label.queryImagePath,
    expectedProductIds: label.expectedProductIds.join('|'),
    relevantProductIds: label.relevantProductIds.join('|'),
    returnedProductIds: returnedProductIds.join('|'),
    firstRelevantRank,
    recallAt1: getHitAtK(returnedProductIds, relevantSet, 1),
    recallAt5: getHitAtK(returnedProductIds, relevantSet, 5),
    recallAt10: getHitAtK(returnedProductIds, relevantSet, 10),
    precisionAt5: getPrecisionAtK(returnedProductIds, relevantSet, 5),
    precisionAt10: getPrecisionAtK(returnedProductIds, relevantSet, 10),
    reciprocalRank: firstRelevantRank ? 1 / firstRelevantRank : 0,
    ndcgAt10: getNdcgAtK(returnedProductIds, label, 10),
    latencyMs: result.query.processingTimeMs,
    topScore: result.items[0]?.visualScore ?? 0,
    error: '',
  };
};

// Tính trung bình, dùng cho các chỉ số tổng hợp cuối báo cáo.
const average = (values: number[]) => {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

// Làm tròn số để file CSV dễ đọc hơn.
const round = (value: number) => Number(value.toFixed(4));

// Lấy mốc 95% thời gian phản hồi để nhìn được độ trễ trong trường hợp chậm.
const p95 = (values: number[]) => {
  if (!values.length) {
    return 0;
  }

  const sortedValues = [...values].sort((first, second) => first - second);
  return sortedValues[Math.ceil(sortedValues.length * 0.95) - 1] ?? 0;
};

// Bọc giá trị CSV khi nội dung có dấu phẩy, dấu nháy hoặc xuống dòng.
const toCsvValue = (value: string | number) => {
  const stringValue = String(value);
  return /[",\n\r]/.test(stringValue)
    ? `"${stringValue.replace(/"/g, '""')}"`
    : stringValue;
};

// Ghép header và các dòng dữ liệu thành nội dung CSV.
const toCsv = (headers: string[], rows: Array<Record<string, string | number>>) => {
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => toCsvValue(row[header] ?? '')).join(',')),
  ].join('\n');
};

// Tạo thư mục đích trước khi ghi file kết quả.
const ensureOutputDir = async (filePath: string) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
};

// Ghi một bảng kết quả đánh giá ra file CSV.
const writeCsv = async (
  filePath: string,
  headers: string[],
  rows: Array<Record<string, string | number>>,
) => {
  await ensureOutputDir(filePath);
  await fs.writeFile(filePath, `${toCsv(headers, rows)}\n`, 'utf8');
};

// Tổng hợp các dòng đánh giá chi tiết thành một dòng báo cáo thí nghiệm.
const getSummaryRow = (
  method: string,
  details: QueryEvaluationDetail[],
  failedCount: number,
) => {
  const latencies = details.map((detail) => detail.latencyMs);

  return {
    method,
    queryCount: details.length,
    recallAt1: round(average(details.map((detail) => detail.recallAt1))),
    recallAt5: round(average(details.map((detail) => detail.recallAt5))),
    recallAt10: round(average(details.map((detail) => detail.recallAt10))),
    precisionAt5: round(average(details.map((detail) => detail.precisionAt5))),
    precisionAt10: round(average(details.map((detail) => detail.precisionAt10))),
    mrr: round(average(details.map((detail) => detail.reciprocalRank))),
    ndcgAt10: round(average(details.map((detail) => detail.ndcgAt10))),
    avgLatencyMs: round(average(latencies)),
    p95LatencyMs: round(p95(latencies)),
    note: failedCount
      ? `failedQueryCount=${failedCount}`
      : 'offline evaluation from labeled visual search queries',
  };
};

// Tạo bộ tham số tìm kiếm cho từng ảnh, có thể dùng thêm filter từ nhãn nếu cần.
const getEvaluationOptions = (label: QueryLabel): VisualSearchQueryOptions => {
  const limit = getNumberArg('limit', DEFAULT_LIMIT);
  const scoreThreshold = getNumberArg('score-threshold');
  const useLabelFilters = hasFlag('--use-label-filters');

  return {
    limit,
    ...(scoreThreshold !== undefined ? { scoreThreshold } : {}),
    ...(useLabelFilters && label.expectedCategoryId ? { categoryId: [label.expectedCategoryId] } : {}),
    ...(useLabelFilters && label.expectedColor ? { color: [label.expectedColor] } : {}),
  };
};

// Luồng chính: đọc nhãn, chạy từng ảnh qua hệ thống và xuất báo cáo đánh giá.
const run = async () => {
  const labelsPath = resolveLabelsPath();
  const summaryOutput = resolveWorkspacePath(getStringArg('output', DEFAULT_SUMMARY_OUTPUT)!);
  const detailOutput = resolveWorkspacePath(getStringArg('detail-output', DEFAULT_DETAIL_OUTPUT)!);
  const method = getStringArg(
    'method',
    `${process.env.VISUAL_EMBEDDING_MODEL ?? 'visual-search'}-${process.env.VISUAL_EMBEDDING_PROVIDER ?? 'mock'}`,
  )!;
  const maxQueries = getNumberArg('max-queries');
  const csvContent = await fs.readFile(labelsPath, 'utf8');
  const labels = parseCsv(csvContent)
    .map(mapLabel)
    .filter((label) => (
      label.queryId &&
      label.queryImagePath &&
      getRelevantSet(label).size > 0
    ))
    .slice(0, maxQueries);

  if (!labels.length) {
    console.log(JSON.stringify({
      labelsPath,
      message: 'No evaluable visual search labels found. Add rows to docs_vs/visual-search-query-labels.csv before running evaluation.',
      expectedColumns: [
        'queryId',
        'queryImagePath',
        'expectedProductIds',
        'relevantProductIds',
      ],
    }, null, 2));
    return;
  }

  await connectDB();

  const successfulDetails: QueryEvaluationDetail[] = [];
  const failedDetails: QueryEvaluationDetail[] = [];

  for (const label of labels) {
    try {
      successfulDetails.push(await evaluateQuery(label, getEvaluationOptions(label)));
    } catch (error) {
      failedDetails.push({
        queryId: label.queryId,
        queryImagePath: label.queryImagePath,
        expectedProductIds: label.expectedProductIds.join('|'),
        relevantProductIds: label.relevantProductIds.join('|'),
        returnedProductIds: '',
        firstRelevantRank: 0,
        recallAt1: 0,
        recallAt5: 0,
        recallAt10: 0,
        precisionAt5: 0,
        precisionAt10: 0,
        reciprocalRank: 0,
        ndcgAt10: 0,
        latencyMs: 0,
        topScore: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const detailHeaders = [
    'queryId',
    'queryImagePath',
    'expectedProductIds',
    'relevantProductIds',
    'returnedProductIds',
    'firstRelevantRank',
    'recallAt1',
    'recallAt5',
    'recallAt10',
    'precisionAt5',
    'precisionAt10',
    'reciprocalRank',
    'ndcgAt10',
    'latencyMs',
    'topScore',
    'error',
  ];
  const summaryHeaders = [
    'method',
    'queryCount',
    'recallAt1',
    'recallAt5',
    'recallAt10',
    'precisionAt5',
    'precisionAt10',
    'mrr',
    'ndcgAt10',
    'avgLatencyMs',
    'p95LatencyMs',
    'note',
  ];

  await writeCsv(
    detailOutput,
    detailHeaders,
    [...successfulDetails, ...failedDetails] as unknown as Array<Record<string, string | number>>,
  );
  await writeCsv(
    summaryOutput,
    summaryHeaders,
    [getSummaryRow(method, successfulDetails, failedDetails.length)],
  );

  console.log(JSON.stringify({
    labelsPath,
    summaryOutput,
    detailOutput,
    queryCount: successfulDetails.length,
    failedQueryCount: failedDetails.length,
    summary: getSummaryRow(method, successfulDetails, failedDetails.length),
  }, null, 2));
};

run()
  .catch((error) => {
    console.error('Visual search evaluation failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
