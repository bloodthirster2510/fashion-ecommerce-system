const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Dữ liệu mẫu không được tạo mặc định: mỗi sản phẩm cần có ảnh nguồn riêng,
// nếu không catalog sẽ hiển thị cùng một đôi giày dưới nhiều tên khác nhau.
const TARGET_COUNT = Number(process.env.SHOE_IMPORT_TARGET ?? 0);
const SOURCE_PROVIDER = 'demo-shoes';

const SHOE_QUOTAS = {
  femaleHighHeels: 30,
  femaleSandals: 24,
  femaleOther: 12,
  maleLoafers: 24,
  maleSneakers: 20,
  maleOther: 10,
};

const FALLBACK_IMAGE =
  'https://placehold.co/900x1200/1f2937/ffffff?text=Giay+Dep+Fashion';

const SHOE_FIT_TYPES = [
  { key: 'om_chan', label: 'Ôm chân', sortOrder: 0, isActive: true },
  { key: 'vua_chan', label: 'Vừa chân', sortOrder: 1, isActive: true },
  { key: 'rong_chan', label: 'Rộng chân', sortOrder: 2, isActive: true },
  { key: 'rat_rong', label: 'Rất rộng', sortOrder: 3, isActive: true },
];

const SHOE_MEASUREMENTS = [
  { key: 'footLength', label: 'Dài bàn chân', unit: 'cm', required: true, sortOrder: 1 },
  { key: 'heelHeight', label: 'Chiều cao gót', unit: 'cm', required: false, sortOrder: 2 },
  { key: 'platformHeight', label: 'Độ cao đế', unit: 'cm', required: false, sortOrder: 3 },
  { key: 'weight', label: 'Cân nặng sản phẩm', unit: 'kg', required: false, sortOrder: 4 },
];

const GROUP_CONFIG = {
  femaleHighHeels: {
    gender: 'female',
    categoryName: 'Giày cao gót',
    parentName: 'Giày / Dép',
    brandNames: ['YODY', 'IVY moda', 'Lacoste'],
    sizes: ['35', '36', '37', '38', '39', '40'],
    priceRange: [520000, 1390000],
    heelRange: [5, 9],
    platformRange: [1, 2],
    imageHints: ['cao gót', 'gót', 'hở hậu', 'quai'],
    productTypes: [
      'Giày cao gót mũi nhọn',
      'Giày cao gót mũi vuông',
      'Dép cao gót quai mảnh',
      'Giày slingback gót vuông',
      'Giày cao gót công sở',
      'Giày Mary Jane cao gót',
    ],
    styles: [
      'thanh lịch',
      'phối khóa kim loại',
      'đế vuông êm chân',
      'quai chéo nữ tính',
      'da bóng sang trọng',
      'phối nơ mềm mại',
      'mũi nhọn tối giản',
    ],
    materials: ['Da tổng hợp cao cấp', 'Da PU mềm', 'Da bóng chống xước', 'Da microfiber', 'Satin phủ mờ'],
    useCases: ['đi làm', 'dự tiệc nhẹ', 'gặp gỡ đối tác', 'phối váy công sở', 'đi sự kiện'],
  },
  femaleSandals: {
    gender: 'female',
    categoryName: 'Sandal',
    parentName: 'Giày / Dép',
    brandNames: ['YODY', 'IVY moda'],
    sizes: ['35', '36', '37', '38', '39', '40'],
    priceRange: [320000, 890000],
    heelRange: [2, 5],
    platformRange: [1, 3],
    imageHints: ['sandal', 'dép', 'quai'],
    productTypes: [
      'Sandal nữ quai ngang',
      'Sandal nữ đế xuồng',
      'Dép sandal khuy đai',
      'Sandal nữ quai mảnh',
      'Dép nữ đế bệt',
      'Sandal nữ đế thấp',
    ],
    styles: [
      'êm nhẹ hằng ngày',
      'khóa kim loại chắc chân',
      'quai mềm không cấn',
      'đế chống trượt',
      'phối màu tối giản',
      'mũi vuông hiện đại',
    ],
    materials: ['Da tổng hợp', 'Da PU mềm', 'Vải dệt quai mềm', 'Cao su non', 'EVA nhẹ'],
    useCases: ['đi chơi cuối tuần', 'đi làm casual', 'du lịch', 'dạo phố', 'phối quần suông'],
  },
  femaleOther: {
    gender: 'female',
    categoryName: 'Giày / Dép khác',
    parentName: 'Giày / Dép',
    brandNames: ['YODY', 'Lacoste', 'IVY moda'],
    sizes: ['35', '36', '37', '38', '39', '40'],
    priceRange: [390000, 1190000],
    heelRange: [1, 4],
    platformRange: [1, 3],
    imageHints: ['giày nữ', 'mũi vuông', 'quai'],
    productTypes: [
      'Giày búp bê nữ',
      'Giày mule nữ',
      'Giày nữ mũi vuông',
      'Giày nữ hở hậu',
      'Dép nữ quai bản',
      'Giày loafer nữ',
    ],
    styles: [
      'mềm chân',
      'phối dây chéo',
      'đế bệt linh hoạt',
      'da lì tối giản',
      'đai trang trí thanh mảnh',
      'phom ôm vừa',
    ],
    materials: ['Da tổng hợp mềm', 'Da lộn nhân tạo', 'Da PU', 'Vải canvas', 'Da microfiber'],
    useCases: ['đi học', 'đi làm', 'dạo phố', 'phối đồ basic', 'di chuyển cả ngày'],
  },
  maleLoafers: {
    gender: 'male',
    categoryName: 'Giày lười',
    parentName: 'Giày / Dép',
    brandNames: ['Lacoste', 'YODY'],
    sizes: ['39', '40', '41', '42', '43', '44'],
    priceRange: [690000, 1790000],
    heelRange: [1, 3],
    platformRange: [1, 3],
    imageHints: ['loafer', 'moccasin', 'giày lười'],
    productTypes: [
      'Giày lười nam da bò',
      'Giày penny loafer nam',
      'Giày moccasin nam',
      'Giày slip-on nam',
      'Giày lười nam đai ngang',
      'Giày loafer nam công sở',
    ],
    styles: [
      'đế mềm êm chân',
      'da nappa sang trọng',
      'đai khóa kim loại',
      'đường may nổi tinh tế',
      'phom trẻ trung',
      'mặt da saffiano',
    ],
    materials: ['Da bò Nappa', 'Da bò mill', 'Da tổng hợp cao cấp', 'Da Saffiano', 'Da microfiber'],
    useCases: ['đi làm', 'gặp khách hàng', 'đi tiệc nhẹ', 'phối quần âu', 'đi chơi cuối tuần'],
  },
  maleSneakers: {
    gender: 'male',
    categoryName: 'Giày thể thao',
    parentName: 'Giày / Dép',
    brandNames: ['Nike', 'Lacoste', 'YODY'],
    sizes: ['39', '40', '41', '42', '43', '44'],
    priceRange: [650000, 1690000],
    heelRange: [1, 3],
    platformRange: [2, 4],
    imageHints: ['thể thao', 'sneaker'],
    productTypes: [
      'Giày thể thao nam',
      'Sneaker nam phối màu',
      'Giày chạy bộ nam',
      'Giày sneaker basic',
      'Giày thể thao đế nhẹ',
      'Sneaker nam cổ thấp',
    ],
    styles: [
      'đệm êm linh hoạt',
      'phối màu năng động',
      'đế cao su bám tốt',
      'upper thoáng khí',
      'dễ phối đồ casual',
      'trọng lượng nhẹ',
    ],
    materials: ['Mesh thoáng khí', 'Da tổng hợp phối lưới', 'Vải dệt knit', 'Cao su EVA', 'Da PU phối mesh'],
    useCases: ['đi bộ hằng ngày', 'tập nhẹ', 'du lịch', 'phối quần jeans', 'đi làm casual'],
  },
  maleOther: {
    gender: 'male',
    categoryName: 'Giày / Dép khác',
    parentName: 'Giày / Dép',
    brandNames: ['Lacoste', 'YODY'],
    sizes: ['39', '40', '41', '42', '43', '44'],
    priceRange: [590000, 1490000],
    heelRange: [1, 3],
    platformRange: [1, 3],
    imageHints: ['derby', 'giày nam'],
    productTypes: [
      'Giày derby nam',
      'Giày Oxford nam',
      'Giày sandal nam',
      'Dép nam quai ngang',
      'Giày da nam basic',
      'Giày công sở nam',
    ],
    styles: [
      'lịch sự dễ phối',
      'đế chống trượt',
      'mũi tròn cổ điển',
      'quai chắc chân',
      'da lì nam tính',
      'phom rộng thoải mái',
    ],
    materials: ['Da bò', 'Da tổng hợp cao cấp', 'Da microfiber', 'Cao su non', 'Da PU'],
    useCases: ['đi làm', 'dự họp', 'dạo phố', 'đi chơi', 'phối quần kaki'],
  },
};

const COLOR_OPTIONS = [
  { name: 'Đen', code: '#111111' },
  { name: 'Nâu', code: '#6f4e37' },
  { name: 'Kem', code: '#eadfcf' },
  { name: 'Be', code: '#d9bd8f' },
  { name: 'Trắng', code: '#f6f6f6' },
  { name: 'Ghi', code: '#8b9098' },
  { name: 'Hồng phấn', code: '#e7aebe' },
  { name: 'Bạc', code: '#c8c8c8' },
  { name: 'Xanh navy', code: '#16263f' },
];

const MALE_CLASSIC_COLORS = COLOR_OPTIONS.filter((color) =>
  ['Đen', 'Nâu', 'Kem', 'Be', 'Trắng', 'Ghi', 'Xanh navy'].includes(color.name),
);

const SHOE_COLLECTION_NAMES = [
  'Urban Step',
  'Daily Walk',
  'Soft Ease',
  'Modern Flex',
  'City Muse',
  'Cloud Form',
  'Prime Comfort',
  'Classic Line',
  'Luna Grace',
  'Nova Fit',
  'Metro Chic',
  'Velvet Touch',
  'Office Walk',
  'Minimal Ease',
  'Grace Motion',
  'Smart Sole',
  'Weekend Flow',
  'Aura Step',
  'Pure Motion',
  'Noble Form',
  'Active Pace',
  'Elegant Walk',
  'Street Lite',
  'Calm Step',
];

function normalizeVietnamese(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function stableHash(value) {
  return String(value)
    .split('')
    .reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 11);
}

function pick(items, seed, offset = 0) {
  return items[(stableHash(`${seed}-${offset}`) % items.length + items.length) % items.length];
}

function moneyInRange([min, max], seed) {
  const raw = min + (stableHash(seed) % (max - min + 1));
  return Math.round(raw / 10000) * 10000;
}

function numberInRange([min, max], seed) {
  return min + (stableHash(seed) % (max - min + 1));
}

function getTargetQuotas(targetCount) {
  const totalQuota = Object.values(SHOE_QUOTAS).reduce((sum, value) => sum + value, 0);
  const quotas = Object.entries(SHOE_QUOTAS).map(([kind, quota]) => {
    const exact = (quota / totalQuota) * targetCount;
    return { kind, exact, quota: Math.floor(exact) };
  });
  let allocated = quotas.reduce((sum, item) => sum + item.quota, 0);

  quotas
    .sort((left, right) => right.exact - Math.floor(right.exact) - (left.exact - Math.floor(left.exact)))
    .forEach((item) => {
      if (allocated < targetCount) {
        item.quota += 1;
        allocated += 1;
      }
    });

  return Object.fromEntries(quotas.map((item) => [item.kind, item.quota]));
}

async function getBrandMap(db) {
  const brands = db.collection('brands');
  const neededBrandNames = [...new Set(Object.values(GROUP_CONFIG).flatMap((config) => config.brandNames))];
  const rows = await brands.find({ name: { $in: neededBrandNames } }).toArray();
  const byName = new Map(rows.map((brand) => [brand.name, brand]));

  for (const brandName of neededBrandNames) {
    if (!byName.has(brandName)) {
      const now = new Date();
      const result = await brands.insertOne({
        name: brandName,
        image: FALLBACK_IMAGE,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      byName.set(brandName, await brands.findOne({ _id: result.insertedId }));
    }
  }

  return byName;
}

async function getCategoryMap(db) {
  const categories = db.collection('categories');
  const rows = await categories.find({ name: { $in: ['Giày / Dép', 'Giày cao gót', 'Sandal', 'Giày lười', 'Giày thể thao', 'Giày / Dép khác'] } }).toArray();
  const keyOf = (category) => `${category.gender}:${category.name}`;
  const byKey = new Map(rows.map((category) => [keyOf(category), category]));
  const now = new Date();

  for (const category of rows) {
    if (!['Giày / Dép', 'Giày cao gót', 'Sandal', 'Giày lười', 'Giày thể thao', 'Giày / Dép khác'].includes(category.name)) {
      continue;
    }

    const sizes = category.gender === 'male' ? ['39', '40', '41', '42', '43', '44'] : ['35', '36', '37', '38', '39', '40'];
    await categories.updateOne(
      { _id: category._id },
      {
        $set: {
          sizes,
          measurementFields: SHOE_MEASUREMENTS,
          fitTypes: category.fitTypes?.length ? category.fitTypes : SHOE_FIT_TYPES,
          isActive: true,
          updatedAt: now,
        },
      },
    );
  }

  const refreshedRows = await categories.find({ _id: { $in: rows.map((category) => category._id) } }).toArray();
  return new Map(refreshedRows.map((category) => [keyOf(category), category]));
}

async function getImagePools(db, categoryMap) {
  const products = db.collection('products');
  const categoryIds = [...categoryMap.values()].map((category) => category._id);
  const existingProducts = await products
    .find(
      {
        category_id: { $in: categoryIds },
        product_image: { $type: 'string', $ne: '' },
      },
      { projection: { name: 1, product_image: 1, category_id: 1 } },
    )
    .toArray();
  const categoryById = new Map([...categoryMap.values()].map((category) => [String(category._id), category]));
  const pools = {};

  for (const product of existingProducts) {
    const category = categoryById.get(String(product.category_id));
    if (!category) continue;

    const groupKeys = Object.entries(GROUP_CONFIG)
      .filter(([, config]) => config.gender === category.gender && config.categoryName === category.name)
      .map(([groupKey]) => groupKey);

    for (const groupKey of groupKeys) {
      pools[groupKey] ??= [];
      pools[groupKey].push(product.product_image);
    }
  }

  for (const groupKey of Object.keys(GROUP_CONFIG)) {
    pools[groupKey] = [...new Set(pools[groupKey] ?? [])];
  }

  return pools;
}

function getImageBoundQuotas(targetCount, imagePools) {
  const requestedQuotas = getTargetQuotas(targetCount);
  const quotas = {};
  let remaining = targetCount;

  for (const [groupKey, requestedCount] of Object.entries(requestedQuotas)) {
    const count = Math.min(requestedCount, imagePools[groupKey]?.length ?? 0);
    quotas[groupKey] = count;
    remaining -= count;
  }

  for (const groupKey of Object.keys(GROUP_CONFIG)) {
    if (remaining === 0) break;

    const available = (imagePools[groupKey]?.length ?? 0) - quotas[groupKey];
    const additional = Math.min(remaining, Math.max(0, available));
    quotas[groupKey] += additional;
    remaining -= additional;
  }

  if (remaining > 0) {
    throw new Error(
      `Cannot import ${targetCount} demo shoes with distinct source images; only ${targetCount - remaining} are available.`,
    );
  }

  return quotas;
}

function footLengthForSize(size, gender) {
  const numericSize = Number(size);
  const baseSize = gender === 'male' ? 39 : 35;
  const baseLength = gender === 'male' ? 24.5 : 22.5;
  return Number((baseLength + (numericSize - baseSize) * 0.5).toFixed(1));
}

function measurementsForSize(size, config, seed) {
  const heelHeight = numberInRange(config.heelRange, `${seed}-heel`);
  const platformHeight = numberInRange(config.platformRange, `${seed}-platform`);

  return [
    { key: 'footLength', value: footLengthForSize(size, config.gender) },
    { key: 'heelHeight', value: heelHeight },
    { key: 'platformHeight', value: platformHeight },
    { key: 'weight', value: Number((0.45 + (stableHash(`${seed}-${size}-weight`) % 45) / 100).toFixed(2)) },
  ];
}

function getFitTypeId(category, seed) {
  const fitTypes = category.fitTypes?.filter((fitType) => fitType.isActive !== false) ?? [];
  const preferredKeys = ['vua_chan', 'om_chan', 'rong_chan', 'rat_rong'];

  for (const key of preferredKeys) {
    const fitType = fitTypes.find((item) => item.key === key);
    if (fitType && stableHash(`${seed}-${key}`) % 3 !== 0) return fitType._id;
  }

  return fitTypes[0]?._id ?? new mongoose.Types.ObjectId();
}

function getSku(productCode, variantId, colorVariantId, size) {
  return `SHOE-${productCode}-${variantId.toString().slice(-4)}-${colorVariantId.toString().slice(-4)}-${size}`
    .replace(/[^A-Z0-9-]+/gi, '')
    .toUpperCase();
}

function buildDescription(name, material, color, config, style, useCase) {
  return [
    `${name} có phom ôm vừa, dễ mang và phù hợp nhịp di chuyển hằng ngày.`,
    `Chất liệu ${material.toLowerCase()} kết hợp đế bám tốt giúp sản phẩm giữ dáng, nhẹ chân và hạn chế trơn trượt.`,
    `Màu sắc: ${color.name}.`,
    `Phù hợp: ${useCase}, phối cùng trang phục công sở, casual hoặc các set đồ tối giản.`,
    'Lưu ý: Màu sắc sản phẩm thực tế có thể chênh lệch nhẹ do ánh sáng chụp và màn hình hiển thị.',
  ].join('\n\n');
}

function buildShoeSpec(groupKey, index, imagePools) {
  const config = GROUP_CONFIG[groupKey];
  const seed = `${groupKey}-${index}`;
  const productType = pick(config.productTypes, seed, 1);
  const style = pick(config.styles, seed, 2);
  const colorOptions = config.gender === 'male' && groupKey !== 'maleSneakers' ? MALE_CLASSIC_COLORS : COLOR_OPTIONS;
  const color = pick(colorOptions, seed, 3);
  const material = pick(config.materials, seed, 4);
  const useCase = pick(config.useCases, seed, 5);
  const collectionName = SHOE_COLLECTION_NAMES[index % SHOE_COLLECTION_NAMES.length];
  const productCode = `${groupKey}-${String(index + 1).padStart(3, '0')}`;
  const name = `${productType} ${collectionName} ${style} màu ${color.name}`;
  const imagePool = imagePools[groupKey] ?? [];

  return {
    groupKey,
    productCode,
    name,
    description: buildDescription(name, material, color, config, style, useCase),
    material,
    color,
    sizes: config.sizes,
    image: imagePool.length ? pick(imagePool, seed, 6) : FALLBACK_IMAGE,
    price: moneyInRange(config.priceRange, seed),
    discount: [0, 0, 10, 15, 20, 25][stableHash(`${seed}-discount`) % 6],
    brandName: pick(config.brandNames, seed, 7),
  };
}

function buildProductDocument(spec, brand, category, index) {
  const now = new Date();
  const productId = new mongoose.Types.ObjectId();
  const variantId = new mongoose.Types.ObjectId();
  const colorVariantId = new mongoose.Types.ObjectId();
  const config = GROUP_CONFIG[spec.groupKey];
  const fitTypeId = getFitTypeId(category, spec.productCode);
  const sizeMeasurements = spec.sizes.map((size) => ({
    size,
    measurements: measurementsForSize(size, config, spec.productCode),
  }));
  const stockRows = spec.sizes.map((size) => {
    const quantity = 8 + (stableHash(`${spec.productCode}-${size}`) % 18);

    return {
      productId,
      variantId,
      colorVariantId,
      size,
      sku: getSku(spec.productCode, variantId, colorVariantId, size),
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
      name: spec.name,
      brand_id: brand._id,
      variant: [
        {
          _id: variantId,
          fitTypeId,
          price: spec.price,
          discount: spec.discount,
          sizeMeasurements,
          colors: [
            {
              _id: colorVariantId,
              color: spec.color.name,
              colorCode: spec.color.code,
              image: spec.image,
              isActive: true,
            },
          ],
          isActive: true,
        },
      ],
      description: spec.description,
      material: spec.material,
      materialNormalized: normalizeVietnamese(spec.material),
      product_image: spec.image,
      isActive: true,
      sold_quantity: stableHash(spec.productCode) % 180,
      averageRating: Number((4 + (stableHash(`${spec.productCode}-rating`) % 10) / 10).toFixed(1)),
      reviewCount: 5 + (stableHash(`${spec.productCode}-reviews`) % 70),
      externalSource: {
        provider: SOURCE_PROVIDER,
        productId: spec.productCode,
        url: `generated://${SOURCE_PROVIDER}/${spec.productCode}`,
      },
      createdAt: new Date(now.getTime() - index * 30 * 60 * 1000),
      updatedAt: now,
    },
    stockRows,
  };
}

async function resetExistingImport(db) {
  const products = db.collection('products');
  const inventories = db.collection('inventories');
  const visualIndex = db.collection('productvisualindexes');
  const rows = await products
    .find({ 'externalSource.provider': SOURCE_PROVIDER }, { projection: { _id: 1 } })
    .toArray();
  const productIds = rows.map((product) => product._id);

  if (productIds.length === 0) {
    console.log('No existing demo shoe products to reset.');
    return;
  }

  await inventories.deleteMany({ productId: { $in: productIds } });
  await visualIndex.deleteMany({ productId: { $in: productIds } });
  await products.deleteMany({ _id: { $in: productIds } });
  console.log(`Reset ${productIds.length} demo shoe product(s).`);
}

async function importShoeProducts(db, brandMap, categoryMap, imagePools, targetCount) {
  const products = db.collection('products');
  const inventories = db.collection('inventories');
  const quotas = getImageBoundQuotas(targetCount, imagePools);
  let created = 0;
  const createdByKind = {};

  for (const [groupKey, quota] of Object.entries(quotas)) {
    const config = GROUP_CONFIG[groupKey];
    const category = categoryMap.get(`${config.gender}:${config.categoryName}`);

    if (!category) {
      throw new Error(`Missing category ${config.gender}:${config.categoryName}`);
    }

    for (let index = 0; index < quota; index += 1) {
      const spec = buildShoeSpec(groupKey, index, imagePools);
      spec.image = imagePools[groupKey][index];
      const exists = await products.findOne({
        'externalSource.provider': SOURCE_PROVIDER,
        'externalSource.productId': spec.productCode,
      });

      if (exists) continue;

      const brand = brandMap.get(spec.brandName) ?? [...brandMap.values()][0];
      const { product, stockRows } = buildProductDocument(spec, brand, category, created + 1);

      await products.insertOne(product);
      await inventories.insertMany(stockRows, { ordered: false });
      created += 1;
      createdByKind[groupKey] = (createdByKind[groupKey] ?? 0) + 1;
      console.log(`[${created}/${targetCount}] Imported ${spec.name}`);
    }
  }

  return { created, createdByKind, quotas };
}

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Missing MONGODB_URI in backend/.env');
  }

  if (!Number.isInteger(TARGET_COUNT) || TARGET_COUNT < 0) {
    throw new Error('SHOE_IMPORT_TARGET must be a non-negative integer');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  if (process.env.SHOE_IMPORT_RESET === 'true') {
    await resetExistingImport(db);
  }

  const existingCount = await db.collection('products').countDocuments({ 'externalSource.provider': SOURCE_PROVIDER });

  if (existingCount >= TARGET_COUNT) {
    console.log(`Already have ${existingCount} demo shoe products. Target is ${TARGET_COUNT}; nothing to import.`);
    return;
  }

  const missingCount = TARGET_COUNT - existingCount;
  const [brandMap, categoryMap] = await Promise.all([getBrandMap(db), getCategoryMap(db)]);
  const imagePools = await getImagePools(db, categoryMap);
  const result = await importShoeProducts(db, brandMap, categoryMap, imagePools, missingCount);
  const totalDemoShoes = await db.collection('products').countDocuments({ 'externalSource.provider': SOURCE_PROVIDER });

  console.log(
    JSON.stringify(
      {
        ...result,
        totalDemoShoes,
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
