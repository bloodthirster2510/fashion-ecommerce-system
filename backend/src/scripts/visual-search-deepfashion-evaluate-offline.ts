import axios from 'axios';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

type CsvRow = Record<string, string>;

type GalleryRow = {
  galleryImageId: string;
  productId: string;
  imagePath: string;
  imageSource?: string;
  productName?: string;
  categoryName?: string;
};

type QueryLabel = {
  queryId: string;
  queryImagePath: string;
  expectedProductIds: string[];
  relevantProductIds: string[];
};

type ScoredGalleryItem = {
  row: GalleryRow;
  visualScore: number;
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

type EmbeddingCache = {
  method: string;
  serviceUrl: string;
  serviceFingerprint?: string;
  embeddings: Record<string, number[]>;
};

type EmbeddingServiceHealth = {
  status?: string;
  model?: string;
  modelVersion?: string;
  backend?: string;
  modelLoaded?: boolean;
  openClipModel?: string | null;
  openClipPretrained?: string | null;
  openClipLoadArgs?: Record<string, unknown> | null;
  device?: string;
};

const DEFAULT_GALLERY_PATH = 'docs_vs/deepfashion-subset/deepfashion-gallery.csv';
const DEFAULT_LABELS_PATH = 'docs_vs/deepfashion-subset/deepfashion-query-labels.csv';
const DEFAULT_OUTPUT_PATH = 'docs_vs/deepfashion-subset/deepfashion-model-comparison-results.csv';
const DEFAULT_DETAIL_OUTPUT_PATH = 'docs_vs/deepfashion-subset/deepfashion-model-comparison-details.csv';
const DEFAULT_LIMIT = 10;
const DEFAULT_EMBEDDING_SERVICE_URL = 'http://localhost:8001';
const DEFAULT_METHOD = 'visual-embedding-model';
const EMBEDDING_TIMEOUT_MS = 60_000;

const getStringArg = (name: string, fallback?: string) => {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
};

const getNumberArg = (name: string, fallback?: number) => {
  const rawValue = getStringArg(name);
  const value = Number(rawValue);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

const getRepoRoot = () => (
  path.basename(process.cwd()) === 'backend'
    ? path.resolve(process.cwd(), '..')
    : process.cwd()
);

const getBackendRoot = () => path.resolve(getRepoRoot(), 'backend');

const resolveBackendPath = (filePath: string) => (
  path.isAbsolute(filePath)
    ? filePath
    : path.resolve(getBackendRoot(), filePath)
);

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

const toCsvValue = (value: string | number) => {
  const stringValue = String(value);
  return /[",\n\r]/.test(stringValue)
    ? `"${stringValue.replace(/"/g, '""')}"`
    : stringValue;
};

const toCsv = (headers: string[], rows: Array<Record<string, string | number>>) => [
  headers.join(','),
  ...rows.map((row) => headers.map((header) => toCsvValue(row[header] ?? '')).join(',')),
].join('\n');

const splitIds = (value?: string) => {
  if (!value) {
    return [];
  }

  return value
    .split(/[|;,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const getMimeType = (filePath: string) => {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  return 'application/octet-stream';
};

const loadCsv = async <T>(filePath: string, mapper: (row: CsvRow) => T) => {
  const resolvedPath = resolveBackendPath(filePath);
  if (!existsSync(resolvedPath)) {
    throw new Error(`CSV not found: ${resolvedPath}`);
  }

  const content = await fs.readFile(resolvedPath, 'utf8');
  return parseCsv(content).map(mapper);
};

const mapGalleryRow = (row: CsvRow): GalleryRow => ({
  galleryImageId: row.galleryImageId,
  productId: row.productId,
  imagePath: row.imagePath,
  imageSource: row.imageSource,
  productName: row.productName,
  categoryName: row.categoryName,
});

const mapLabel = (row: CsvRow): QueryLabel => ({
  queryId: row.queryId,
  queryImagePath: row.queryImagePath,
  expectedProductIds: splitIds(row.expectedProductIds),
  relevantProductIds: splitIds(row.relevantProductIds),
});

const getServiceFingerprint = (health: EmbeddingServiceHealth | null) => {
  if (!health) {
    return 'unknown-service';
  }

  return [
    health.model ?? '',
    health.modelVersion ?? '',
    health.backend ?? '',
    health.openClipModel ?? '',
    health.openClipPretrained ?? '',
    JSON.stringify(health.openClipLoadArgs ?? {}),
  ].join('|');
};

const loadCache = async (
  cachePath: string,
  method: string,
  serviceUrl: string,
  serviceFingerprint: string,
): Promise<EmbeddingCache> => {
  if (!existsSync(cachePath)) {
    return { method, serviceUrl, serviceFingerprint, embeddings: {} };
  }

  const parsed = JSON.parse(await fs.readFile(cachePath, 'utf8')) as Partial<EmbeddingCache>;
  if (
    parsed.method !== method
    || parsed.serviceUrl !== serviceUrl
    || parsed.serviceFingerprint !== serviceFingerprint
  ) {
    return { method, serviceUrl, serviceFingerprint, embeddings: {} };
  }

  return {
    method,
    serviceUrl,
    serviceFingerprint,
    embeddings: parsed.embeddings ?? {},
  };
};

const saveCache = async (cachePath: string, cache: EmbeddingCache) => {
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, `${JSON.stringify(cache)}\n`, 'utf8');
};

const fetchServiceHealth = async (serviceUrl: string) => {
  try {
    const response = await axios.get<EmbeddingServiceHealth>(
      `${serviceUrl.replace(/\/$/, '')}/health`,
      { timeout: 5000 },
    );
    return response.data;
  } catch {
    return null;
  }
};

const createEmbedding = async (imagePath: string, serviceUrl: string, cache: EmbeddingCache) => {
  const resolvedImagePath = resolveBackendPath(imagePath);
  const cacheKey = path.relative(getBackendRoot(), resolvedImagePath).replace(/\\/g, '/');
  const cachedEmbedding = cache.embeddings[cacheKey];
  if (cachedEmbedding) {
    return cachedEmbedding;
  }

  const imageBuffer = await fs.readFile(resolvedImagePath);
  const formData = new FormData();
  formData.append(
    'file',
    new Blob([imageBuffer], { type: getMimeType(resolvedImagePath) }),
    path.basename(resolvedImagePath),
  );

  const response = await axios.post<{ embedding: number[] }>(
    `${serviceUrl.replace(/\/$/, '')}/embed/image`,
    formData,
    { timeout: EMBEDDING_TIMEOUT_MS },
  );
  const embedding = response.data.embedding;
  if (!Array.isArray(embedding) || !embedding.length) {
    throw new Error(`Embedding service returned an empty embedding for ${imagePath}`);
  }

  cache.embeddings[cacheKey] = embedding;
  return embedding;
};

const cosineSimilarity = (first: number[], second: number[]) => {
  const dimension = Math.min(first.length, second.length);
  if (!dimension) {
    return 0;
  }

  let dot = 0;
  let firstNorm = 0;
  let secondNorm = 0;

  for (let index = 0; index < dimension; index += 1) {
    const firstValue = first[index] ?? 0;
    const secondValue = second[index] ?? 0;
    dot += firstValue * secondValue;
    firstNorm += firstValue * firstValue;
    secondNorm += secondValue * secondValue;
  }

  if (!firstNorm || !secondNorm) {
    return 0;
  }

  return dot / (Math.sqrt(firstNorm) * Math.sqrt(secondNorm));
};

const groupByProduct = (items: ScoredGalleryItem[]) => {
  const bestByProductId = new Map<string, ScoredGalleryItem>();

  items.forEach((item) => {
    const existing = bestByProductId.get(item.row.productId);
    if (!existing || item.visualScore > existing.visualScore) {
      bestByProductId.set(item.row.productId, item);
    }
  });

  return Array.from(bestByProductId.values())
    .sort((first, second) => second.visualScore - first.visualScore);
};

const getRelevantSet = (label: QueryLabel) => {
  return new Set([...label.expectedProductIds, ...label.relevantProductIds]);
};

const getRelevanceGrade = (productId: string, label: QueryLabel) => {
  if (label.expectedProductIds.includes(productId)) {
    return 2;
  }

  if (label.relevantProductIds.includes(productId)) {
    return 1;
  }

  return 0;
};

const getDcg = (grades: number[]) => {
  return grades.reduce((sum, grade, index) => {
    return sum + (Math.pow(2, grade) - 1) / Math.log2(index + 2);
  }, 0);
};

const getNdcgAtK = (productIds: string[], label: QueryLabel, k: number) => {
  const grades = productIds.slice(0, k).map((productId) => getRelevanceGrade(productId, label));
  const idealGrades = [
    ...label.expectedProductIds.map(() => 2),
    ...label.relevantProductIds.map(() => 1),
  ].sort((first, second) => second - first).slice(0, k);
  const idealDcg = getDcg(idealGrades);

  return idealDcg ? getDcg(grades) / idealDcg : 0;
};

const getHitAtK = (productIds: string[], relevantSet: Set<string>, k: number) => {
  return productIds.slice(0, k).some((productId) => relevantSet.has(productId)) ? 1 : 0;
};

const getPrecisionAtK = (productIds: string[], relevantSet: Set<string>, k: number) => {
  const hitCount = productIds.slice(0, k).filter((productId) => relevantSet.has(productId)).length;
  return hitCount / k;
};

const getFirstRelevantRank = (productIds: string[], relevantSet: Set<string>) => {
  const index = productIds.findIndex((productId) => relevantSet.has(productId));
  return index >= 0 ? index + 1 : 0;
};

const average = (values: number[]) => {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const round = (value: number) => Number(value.toFixed(4));

const p95 = (values: number[]) => {
  if (!values.length) {
    return 0;
  }

  const sortedValues = [...values].sort((first, second) => first - second);
  return sortedValues[Math.ceil(sortedValues.length * 0.95) - 1] ?? 0;
};

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
      : 'offline DeepFashion image retrieval evaluation',
  };
};

const run = async () => {
  const galleryPath = getStringArg('gallery', DEFAULT_GALLERY_PATH)!;
  const labelsPath = getStringArg('labels', DEFAULT_LABELS_PATH)!;
  const outputPath = resolveBackendPath(getStringArg('output', DEFAULT_OUTPUT_PATH)!);
  const detailOutputPath = resolveBackendPath(getStringArg('detail-output', DEFAULT_DETAIL_OUTPUT_PATH)!);
  const method = getStringArg('method', process.env.VISUAL_EMBEDDING_MODEL ?? DEFAULT_METHOD)!;
  const serviceUrl = getStringArg('embedding-service-url', process.env.VISUAL_EMBEDDING_SERVICE_URL ?? DEFAULT_EMBEDDING_SERVICE_URL)!;
  const limit = getNumberArg('limit', DEFAULT_LIMIT)!;
  const maxQueries = getNumberArg('max-queries');
  const scoreThreshold = getNumberArg('score-threshold', 0)!;
  const serviceHealth = await fetchServiceHealth(serviceUrl);
  const serviceFingerprint = getServiceFingerprint(serviceHealth);
  const cachePath = resolveBackendPath(
    getStringArg('cache', `docs_vs/deepfashion-subset/embedding-cache-${method}.json`)!,
  );

  const galleryRows = await loadCsv(galleryPath, mapGalleryRow);
  const labels = (await loadCsv(labelsPath, mapLabel))
    .filter((label) => label.queryId && label.queryImagePath && getRelevantSet(label).size > 0)
    .slice(0, maxQueries);
  const cache = await loadCache(cachePath, method, serviceUrl, serviceFingerprint);

  const galleryEmbeddings: Array<{ row: GalleryRow; embedding: number[] }> = [];
  for (const row of galleryRows) {
    galleryEmbeddings.push({
      row,
      embedding: await createEmbedding(row.imagePath, serviceUrl, cache),
    });
  }

  await saveCache(cachePath, cache);

  const successfulDetails: QueryEvaluationDetail[] = [];
  const failedDetails: QueryEvaluationDetail[] = [];

  for (const label of labels) {
    const startedAt = Date.now();
    try {
      const queryEmbedding = await createEmbedding(label.queryImagePath, serviceUrl, cache);
      const scoredRows = groupByProduct(
        galleryEmbeddings
          .map((galleryItem) => ({
            row: galleryItem.row,
            visualScore: cosineSimilarity(queryEmbedding, galleryItem.embedding),
          }))
          .filter((item) => item.visualScore >= scoreThreshold),
      );
      const returnedProductIds = scoredRows.slice(0, limit).map((item) => item.row.productId);
      const relevantSet = getRelevantSet(label);
      const firstRelevantRank = getFirstRelevantRank(returnedProductIds, relevantSet);

      successfulDetails.push({
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
        latencyMs: Date.now() - startedAt,
        topScore: scoredRows[0]?.visualScore ?? 0,
        error: '',
      });
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

  await saveCache(cachePath, cache);

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
  const summary = getSummaryRow(method, successfulDetails, failedDetails.length);

  await fs.mkdir(path.dirname(detailOutputPath), { recursive: true });
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(
    detailOutputPath,
    `${toCsv(detailHeaders, [...successfulDetails, ...failedDetails] as unknown as Array<Record<string, string | number>>)}\n`,
    'utf8',
  );
  await fs.writeFile(outputPath, `${toCsv(summaryHeaders, [summary])}\n`, 'utf8');

  console.log(JSON.stringify({
    galleryPath: resolveBackendPath(galleryPath),
    labelsPath: resolveBackendPath(labelsPath),
    outputPath,
    detailOutputPath,
    cachePath,
    serviceHealth,
    serviceFingerprint,
    cacheEmbeddingCount: Object.keys(cache.embeddings).length,
    galleryCount: galleryRows.length,
    queryCount: successfulDetails.length,
    failedQueryCount: failedDetails.length,
    summary,
  }, null, 2));
};

run().catch((error) => {
  console.error('DeepFashion offline evaluation failed:', error);
  process.exitCode = 1;
});
