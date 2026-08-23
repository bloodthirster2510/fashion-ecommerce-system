const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const TARGET_COUNT = Number(process.env.IVY_IMPORT_TARGET ?? 120);
const REQUEST_DELAY_MS = Number(process.env.IVY_REQUEST_DELAY_MS ?? 120);
const SITEMAP_URL = 'https://ivymoda.com/sitemap.xml';
const SOURCE_PROVIDER = 'ivymoda';
const BRAND_NAME = 'IVY moda';
const BRAND_IMAGE = 'https://pubcdn.ivymoda.com/images/logo.png';
const CATEGORY_IMAGE =
  'https://pubcdn.ivymoda.com/files/product/thumab/400/2026/07/23/643e55fda9b16e8d7ca656c5d84e0535.webp';

const CATEGORY_QUOTAS = {
  dress: 30,
  skirt: 25,
  top: 35,
  pants: 25,
  set: 5,
};

const ENTITY_MAP = {
  amp: '&',
  nbsp: ' ',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  ndash: '-',
  mdash: '-',
  hellip: '...',
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
  aacute: 'á',
  agrave: 'à',
  acirc: 'â',
  atilde: 'ã',
  eacute: 'é',
  egrave: 'è',
  ecirc: 'ê',
  iacute: 'í',
  igrave: 'ì',
  oacute: 'ó',
  ograve: 'ò',
  ocirc: 'ô',
  otilde: 'õ',
  uacute: 'ú',
  ugrave: 'ù',
  yacute: 'ý',
  Aacute: 'Á',
  Agrave: 'À',
  Acirc: 'Â',
  Eacute: 'É',
  Egrave: 'È',
  Ecirc: 'Ê',
  Oacute: 'Ó',
  Ograve: 'Ò',
  Ocirc: 'Ô',
  Uacute: 'Ú',
  Ugrave: 'Ù',
  Yacute: 'Ý',
};

const FIT_TYPES = [
  { key: 'regular', label: 'Regular', sortOrder: 0, isActive: true },
  { key: 'slim', label: 'Slim', sortOrder: 1, isActive: true },
  { key: 'xoe', label: 'Xòe', sortOrder: 2, isActive: true },
  { key: 'suong', label: 'Suông', sortOrder: 3, isActive: true },
];

const DRESS_MEASUREMENTS = [
  { key: 'shoulder', label: 'Vai', unit: 'cm', required: false, sortOrder: 1 },
  { key: 'chest', label: 'Ngực', unit: 'cm', required: true, sortOrder: 2 },
  { key: 'waist', label: 'Eo', unit: 'cm', required: true, sortOrder: 3 },
  { key: 'hip', label: 'Mông', unit: 'cm', required: false, sortOrder: 4 },
  { key: 'length', label: 'Dài váy/đầm', unit: 'cm', required: true, sortOrder: 5 },
  { key: 'weight', label: 'Cân nặng sản phẩm', unit: 'kg', required: false, sortOrder: 6 },
];

const COLOR_RULES = [
  { tests: ['đen', 'black', 'noir', 'midnight'], name: 'Đen', code: '#111111' },
  { tests: ['trắng', 'white'], name: 'Trắng', code: '#f7f7f7' },
  { tests: ['ivory'], name: 'Trắng ngà', code: '#f2ead9' },
  { tests: ['kem', 'cream'], name: 'Kem', code: '#efe4cf' },
  { tests: ['beige', 'be ', 'latte'], name: 'Be', code: '#d8bf94' },
  { tests: ['navy'], name: 'Xanh navy', code: '#112a46' },
  { tests: ['xanh sage', 'sage'], name: 'Xanh sage', code: '#9bab8f' },
  { tests: ['xanh pastel'], name: 'Xanh pastel', code: '#a9cfe8' },
  { tests: ['xanh', 'blue', 'mint'], name: 'Xanh', code: '#3a7fb4' },
  { tests: ['đỏ', 'red', 'crimson', 'ruby', 'maroon'], name: 'Đỏ', code: '#9b1f2a' },
  { tests: ['hồng', 'rose', 'pink', 'fuchsia'], name: 'Hồng', code: '#d8719a' },
  { tests: ['tím', 'violet', 'lavender', 'iris'], name: 'Tím', code: '#8a6fb0' },
  { tests: ['vàng', 'golden', 'butter'], name: 'Vàng', code: '#d8b34d' },
  { tests: ['nâu', 'brown', 'cocoa', 'mocha'], name: 'Nâu', code: '#7a5138' },
  { tests: ['ghi', 'xám', 'gray', 'grey', 'melange'], name: 'Ghi', code: '#8f9397' },
  { tests: ['cam', 'coral'], name: 'Cam', code: '#db7b56' },
  { tests: ['olive'], name: 'Olive', code: '#72784b' },
];

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHtml(value) {
  let output = String(value ?? '');

  for (let index = 0; index < 3; index += 1) {
    output = output.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
      if (entity.startsWith('#x')) {
        return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
      }

      if (entity.startsWith('#')) {
        return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
      }

      return ENTITY_MAP[entity] ?? match;
    });
  }

  return output;
}

function cleanText(value) {
  return decodeHtml(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function normalizeVietnamese(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function truncate(value, maxLength) {
  const text = String(value ?? '').trim();
  return text.length > maxLength ? text.slice(0, maxLength - 1).trimEnd() : text;
}

function stableHash(value) {
  return String(value)
    .split('')
    .reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 7);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; FashionShopDataImporter/1.0)',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed ${response.status} for ${url}`);
  }

  return response.text();
}

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) => cleanText(match[1]));
}

async function getProductUrls() {
  const sitemap = await fetchText(SITEMAP_URL);
  const productSitemaps = extractLocs(sitemap).filter((url) => url.includes('/sitemap/product/'));
  const productUrls = [];

  for (const productSitemap of productSitemaps) {
    const xml = await fetchText(productSitemap);
    productUrls.push(...extractLocs(xml).filter((url) => url.includes('/sanpham/')));
    await sleep(REQUEST_DELAY_MS);
  }

  return unique(productUrls);
}

function classifyUrl(url) {
  const slug = normalizeVietnamese(decodeURIComponent(url));

  if (/\b(chan-vay|cv-)/.test(slug)) return 'skirt';
  if (/\b(dam|dress|ao-dai|jumpsuit)/.test(slug)) return 'dress';
  if (/\b(set|do-bo|bo-vest|bo-kieu|bo-thun)/.test(slug)) return 'set';
  if (/\b(quan|trousers|jeans|shorts|baggy|chino)/.test(slug)) return 'pants';
  if (/\b(ao|blouse|shirt|top|polo|croptop|gile|vest|len|ren)/.test(slug)) return 'top';

  return 'top';
}

function classifyProduct(name, description, url) {
  const normalizedName = normalizeVietnamese(name);
  const normalizedDescription = normalizeVietnamese(description);

  // Một số URL chứa chữ "set" nhưng trang đang bán riêng áo hoặc quần của set.
  // Tên sản phẩm nguồn vì vậy đáng tin cậy hơn slug khi xác định danh mục.
  if (/\bchan vay\b/.test(normalizedName)) return 'skirt';
  if (/\b(dam|jumpsuit|ao dai)\b/.test(normalizedName)) return 'dress';
  if (/\b(quan|jeans|short)\b/.test(normalizedName)) return 'pants';
  if (/\b(ao|blazer|polo|gile|vest)\b/.test(normalizedName)) return 'top';
  if (/\b(set|bo)\b/.test(normalizedName) || /\bset bo\b/.test(normalizedDescription)) return 'set';

  return classifyUrl(url);
}

function buildBalancedCandidates(urls, missingCount) {
  const groups = urls.reduce(
    (current, url) => {
      current[classifyUrl(url)].push(url);
      return current;
    },
    { dress: [], skirt: [], top: [], pants: [], set: [] },
  );
  const selected = [];
  const selectedSet = new Set();
  const maxGroupLength = Math.max(...Object.values(groups).map((group) => group.length));

  for (let round = 0; round < maxGroupLength; round += 1) {
    for (const kind of Object.keys(CATEGORY_QUOTAS)) {
      const url = groups[kind][round];

      if (url && !selectedSet.has(url)) {
        selected.push(url);
        selectedSet.add(url);
      }
    }

    if (selected.length >= missingCount * 4) {
      break;
    }
  }

  for (const url of urls) {
    if (!selectedSet.has(url)) {
      selected.push(url);
      selectedSet.add(url);
    }
  }

  return selected;
}

function getTargetQuotas(missingCount) {
  const totalQuota = Object.values(CATEGORY_QUOTAS).reduce((sum, value) => sum + value, 0);
  const quotas = Object.entries(CATEGORY_QUOTAS).map(([kind, quota]) => {
    const exact = (quota / totalQuota) * missingCount;
    return { kind, exact, quota: Math.floor(exact) };
  });
  let allocated = quotas.reduce((sum, item) => sum + item.quota, 0);

  quotas
    .sort((left, right) => right.exact - Math.floor(right.exact) - (left.exact - Math.floor(left.exact)))
    .forEach((item) => {
      if (allocated < missingCount) {
        item.quota += 1;
        allocated += 1;
      }
    });

  return Object.fromEntries(quotas.map((item) => [item.kind, item.quota]));
}

function getMetaContent(html, key) {
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];

  for (const tag of metaTags) {
    const property = tag.match(/\b(?:property|name)=["']([^"']+)["']/i)?.[1];
    const content = tag.match(/\bcontent=["']([^"']*)["']/i)?.[1];

    if (property === key && content) {
      return cleanText(content);
    }
  }

  return '';
}

function getTitle(html) {
  return cleanText(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s*\|\s*IVY\s*moda\s*$/i, '');
}

function getProductSub(html) {
  const raw = html.match(/var\s+product_sub\s*=\s*'([\s\S]*?)';/)?.[1];

  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function getProductId(url, html) {
  const fromUrl = url.match(/-(\d+)\/?$/)?.[1];

  if (fromUrl) return fromUrl;

  const fromHtml = html.match(/"product_id":"?(\d+)"?/)?.[1];
  return fromHtml ?? String(stableHash(url));
}

function getBreadcrumbGender(html) {
  const breadcrumbScripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((content) => content.includes('BreadcrumbList'));

  const text = normalizeVietnamese(breadcrumbScripts.join(' '));

  if (text.includes('"name":"nam"') || text.includes('"name":"thoi trang nam"')) return 'male';
  if (text.includes('"name":"nu"') || text.includes('"name":"thoi trang nu"')) return 'female';

  return 'unknown';
}

function parseMoney(value) {
  const numericValue = Number.parseInt(String(value ?? '').replace(/\D/g, ''), 10);
  return Number.isFinite(numericValue) && numericValue >= 1000 ? numericValue : 0;
}

function normalizeSize(size) {
  const normalized = String(size ?? '').trim().toUpperCase();
  if (!normalized) return '';
  if (normalized === '2XL') return 'XXL';
  return normalized.length <= 10 ? normalized : '';
}

function sizeSort(left, right) {
  const leftIndex = SIZE_ORDER.indexOf(left);
  const rightIndex = SIZE_ORDER.indexOf(right);

  if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex;
  if (leftIndex >= 0) return -1;
  if (rightIndex >= 0) return 1;

  return left.localeCompare(right);
}

function extractLineValue(description, label) {
  const pattern = new RegExp(`${label}\\s*:\\s*([^\\n\\r]+)`, 'i');
  return cleanText(description.match(pattern)?.[1] ?? '');
}

function getSourcePricing(html, productSub) {
  const priceBlock = html.match(/<div[^>]+class=["'][^"']*product-detail__price[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '';
  const sourcePrice = productSub
    .map((item) => parseMoney(item.product_sub_price))
    .find((value) => value > 0);
  const originalPrice =
    parseMoney(priceBlock.match(/name=["']hid_product_price_not_format["'][^>]+value=["']([^"']+)/i)?.[1]) ||
    parseMoney(priceBlock.match(/<del[^>]*>([\s\S]*?)<\/del>/i)?.[1]) ||
    sourcePrice ||
    0;
  const salePrice = parseMoney(priceBlock.match(/<b[^>]*>([\s\S]*?)<\/b>/i)?.[1]) || originalPrice;
  const explicitDiscount = Number.parseInt(
    priceBlock.match(/product-detail__price-sale[^>]*>\s*-?\s*(\d{1,3})/i)?.[1] ?? '',
    10,
  );
  const computedDiscount = originalPrice > salePrice
    ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
    : 0;

  return {
    price: originalPrice,
    discount: Number.isFinite(explicitDiscount) ? Math.min(100, Math.max(0, explicitDiscount)) : computedDiscount,
  };
}

function getSourceColor(html, name, description) {
  const colorBlock = html.match(/<div[^>]+class=["'][^"']*product-detail__color[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '';
  const sourceColor = cleanText(colorBlock.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '')
    .replace(/^Màu\s*sắc\s*:\s*/i, '')
    .trim();
  const color = sourceColor || extractLineValue(description, 'Màu sắc') || 'Mặc định';
  const haystack = normalizeVietnamese(`${color} ${name}`);
  const matchedRule = COLOR_RULES.find((rule) => rule.tests.some((test) => haystack.includes(normalizeVietnamese(test))));

  return {
    name: truncate(color, 40),
    code: matchedRule?.code ?? '#808080',
  };
}

function getSourceFitDescription(name, description) {
  return truncate(
    extractLineValue(description, 'Phom dáng') ||
      extractLineValue(description, 'Kiểu dáng') ||
      name,
    200,
  );
}

function inferMaterial(name, description) {
  const text = normalizeVietnamese(`${name} ${description}`);

  if (text.includes('lua')) return 'Lụa';
  if (text.includes('tencel')) return 'Tencel';
  if (text.includes('cotton')) return 'Cotton';
  if (text.includes('len')) return 'Len dệt kim';
  if (text.includes('denim') || text.includes('jeans')) return 'Denim';
  if (text.includes('khaki')) return 'Khaki';
  if (text.includes('tuytsi') || text.includes('tuysi') || text.includes('tweed')) return 'Tuytsi';
  if (text.includes('ren')) return 'Ren';
  if (text.includes('thun')) return 'Thun co giãn';
  if (text.includes('voan')) return 'Voan';
  if (text.includes('phao')) return 'Vải phao';

  return '';
}

function chooseFitType(category, fitDescription, name, kind) {
  const fitTypes = category.fitTypes?.filter((fitType) => fitType.isActive !== false) ?? [];
  const normalizedFit = normalizeVietnamese(`${fitDescription} ${name}`);
  const findByKeys = (keys) => keys
    .map((key) => fitTypes.find((fitType) => fitType.key === key))
    .find(Boolean);

  if (/\b(oversize|qua kho|rong)\b/.test(normalizedFit)) {
    return findByKeys(['oversize', 'relaxed', 'ong_rong', 'regular'])?._id ?? fitTypes[0]?._id;
  }

  if (/\b(xoe|chu a)\b/.test(normalizedFit)) {
    return findByKeys(['xoe', 'regular'])?._id ?? fitTypes[0]?._id;
  }

  if (/\b(om|slim|body|bo sat)\b/.test(normalizedFit)) {
    return findByKeys(['slim', 'regular'])?._id ?? fitTypes[0]?._id;
  }

  if (/\b(ong rong|wide leg)\b/.test(normalizedFit)) {
    return findByKeys(['ong_rong', 'relaxed', 'regular'])?._id ?? fitTypes[0]?._id;
  }

  if (/\b(suong|relax)\b/.test(normalizedFit) || kind === 'pants') {
    return findByKeys(['ong_suong', 'suong', 'relaxed', 'regular'])?._id ?? fitTypes[0]?._id;
  }

  return findByKeys(['regular'])?._id ?? fitTypes[0]?._id;
}

function getSku(productId, variantId, colorVariantId, size) {
  return `IVY-${productId}-${variantId.toString().slice(-4)}-${colorVariantId.toString().slice(-4)}-${size}`
    .replace(/[^A-Z0-9-]+/gi, '')
    .toUpperCase();
}

function parseProductPage(url, html, index) {
  const productSub = Object.values(getProductSub(html));
  const name = truncate(getTitle(html) || getMetaContent(html, 'og:title').replace(/\s*\|\s*IVY\s*moda\s*$/i, ''), 150);
  const metaDescription = getMetaContent(html, 'description') || getMetaContent(html, 'og:description');
  const description = truncate(metaDescription, 3000);
  const kind = classifyProduct(name, description, url);
  const image =
    getMetaContent(html, 'og:image') ||
    html.match(/https:\/\/pubcdn\.ivymoda\.com\/files\/product\/[^"'\s]+?\.(?:webp|jpg|png)/i)?.[0] ||
    BRAND_IMAGE;
  const pricing = getSourcePricing(html, productSub);
  const productId = getProductId(url, html);
  const sizeStocks = new Map();

  if (!name || description.length < 10) {
    throw new Error(`Missing source name or description for ${url}`);
  }

  if (productSub.length === 0) {
    throw new Error(`Missing source variants for ${url}`);
  }

  for (const item of productSub) {
    const size = normalizeSize(item.product_sub_size);
    if (!size) continue;

    const stock = Number.parseInt(item.product_sub_quantity ?? '0', 10);
    const currentStock = sizeStocks.get(size) ?? 0;
    sizeStocks.set(size, Math.max(currentStock, Number.isFinite(stock) ? stock : 0));
  }

  const sizes = [...sizeStocks.keys()].sort(sizeSort);
  const color = getSourceColor(html, name, description);
  const material = truncate(extractLineValue(description, 'Chất liệu') || inferMaterial(name, description), 200);
  const fitDescription = getSourceFitDescription(name, description);

  if (sizes.length === 0) {
    throw new Error(`Missing source sizes for ${url}`);
  }

  if (pricing.price < 1000) {
    throw new Error(`Missing source price for ${url}`);
  }

  return {
    productId,
    url,
    kind,
    name,
    description,
    image,
    price: pricing.price,
    discount: pricing.discount,
    sizes,
    stockBySize: sizeStocks,
    color,
    material,
    fitDescription,
  };
}

async function ensureBrand(db) {
  const brands = db.collection('brands');
  await brands.updateOne(
    { name: BRAND_NAME },
    {
      $set: { image: BRAND_IMAGE, isActive: true, updatedAt: new Date() },
      $setOnInsert: { name: BRAND_NAME, createdAt: new Date() },
    },
    { upsert: true },
  );

  return brands.findOne({ name: BRAND_NAME });
}

async function ensureDressCategory(db) {
  const categories = db.collection('categories');
  let femaleRoot = await categories.findOne({ name: 'Thời trang nữ', parent_id: null });

  if (!femaleRoot) {
    const now = new Date();
    const result = await categories.insertOne({
      name: 'Thời trang nữ',
      parent_id: null,
      level: 1,
      gender: 'female',
      image: CATEGORY_IMAGE,
      description: 'Danh mục thời trang nữ.',
      isLeaf: false,
      isSizeTemplateSource: false,
      sizeTemplateName: '',
      sizeTemplateSourceId: null,
      sizeGuideImage: '',
      isFitTypeTemplateSource: false,
      fitTypeTemplateName: '',
      fitTypeTemplateSourceId: null,
      sizes: [],
      measurementFields: [],
      fitTypes: [],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    femaleRoot = await categories.findOne({ _id: result.insertedId });
  }

  const now = new Date();
  const dressCategoryFilter = { name: 'Váy / Đầm', parent_id: femaleRoot._id, gender: 'female' };
  const existingDressCategory = await categories.findOne(dressCategoryFilter);
  const fitTypes = FIT_TYPES.map((fitType) => {
    const existingFitType = existingDressCategory?.fitTypes?.find((item) => item.key === fitType.key);

    return {
      _id: existingFitType?._id ?? new mongoose.Types.ObjectId(),
      ...fitType,
    };
  });

  await categories.updateOne(
    dressCategoryFilter,
    {
      $set: {
        image: CATEGORY_IMAGE,
        description: 'Váy, đầm và chân váy nữ từ dữ liệu IVY moda.',
        isLeaf: false,
        isSizeTemplateSource: true,
        sizeTemplateName: 'Size váy/đầm nữ',
        sizeTemplateSourceId: null,
        isFitTypeTemplateSource: true,
        fitTypeTemplateName: 'Phom váy/đầm nữ',
        fitTypeTemplateSourceId: null,
        sizes: ['S', 'M', 'L', 'XL', 'XXL'],
        measurementFields: DRESS_MEASUREMENTS,
        fitTypes,
        isActive: true,
        updatedAt: now,
      },
      $setOnInsert: {
        name: 'Váy / Đầm',
        parent_id: femaleRoot._id,
        level: 2,
        gender: 'female',
        sizeGuideImage: '',
        createdAt: now,
      },
    },
    { upsert: true },
  );

  const dressCategory = await categories.findOne(dressCategoryFilter);
  await ensureDressChildCategory(db, dressCategory, 'Chân váy', 'Các mẫu chân váy nữ theo nhiều phom dáng.');
  await ensureDressChildCategory(db, dressCategory, 'Đầm', 'Các mẫu đầm nữ cho công sở, dạo phố và dự tiệc.');

  return dressCategory;
}

async function ensureDressChildCategory(db, parentCategory, name, description) {
  const categories = db.collection('categories');
  const now = new Date();

  await categories.updateOne(
    { name, parent_id: parentCategory._id, gender: parentCategory.gender },
    {
      $set: {
        image: parentCategory.image,
        description,
        isLeaf: true,
        isSizeTemplateSource: false,
        sizeTemplateName: '',
        sizeTemplateSourceId: parentCategory._id,
        sizeGuideImage: '',
        isFitTypeTemplateSource: false,
        fitTypeTemplateName: '',
        fitTypeTemplateSourceId: parentCategory._id,
        sizes: [],
        measurementFields: [],
        fitTypes: [],
        isActive: true,
        updatedAt: now,
      },
      $setOnInsert: {
        name,
        parent_id: parentCategory._id,
        level: parentCategory.level + 1,
        gender: parentCategory.gender,
        createdAt: now,
      },
    },
    { upsert: true },
  );
}

async function getTargetCategories(db, dressCategory) {
  const categories = db.collection('categories');
  const femaleCategories = await categories
    .find({ gender: 'female', level: 2, name: { $in: ['Áo', 'Quần', 'Set / Bộ'] } })
    .toArray();
  const byName = new Map(femaleCategories.map((category) => [category.name, category]));
  const topCategory = byName.get('Áo');

  if (topCategory && !topCategory.fitTypes?.some((fitType) => fitType.key === 'xoe')) {
    const xoeFitType = {
      _id: new mongoose.Types.ObjectId(),
      key: 'xoe',
      label: 'Xòe',
      sortOrder: topCategory.fitTypes?.length ?? 0,
      isActive: true,
    };

    await categories.updateOne(
      { _id: topCategory._id, 'fitTypes.key': { $ne: 'xoe' } },
      { $push: { fitTypes: xoeFitType }, $set: { updatedAt: new Date() } },
    );
    topCategory.fitTypes = [...(topCategory.fitTypes ?? []), xoeFitType];
  }

  const dressChildren = await categories
    .find({ gender: 'female', parent_id: dressCategory._id, name: { $in: ['Chân váy', 'Đầm'] } })
    .toArray();
  const dressChildrenByName = new Map(dressChildren.map((category) => [category.name, category]));
  const withDressTemplate = (category) => ({
    ...category,
    sizes: category.sizes?.length ? category.sizes : dressCategory.sizes,
    measurementFields: category.measurementFields?.length ? category.measurementFields : dressCategory.measurementFields,
    fitTypes: category.fitTypes?.length ? category.fitTypes : dressCategory.fitTypes,
  });

  return {
    dress: withDressTemplate(dressChildrenByName.get('Đầm') ?? dressCategory),
    skirt: withDressTemplate(dressChildrenByName.get('Chân váy') ?? dressCategory),
    top: topCategory ?? dressCategory,
    pants: byName.get('Quần') ?? dressCategory,
    set: byName.get('Set / Bộ') ?? dressCategory,
  };
}

function buildProductDocument(parsed, brand, category, index) {
  const now = new Date();
  const productId = new mongoose.Types.ObjectId();
  const variantId = new mongoose.Types.ObjectId();
  const colorVariantId = new mongoose.Types.ObjectId();
  const fitTypeId = chooseFitType(category, parsed.fitDescription, parsed.name, parsed.kind);

  if (!fitTypeId) {
    throw new Error(`Category ${category.name} has no valid fit type`);
  }

  const sizeMeasurements = parsed.sizes.map((size) => ({
    size,
    measurements: [],
  }));
  const stockRows = parsed.sizes.map((size) => {
    const quantity = parsed.stockBySize.get(size) ?? 0;

    return {
      productId,
      variantId,
      colorVariantId,
      size,
      sku: getSku(parsed.productId, variantId, colorVariantId, size),
      quantity,
      reservedQuantity: 0,
      availableQuantity: quantity,
      lowStockThreshold: 5,
      createdAt: now,
      updatedAt: now,
    };
  });

  return {
    product: {
      _id: productId,
      category_id: category._id,
      name: parsed.name,
      brand_id: brand._id,
      variant: [
        {
          _id: variantId,
          fitTypeId,
          price: parsed.price,
          discount: parsed.discount,
          sizeMeasurements,
          colors: [
            {
              _id: colorVariantId,
              color: parsed.color.name,
              colorCode: parsed.color.code,
              image: parsed.image,
              isActive: true,
            },
          ],
          isActive: true,
        },
      ],
      description: parsed.description,
      material: parsed.material,
      materialNormalized: normalizeVietnamese(parsed.material),
      product_image: parsed.image,
      isActive: true,
      sold_quantity: 0,
      averageRating: 0,
      reviewCount: 0,
      externalSource: {
        provider: SOURCE_PROVIDER,
        productId: parsed.productId,
        url: parsed.url,
        fitDescription: parsed.fitDescription,
        sourceSizes: parsed.sizes,
        syncedAt: now,
      },
      createdAt: new Date(now.getTime() - index * 3600 * 1000),
      updatedAt: now,
    },
    stockRows,
  };
}

async function importProduct(db, parsed, brand, category, index) {
  const products = db.collection('products');
  const inventories = db.collection('inventories');
  const existing = await products.findOne({
    'externalSource.provider': SOURCE_PROVIDER,
    'externalSource.productId': parsed.productId,
  });

  if (existing) {
    return { status: 'skipped' };
  }

  const { product, stockRows } = buildProductDocument(parsed, brand, category, index);

  await products.insertOne(product);
  if (stockRows.length > 0) {
    await inventories.insertMany(stockRows, { ordered: false });
  }

  return { status: 'created', product };
}

async function resetExistingImport(db) {
  const products = db.collection('products');
  const inventories = db.collection('inventories');
  const visualIndex = db.collection('productvisualindexes');
  const importedProducts = await products
    .find({ 'externalSource.provider': SOURCE_PROVIDER }, { projection: { _id: 1 } })
    .toArray();
  const productIds = importedProducts.map((product) => product._id);

  if (productIds.length === 0) {
    console.log('No existing IVY moda imported products to reset.');
    return;
  }

  await inventories.deleteMany({ productId: { $in: productIds } });
  await visualIndex.deleteMany({ productId: { $in: productIds } });
  await products.deleteMany({ _id: { $in: productIds } });
  console.log(`Reset ${productIds.length} IVY moda imported product(s).`);
}

async function fetchProductPage(url) {
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await fetchText(url);
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(500 * attempt);
    }
  }

  throw lastError;
}

function buildSyncedProduct(existing, parsed, category) {
  const existingVariant = existing.variant?.[0];
  const existingColors = existingVariant?.colors ?? [];
  const normalizedProductImage = String(existing.product_image ?? '').replace('/thumab/1400/', '/thumab/400/');
  const existingColor =
    existingColors.find(
      (color) => String(color.image ?? '').replace('/thumab/1400/', '/thumab/400/') === normalizedProductImage,
    ) ?? existingColors[0];

  if (!existingVariant?._id || !existingColor?._id) {
    throw new Error(`Imported product ${existing._id} has no reusable variant/color identity`);
  }

  const fitTypeId = chooseFitType(category, parsed.fitDescription, parsed.name, parsed.kind);
  if (!fitTypeId) {
    throw new Error(`Category ${category.name} has no valid fit type`);
  }

  const now = new Date();
  const variant = {
    ...existingVariant,
    fitTypeId,
    price: parsed.price,
    discount: parsed.discount,
    sizeMeasurements: parsed.sizes.map((size) => ({ size, measurements: [] })),
    colors: [
      {
        ...existingColor,
        color: parsed.color.name,
        colorCode: parsed.color.code,
        image: parsed.image,
        isActive: true,
      },
    ],
    isActive: true,
  };
  const inventoryRows = parsed.sizes.map((size) => {
    const quantity = parsed.stockBySize.get(size) ?? 0;

    return {
      productId: existing._id,
      variantId: variant._id,
      colorVariantId: variant.colors[0]._id,
      size,
      sku: getSku(parsed.productId, variant._id, variant.colors[0]._id, size),
      quantity,
      reservedQuantity: 0,
      availableQuantity: quantity,
      lowStockThreshold: 5,
      createdAt: now,
      updatedAt: now,
    };
  });

  return {
    update: {
      category_id: category._id,
      name: parsed.name,
      variant: [variant],
      description: parsed.description,
      material: parsed.material,
      materialNormalized: normalizeVietnamese(parsed.material),
      product_image: parsed.image,
      sold_quantity: 0,
      averageRating: 0,
      reviewCount: 0,
      externalSource: {
        ...existing.externalSource,
        provider: SOURCE_PROVIDER,
        productId: parsed.productId,
        url: parsed.url,
        fitDescription: parsed.fitDescription,
        sourceSizes: parsed.sizes,
        syncedAt: now,
      },
      updatedAt: now,
    },
    inventoryRows,
    removedColors: Math.max(0, existingColors.length - 1),
    removedMeasurements: (existingVariant.sizeMeasurements ?? [])
      .reduce((total, item) => total + (item.measurements?.length ?? 0), 0),
    categoryChanged: String(existing.category_id) !== String(category._id),
  };
}

async function assertSafeToSyncImportedProducts(db, productIds) {
  const references = {
    orders: await db.collection('orders').countDocuments({ 'items.product_id': { $in: productIds } }),
    carts: await db.collection('carts').countDocuments({ 'items.product_id': { $in: productIds } }),
    favorites: await db.collection('favorites').countDocuments({ product_id: { $in: productIds } }),
    reviews: await db.collection('reviews').countDocuments({ product_id: { $in: productIds } }),
    inventoryImports: await db.collection('inventoryimports').countDocuments({ productId: { $in: productIds } }),
    inventoryReservations: await db.collection('inventoryreservations').countDocuments({ productId: { $in: productIds } }),
  };
  const referenced = Object.values(references).reduce((total, count) => total + count, 0);

  if (referenced > 0) {
    throw new Error(`Refusing to replace imported variants because dependent records exist: ${JSON.stringify(references)}`);
  }

  return references;
}

async function syncExistingImport(db, categories, applyChanges) {
  const products = db.collection('products');
  const rows = await products
    .find({ 'externalSource.provider': SOURCE_PROVIDER })
    .sort({ createdAt: 1 })
    .toArray();
  const productIds = rows.map((product) => product._id);
  const references = await assertSafeToSyncImportedProducts(db, productIds);
  const plans = [];
  const sourceSizesByTemplate = new Map();

  for (let index = 0; index < rows.length; index += 1) {
    const existing = rows[index];
    const url = existing.externalSource?.url;
    if (!url) throw new Error(`Imported product ${existing._id} is missing its source URL`);

    const html = await fetchProductPage(url);
    const parsed = parseProductPage(url, html, index + 1);
    const category = categories[parsed.kind];
    if (!category) throw new Error(`No category mapping for source kind ${parsed.kind}`);

    plans.push({
      productId: existing._id,
      parsed,
      category,
      ...buildSyncedProduct(existing, parsed, category),
    });

    const templateId = String(category.sizeTemplateSourceId ?? category._id);
    const templateSizes = sourceSizesByTemplate.get(templateId) ?? new Set();
    parsed.sizes.forEach((size) => templateSizes.add(size));
    sourceSizesByTemplate.set(templateId, templateSizes);

    console.log(`[${index + 1}/${rows.length}] Validated ${parsed.name}`);
    await sleep(REQUEST_DELAY_MS);
  }

  const summary = {
    applyChanges,
    products: plans.length,
    categoryChanges: plans.filter((plan) => plan.categoryChanged).length,
    removedSyntheticColors: plans.reduce((total, plan) => total + plan.removedColors, 0),
    removedSyntheticMeasurements: plans.reduce((total, plan) => total + plan.removedMeasurements, 0),
    sourceSizeSets: Object.fromEntries(
      Object.entries(
        plans.reduce((sets, plan) => {
          const key = `${plan.category.name}:${plan.parsed.sizes.join(',')}`;
          sets[key] = (sets[key] ?? 0) + 1;
          return sets;
        }, {}),
      ).sort(([left], [right]) => left.localeCompare(right)),
    ),
    references,
  };

  if (!applyChanges) {
    console.log(JSON.stringify(summary, null, 2));
    return summary;
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await products.bulkWrite(
        plans.map((plan) => ({
          updateOne: {
            filter: { _id: plan.productId, 'externalSource.provider': SOURCE_PROVIDER },
            update: { $set: plan.update },
          },
        })),
        { session },
      );

      await db.collection('inventories').deleteMany({ productId: { $in: productIds } }, { session });
      const inventoryRows = plans.flatMap((plan) => plan.inventoryRows);
      if (inventoryRows.length > 0) {
        await db.collection('inventories').insertMany(inventoryRows, { ordered: false, session });
      }

      await db.collection('productvisualindexes').deleteMany({ productId: { $in: productIds } }, { session });

      for (const [templateId, sourceSizes] of sourceSizesByTemplate.entries()) {
        const template = await db.collection('categories').findOne({ _id: new mongoose.Types.ObjectId(templateId) }, { session });
        if (!template) throw new Error(`Missing size template category ${templateId}`);

        const sizes = unique([...(template.sizes ?? []), ...sourceSizes]).sort(sizeSort);
        await db.collection('categories').updateOne(
          { _id: template._id },
          { $set: { sizes, updatedAt: new Date() } },
          { session },
        );
      }
    });
  } finally {
    await session.endSession();
  }

  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

async function importParsedProduct(db, parsed, brand, categories, index, state, allowOverflow = false) {
  if (!allowOverflow && state.createdByKind[parsed.kind] >= state.targetQuotas[parsed.kind]) {
    return 'quota-full';
  }

  const category = categories[parsed.kind] ?? categories.top;
  const result = await importProduct(db, parsed, brand, category, index);

  if (result.status === 'created') {
    state.created += 1;
    state.createdByKind[parsed.kind] += 1;
    console.log(`[${state.created}/${state.missingCount}] Imported ${parsed.name}`);
  } else {
    state.skipped += 1;
  }

  return result.status;
}

async function importFromCandidates(db, candidates, brand, categories, state, options = {}) {
  const processedUrls = options.processedUrls ?? new Set();
  const allowOverflow = options.allowOverflow ?? false;

  for (const url of candidates) {
    if (state.created >= state.missingCount) break;
    if (processedUrls.has(url)) continue;

    processedUrls.add(url);
    state.processed += 1;

    try {
      const html = await fetchText(url);
      const gender = getBreadcrumbGender(html);

      if (gender === 'male') {
        state.skipped += 1;
        continue;
      }

      const parsed = parseProductPage(url, html, state.processed);
      await importParsedProduct(db, parsed, brand, categories, state.processed, state, allowOverflow);
    } catch (error) {
      state.failed += 1;
      console.warn(`Skipped ${url}: ${error.message}`);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  return processedUrls;
}

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Missing MONGODB_URI in backend/.env');
  }

  if (!Number.isInteger(TARGET_COUNT) || TARGET_COUNT < 0) {
    throw new Error('IVY_IMPORT_TARGET must be a non-negative integer');
  }

  if (!Number.isFinite(REQUEST_DELAY_MS) || REQUEST_DELAY_MS < 0) {
    throw new Error('IVY_REQUEST_DELAY_MS must be a non-negative number');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  if (process.env.IVY_IMPORT_RESET === 'true') {
    await resetExistingImport(db);
  }

  const brand = await ensureBrand(db);
  const dressCategory = await ensureDressCategory(db);
  const categories = await getTargetCategories(db, dressCategory);

  if (process.env.IVY_IMPORT_SYNC_EXISTING === 'true') {
    await syncExistingImport(db, categories, process.env.IVY_IMPORT_APPLY === 'true');
    return;
  }

  const existingCount = await db.collection('products').countDocuments({ 'externalSource.provider': SOURCE_PROVIDER });

  if (existingCount >= TARGET_COUNT) {
    console.log(`Already have ${existingCount} IVY moda products. Target is ${TARGET_COUNT}; nothing to import.`);
    return;
  }

  const missingCount = TARGET_COUNT - existingCount;
  console.log(`Collecting IVY moda product URLs. Need ${missingCount} more product(s).`);

  const productUrls = await getProductUrls();
  const candidates = buildBalancedCandidates(productUrls, missingCount);
  const state = {
    created: 0,
    skipped: 0,
    failed: 0,
    processed: 0,
    missingCount,
    targetQuotas: getTargetQuotas(missingCount),
    createdByKind: { dress: 0, skirt: 0, top: 0, pants: 0, set: 0 },
  };

  console.log(`Target mix: ${JSON.stringify(state.targetQuotas)}`);
  const processedUrls = await importFromCandidates(db, candidates, brand, categories, state);

  if (state.created < missingCount) {
    console.log(`Quota pass imported ${state.created}/${missingCount}. Filling remaining products with overflow candidates.`);
    await importFromCandidates(db, candidates, brand, categories, state, {
      processedUrls,
      allowOverflow: true,
    });
  }

  const totalIvyProducts = await db.collection('products').countDocuments({ 'externalSource.provider': SOURCE_PROVIDER });
  console.log(
    JSON.stringify(
      {
        created: state.created,
        skipped: state.skipped,
        failed: state.failed,
        processed: state.processed,
        createdByKind: state.createdByKind,
        totalIvyProducts,
        target: TARGET_COUNT,
      },
      null,
      2,
    ),
  );
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
