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
const DEFAULT_LABELS_PATH = 'docs_vs/visual-search-query-labels.csv';
const FALLBACK_SUGGESTIONS_PATH = 'docs_vs/visual-search-query-label-suggestions.csv';
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

// Kiểm tra script có được chạy kèm một cờ như --overwrite hay không.
const hasFlag = (flag: string) => process.argv.includes(flag);

// Đọc tham số dạng --ten=value; nếu không có thì dùng giá trị mặc định.
const getStringArg = (name: string, fallback: string) => {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
};

// Đọc tham số số dương, ví dụ --limit=50.
const getNumberArg = (name: string, fallback: number) => {
  const value = Number(getStringArg(name, String(fallback)));
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

// Xác định thư mục gốc dự án dù script được chạy ở root hay trong backend.
const getRepoRoot = () => (
  path.basename(process.cwd()) === 'backend'
    ? path.resolve(process.cwd(), '..')
    : process.cwd()
);

// Chuyển đường dẫn tương đối thành đường dẫn đầy đủ trong backend/docs_vs.
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

// Tách một dòng CSV, có xử lý trường hợp ô có dấu phẩy trong dấu nháy.
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

// Bọc giá trị CSV khi nội dung có dấu phẩy, dấu nháy hoặc xuống dòng.
const toCsvValue = (value: string | number) => {
  const stringValue = String(value);
  return /[",\n\r]/.test(stringValue)
    ? `"${stringValue.replace(/"/g, '""')}"`
    : stringValue;
};

// Ghép header và các dòng dữ liệu thành nội dung CSV.
const toCsv = (headers: string[], rows: Array<Record<string, string | number>>) => [
  headers.join(','),
  ...rows.map((row) => headers.map((header) => toCsvValue(row[header] ?? '')).join(',')),
].join('\n');

// Kiểm tra file nhãn đã có dữ liệu thật hay mới chỉ có header.
const hasLabelRows = async (filePath: string) => {
  if (!existsSync(filePath)) {
    return false;
  }

  const content = await fs.readFile(filePath, 'utf8');
  return content.split(/\r?\n/).filter((line) => line.trim()).length > 1;
};

// Lấy đúng các cột cần dùng từ file gallery đã export.
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

// Mỗi sản phẩm chỉ chọn một ảnh đại diện, ưu tiên ảnh còn hàng và ảnh chính.
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

// Chọn mẫu trải đều theo danh mục để bộ nhãn kiểm thử không bị lệch một nhóm sản phẩm.
const selectDiverseRows = (rows: GalleryRow[], limit: number) => {
  const rowsByCategory = new Map<string, GalleryRow[]>();

  rows
    .sort((first, second) => first.productName.localeCompare(second.productName, 'vi'))
    .forEach((row) => {
      const key = row.categoryId || 'unknown';
      const categoryRows = rowsByCategory.get(key) ?? [];
      categoryRows.push(row);
      rowsByCategory.set(key, categoryRows);
    });

  const selectedRows: GalleryRow[] = [];
  const categoryQueues = Array.from(rowsByCategory.values());

  while (selectedRows.length < limit && categoryQueues.some((queue) => queue.length > 0)) {
    for (const queue of categoryQueues) {
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

// Chuyển các ảnh đại diện thành dòng nhãn tự động để chạy kiểm thử nhanh.
const toLabelRows = (rows: GalleryRow[]) => rows.map((row, index) => ({
  queryId: `auto_gallery_${String(index + 1).padStart(3, '0')}`,
  queryImagePath: row.imageUrl,
  querySource: 'gallery_auto',
  expectedProductIds: row.productId,
  relevantProductIds: '',
  expectedCategoryId: row.categoryId,
  expectedColor: row.color,
  difficulty: 'easy',
  note: `Auto label từ gallery: ${row.productName} (${row.categoryName})`,
}));

// Luồng chính: đọc gallery, tạo nhãn gợi ý và ghi ra file CSV.
const run = async () => {
  const galleryPath = resolveWorkspacePath(getStringArg('gallery', DEFAULT_GALLERY_PATH));
  let outputPath = resolveWorkspacePath(getStringArg('output', DEFAULT_LABELS_PATH));
  const limit = getNumberArg('limit', 50);
  const overwrite = hasFlag('--overwrite');

  if (!existsSync(galleryPath)) {
    throw new Error(`Gallery file not found: ${galleryPath}`);
  }

  if (!overwrite && await hasLabelRows(outputPath)) {
    outputPath = resolveWorkspacePath(FALLBACK_SUGGESTIONS_PATH);
  }

  const galleryContent = await fs.readFile(galleryPath, 'utf8');
  const galleryRows = toGalleryRows(parseCsv(galleryContent));
  const representativeRows = pickProductRepresentativeRows(galleryRows);
  const selectedRows = selectDiverseRows(representativeRows, limit);
  const labelRows = toLabelRows(selectedRows);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${toCsv(LABEL_HEADERS, labelRows)}\n`, 'utf8');

  console.log(JSON.stringify({
    galleryPath,
    outputPath,
    productCount: representativeRows.length,
    labelCount: labelRows.length,
    overwrite,
    note: 'Auto labels are for sanity checks. Human-reviewed labels are still required for thesis-quality evaluation.',
  }, null, 2));
};

run().catch((error) => {
  console.error('Visual search query labeling failed:', error);
  process.exitCode = 1;
});
