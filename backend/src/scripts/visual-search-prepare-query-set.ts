import axios from 'axios';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

type CsvRow = Record<string, string>;

type GalleryRow = {
  galleryImageId: string;
  productId: string;
  imageUrl: string;
  imageSource: string;
  productName: string;
  categoryId: string;
  categoryName: string;
  gender: string;
  color: string;
  isActive: string;
  availableQuantity: string;
};

const DEFAULT_GALLERY_PATH = 'docs_vs/visual-search-gallery.csv';
const DEFAULT_OUTPUT_PATH = 'docs_vs/visual-search-query-label-draft.csv';
const DEFAULT_IMAGE_DIR = 'docs_vs/query-images';
const DEFAULT_LIMIT = 20;
const DOWNLOAD_TIMEOUT_MS = 30_000;
const LABEL_HEADERS = [
  'queryId',
  'queryImagePath',
  'querySource',
  'expectedProductIds',
  'relevantProductIds',
  'expectedCategoryId',
  'expectedColor',
  'difficulty',
  'note',
];

const getStringArg = (name: string, fallback: string) => {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
};

const getNumberArg = (name: string, fallback: number) => {
  const value = Number(getStringArg(name, String(fallback)));
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const hasFlag = (flag: string) => process.argv.includes(flag);

const getRepoRoot = () => (
  path.basename(process.cwd()) === 'backend'
    ? path.resolve(process.cwd(), '..')
    : process.cwd()
);

const resolveBackendPath = (filePath: string) => (
  path.isAbsolute(filePath)
    ? filePath
    : path.resolve(getRepoRoot(), 'backend', filePath)
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

const toGalleryRows = (rows: CsvRow[]): GalleryRow[] => rows.map((row) => ({
  galleryImageId: row.galleryImageId,
  productId: row.productId,
  imageUrl: row.imageUrl,
  imageSource: row.imageSource,
  productName: row.productName,
  categoryId: row.categoryId,
  categoryName: row.categoryName,
  gender: row.gender,
  color: row.color,
  isActive: row.isActive,
  availableQuantity: row.availableQuantity,
}));

const slugify = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 64) || 'query-image';

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

const getImageExtension = (imageUrl: string) => {
  try {
    const extension = path.extname(new URL(imageUrl).pathname).toLowerCase();
    return extension && extension.length <= 6 ? extension : '.jpg';
  } catch {
    return '.jpg';
  }
};

const pickProductRepresentativeRows = (rows: GalleryRow[]) => {
  const rowByProductId = new Map<string, GalleryRow>();

  rows.forEach((row) => {
    if (!row.productId || !row.imageUrl || row.isActive !== 'true') {
      return;
    }

    const existingRow = rowByProductId.get(row.productId);
    const rowAvailability = Number(row.availableQuantity) || 0;
    const existingAvailability = Number(existingRow?.availableQuantity) || 0;
    const rowRank = row.imageSource === 'product_image' ? 2 : 1;
    const existingRank = existingRow?.imageSource === 'product_image' ? 2 : 1;

    if (
      !existingRow ||
      rowAvailability > existingAvailability ||
      (rowAvailability === existingAvailability && rowRank > existingRank)
    ) {
      rowByProductId.set(row.productId, row);
    }
  });

  return Array.from(rowByProductId.values());
};

const selectDiverseRows = (rows: GalleryRow[], limit: number) => {
  const rowsByCategoryGender = new Map<string, GalleryRow[]>();

  rows
    .sort((first, second) => first.productName.localeCompare(second.productName, 'vi'))
    .forEach((row) => {
      const key = `${row.categoryId || 'unknown'}:${row.gender || 'unknown'}`;
      const categoryRows = rowsByCategoryGender.get(key) ?? [];
      categoryRows.push(row);
      rowsByCategoryGender.set(key, categoryRows);
    });

  const selectedRows: GalleryRow[] = [];
  const queues = Array.from(rowsByCategoryGender.values());

  while (selectedRows.length < limit && queues.some((queue) => queue.length > 0)) {
    for (const queue of queues) {
      const nextRow = queue.shift();

      if (nextRow) {
        selectedRows.push(nextRow);
      }

      if (selectedRows.length >= limit) {
        break;
      }
    }
  }

  return selectedRows;
};

const downloadImage = async (imageUrl: string, outputPath: string, overwrite: boolean) => {
  if (!overwrite && existsSync(outputPath)) {
    return { skipped: true, bytes: 0 };
  }

  const response = await axios.get<ArrayBuffer>(imageUrl, {
    responseType: 'arraybuffer',
    timeout: DOWNLOAD_TIMEOUT_MS,
  });
  const buffer = Buffer.from(response.data);

  await fs.writeFile(outputPath, buffer);
  return { skipped: false, bytes: buffer.length };
};

const run = async () => {
  const galleryPath = resolveBackendPath(getStringArg('gallery', DEFAULT_GALLERY_PATH));
  const outputPath = resolveBackendPath(getStringArg('output', DEFAULT_OUTPUT_PATH));
  const imageDir = resolveBackendPath(getStringArg('image-dir', DEFAULT_IMAGE_DIR));
  const backendRoot = path.resolve(getRepoRoot(), 'backend');
  const limit = getNumberArg('limit', DEFAULT_LIMIT);
  const overwriteImages = hasFlag('--overwrite-images');

  if (!existsSync(galleryPath)) {
    throw new Error(`Gallery file not found: ${galleryPath}`);
  }

  const galleryContent = await fs.readFile(galleryPath, 'utf8');
  const representativeRows = pickProductRepresentativeRows(toGalleryRows(parseCsv(galleryContent)));
  const selectedRows = selectDiverseRows(representativeRows, limit);

  await fs.mkdir(imageDir, { recursive: true });

  const labelRows: Array<Record<string, string>> = [];
  const failures: Array<{ imageUrl: string; message: string }> = [];
  let downloaded = 0;
  let skipped = 0;

  for (const [index, row] of selectedRows.entries()) {
    const queryId = `query_review_${String(index + 1).padStart(3, '0')}`;
    const fileName = `${queryId}_${slugify(row.productName)}${getImageExtension(row.imageUrl)}`;
    const imagePath = path.join(imageDir, fileName);

    try {
      const result = await downloadImage(row.imageUrl, imagePath, overwriteImages);
      if (result.skipped) {
        skipped += 1;
      } else {
        downloaded += 1;
      }

      labelRows.push({
        queryId,
        queryImagePath: path.relative(backendRoot, imagePath).replace(/\\/g, '/'),
        querySource: 'catalog_seed_review',
        expectedProductIds: row.productId,
        relevantProductIds: '',
        expectedCategoryId: row.categoryId,
        expectedColor: row.color,
        difficulty: 'easy',
        note: `Draft label, human review required. ${row.productName} (${row.categoryName || 'unknown category'}). Source: ${row.imageUrl}`,
      });
    } catch (error) {
      failures.push({
        imageUrl: row.imageUrl,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${toCsv(LABEL_HEADERS, labelRows)}\n`, 'utf8');

  console.log(JSON.stringify({
    galleryPath,
    outputPath,
    imageDir,
    requestedLimit: limit,
    selectedCount: selectedRows.length,
    labelCount: labelRows.length,
    downloaded,
    skipped,
    failureCount: failures.length,
    failures,
    note: 'Draft labels are a starting point. Review expectedProductIds and add relevantProductIds before final evaluation.',
  }, null, 2));
};

run().catch((error) => {
  console.error('Visual search query set preparation failed:', error);
  process.exitCode = 1;
});
