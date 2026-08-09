import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

type PartitionRow = {
  imageName: string;
  itemId: string;
  split: 'train' | 'query' | 'gallery';
  categoryName: string;
};

const DEFAULT_OUT_DIR = 'docs_vs/deepfashion-subset';
const DEFAULT_QUERY_COUNT = 100;
const DEFAULT_GALLERY_COUNT = 1000;

const galleryHeaders = [
  'galleryImageId',
  'productId',
  'imagePath',
  'imageSource',
  'productName',
  'categoryName',
  'itemId',
  'split',
  'note',
];

const labelHeaders = [
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

const getStringArg = (name: string, fallback?: string) => {
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

const getBackendRoot = () => path.resolve(getRepoRoot(), 'backend');

const resolveBackendPath = (filePath: string) => (
  path.isAbsolute(filePath)
    ? filePath
    : path.resolve(getBackendRoot(), filePath)
);

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

const toImageId = (imageName: string) => imageName
  .replace(/^Img\//i, '')
  .replace(/^img\//i, '')
  .replace(/\.[a-z0-9]+$/i, '')
  .replace(/[^a-zA-Z0-9_-]+/g, '_')
  .slice(0, 160);

const normalizeImageRelativePath = (imageName: string) => imageName.replace(/\\/g, '/').replace(/^\/+/, '');

const stripImageRootPrefixes = (imageName: string) => {
  let relativePath = normalizeImageRelativePath(imageName);
  while (/^img\//i.test(relativePath)) {
    relativePath = relativePath.replace(/^img\//i, '');
  }

  return relativePath;
};

const getCategoryFromImageName = (imageName: string) => {
  const [gender, category] = stripImageRootPrefixes(imageName).split('/');
  return gender && category ? `${gender}/${category}` : 'unknown';
};

const getDeepFashionImagePath = (datasetRoot: string, imageName: string) => {
  const normalizedPath = normalizeImageRelativePath(imageName);
  const relativeWithoutImageRoot = stripImageRootPrefixes(imageName);
  const candidates = [
    path.resolve(datasetRoot, normalizedPath),
    path.resolve(datasetRoot, relativeWithoutImageRoot),
    path.resolve(datasetRoot, 'Img', relativeWithoutImageRoot),
    path.resolve(datasetRoot, 'Img', 'img', relativeWithoutImageRoot),
    path.resolve(datasetRoot, 'Img', 'img', 'img', relativeWithoutImageRoot),
    path.resolve(datasetRoot, 'img', relativeWithoutImageRoot),
    path.resolve(datasetRoot, 'img', 'img', relativeWithoutImageRoot),
    path.resolve(datasetRoot, 'img', 'img', 'img', relativeWithoutImageRoot),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
};

const findDeepFashionFile = (datasetRoot: string, candidates: string[]) => {
  const filePath = candidates
    .map((candidate) => path.resolve(datasetRoot, candidate))
    .find((candidate) => existsSync(candidate));

  if (!filePath) {
    throw new Error(`Cannot find any of: ${candidates.join(', ')} under ${datasetRoot}`);
  }

  return filePath;
};

const parseItemCategories = async (datasetRoot: string) => {
  const annotationPath = findDeepFashionFile(datasetRoot, [
    'Anno/list_item_inshop.txt',
    'Anno/list_item_inshop.csv',
    'list_item_inshop.txt',
  ]);
  const content = await fs.readFile(annotationPath, 'utf8');
  const categoryByItemId = new Map<string, string>();

  content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      if (/^\d+$/.test(line) || /^item_id\s+/i.test(line)) {
        return;
      }

      const [itemId, ...categoryParts] = line.split(/\s+/);
      if (itemId && categoryParts.length > 0) {
        categoryByItemId.set(itemId, categoryParts.join(' '));
      }
    });

  return categoryByItemId;
};

const parsePartitionRows = async (datasetRoot: string, categoryByItemId: Map<string, string>) => {
  const partitionPath = findDeepFashionFile(datasetRoot, [
    'Eval/list_eval_partition.txt',
    'Eval/list_eval_partition.csv',
    'list_eval_partition.txt',
  ]);
  const content = await fs.readFile(partitionPath, 'utf8');
  const validSplits = new Set(['train', 'query', 'gallery']);
  const rows: PartitionRow[] = [];

  content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      if (/^\d+$/.test(line) || /^image_name\s+/i.test(line)) {
        return;
      }

      const [imageName, itemId, split] = line.split(/\s+/);
      if (!imageName || !itemId || !validSplits.has(split)) {
        return;
      }

      rows.push({
        imageName,
        itemId,
        split: split as PartitionRow['split'],
        categoryName: categoryByItemId.get(itemId) ?? getCategoryFromImageName(imageName),
      });
    });

  return rows;
};

const groupByItemId = (rows: PartitionRow[]) => {
  const rowByItemId = new Map<string, PartitionRow[]>();

  rows.forEach((row) => {
    const itemRows = rowByItemId.get(row.itemId) ?? [];
    itemRows.push(row);
    rowByItemId.set(row.itemId, itemRows);
  });

  return rowByItemId;
};

const selectDiverseQueries = (
  queryRows: PartitionRow[],
  galleryByItemId: Map<string, PartitionRow[]>,
  queryCount: number,
) => {
  const queryRowsByCategory = new Map<string, PartitionRow[]>();

  queryRows
    .filter((row) => galleryByItemId.has(row.itemId))
    .sort((first, second) => first.itemId.localeCompare(second.itemId))
    .forEach((row) => {
      const rows = queryRowsByCategory.get(row.categoryName) ?? [];
      rows.push(row);
      queryRowsByCategory.set(row.categoryName, rows);
    });

  const selectedRows: PartitionRow[] = [];
  const queues = Array.from(queryRowsByCategory.values());

  while (selectedRows.length < queryCount && queues.some((queue) => queue.length > 0)) {
    for (const queue of queues) {
      const row = queue.shift();
      if (row) {
        selectedRows.push(row);
      }

      if (selectedRows.length >= queryCount) {
        break;
      }
    }
  }

  return selectedRows;
};

const selectGalleryRows = (
  selectedQueries: PartitionRow[],
  galleryRows: PartitionRow[],
  galleryCount: number,
) => {
  const selectedItemIds = new Set(selectedQueries.map((row) => row.itemId));
  const mandatoryRows = galleryRows.filter((row) => selectedItemIds.has(row.itemId));
  const selectedImageNames = new Set(mandatoryRows.map((row) => row.imageName));
  const selectedRows = [...mandatoryRows];

  const negativeRowsByCategory = new Map<string, PartitionRow[]>();
  galleryRows
    .filter((row) => !selectedImageNames.has(row.imageName))
    .sort((first, second) => first.itemId.localeCompare(second.itemId))
    .forEach((row) => {
      const rows = negativeRowsByCategory.get(row.categoryName) ?? [];
      rows.push(row);
      negativeRowsByCategory.set(row.categoryName, rows);
    });

  const queues = Array.from(negativeRowsByCategory.values());
  while (selectedRows.length < galleryCount && queues.some((queue) => queue.length > 0)) {
    for (const queue of queues) {
      const row = queue.shift();
      if (row) {
        selectedRows.push(row);
      }

      if (selectedRows.length >= galleryCount) {
        break;
      }
    }
  }

  return selectedRows.slice(0, Math.max(galleryCount, mandatoryRows.length));
};

const copyImageIfNeeded = async (
  datasetRoot: string,
  imageName: string,
  outputImageDir: string,
  copyImages: boolean,
) => {
  if (!copyImages) {
    return getDeepFashionImagePath(datasetRoot, imageName);
  }

  const sourcePath = getDeepFashionImagePath(datasetRoot, imageName);
  const relativePath = stripImageRootPrefixes(imageName);
  const outputPath = path.resolve(outputImageDir, relativePath);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.copyFile(sourcePath, outputPath);
  return outputPath;
};

const run = async () => {
  const datasetRootArg = getStringArg('dataset-root');
  if (!datasetRootArg) {
    throw new Error('Missing --dataset-root=<path-to-deepfashion-in-shop>');
  }

  const datasetRoot = path.resolve(datasetRootArg);
  const outputDir = resolveBackendPath(getStringArg('out-dir', DEFAULT_OUT_DIR)!);
  const queryCount = getNumberArg('query-count', DEFAULT_QUERY_COUNT);
  const galleryCount = getNumberArg('gallery-count', DEFAULT_GALLERY_COUNT);
  const copyImages = !hasFlag('--no-copy-images');
  const outputImageDir = path.resolve(outputDir, 'images');

  if (!existsSync(datasetRoot)) {
    throw new Error(`Dataset root not found: ${datasetRoot}`);
  }

  const categoryByItemId = await parseItemCategories(datasetRoot);
  const rows = await parsePartitionRows(datasetRoot, categoryByItemId);
  const galleryRows = rows.filter((row) => row.split === 'gallery');
  const queryRows = rows.filter((row) => row.split === 'query');
  const galleryByItemId = groupByItemId(galleryRows);
  const selectedQueries = selectDiverseQueries(queryRows, galleryByItemId, queryCount);
  const selectedGalleryRows = selectGalleryRows(selectedQueries, galleryRows, galleryCount);

  await fs.mkdir(outputDir, { recursive: true });

  const galleryCsvRows: Array<Record<string, string>> = [];
  const labelCsvRows: Array<Record<string, string>> = [];

  for (const row of selectedGalleryRows) {
    const imagePath = await copyImageIfNeeded(datasetRoot, row.imageName, outputImageDir, copyImages);
    galleryCsvRows.push({
      galleryImageId: `deepfashion:${toImageId(row.imageName)}`,
      productId: row.itemId,
      imagePath: path.relative(getBackendRoot(), imagePath).replace(/\\/g, '/'),
      imageSource: 'deepfashion_gallery',
      productName: row.itemId,
      categoryName: row.categoryName,
      itemId: row.itemId,
      split: row.split,
      note: row.imageName,
    });
  }

  for (const [index, row] of selectedQueries.entries()) {
    const imagePath = await copyImageIfNeeded(datasetRoot, row.imageName, outputImageDir, copyImages);
    labelCsvRows.push({
      queryId: `df_query_${String(index + 1).padStart(4, '0')}`,
      queryImagePath: path.relative(getBackendRoot(), imagePath).replace(/\\/g, '/'),
      querySource: 'deepfashion_inshop',
      expectedProductIds: row.itemId,
      relevantProductIds: '',
      expectedCategoryId: row.categoryName,
      expectedColor: '',
      difficulty: 'medium',
      note: `DeepFashion In-shop item match. Original: ${row.imageName}`,
    });
  }

  const galleryOutput = path.resolve(outputDir, 'deepfashion-gallery.csv');
  const labelsOutput = path.resolve(outputDir, 'deepfashion-query-labels.csv');
  await fs.writeFile(galleryOutput, `${toCsv(galleryHeaders, galleryCsvRows)}\n`, 'utf8');
  await fs.writeFile(labelsOutput, `${toCsv(labelHeaders, labelCsvRows)}\n`, 'utf8');
  await fs.writeFile(
    path.resolve(outputDir, 'deepfashion-subset-manifest.json'),
    `${JSON.stringify({
      datasetRoot,
      outputDir,
      copyImages,
      queryCount: labelCsvRows.length,
      galleryCount: galleryCsvRows.length,
      uniqueQueryItems: new Set(selectedQueries.map((row) => row.itemId)).size,
      uniqueGalleryItems: new Set(selectedGalleryRows.map((row) => row.itemId)).size,
      categoryCount: new Set(selectedQueries.map((row) => row.categoryName)).size,
      note: 'Use the same gallery/query files for CLIP and FashionCLIP; only change embedding model.',
    }, null, 2)}\n`,
    'utf8',
  );

  console.log(JSON.stringify({
    galleryOutput,
    labelsOutput,
    outputImageDir: copyImages ? outputImageDir : null,
    queryCount: labelCsvRows.length,
    galleryCount: galleryCsvRows.length,
    copyImages,
  }, null, 2));
};

run().catch((error) => {
  console.error('DeepFashion subset preparation failed:', error);
  process.exitCode = 1;
});
