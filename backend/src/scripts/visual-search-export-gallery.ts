import dotenv from 'dotenv';
import { mkdir, writeFile } from 'fs/promises';
import mongoose, { Types } from 'mongoose';
import path from 'path';
import { connectDB } from '../config/database';
import { Inventory, Product } from '../database/models';
import type { IProductVariant } from '../database/models/product.model';

dotenv.config();

type PopulatedRelation = {
  _id: Types.ObjectId;
  name?: string;
  gender?: string;
};

type ProductForGallery = {
  _id: Types.ObjectId;
  name: string;
  product_image: string;
  category_id: Types.ObjectId | PopulatedRelation | null;
  brand_id: Types.ObjectId | PopulatedRelation | null;
  variant: IProductVariant[];
  isActive: boolean;
};

type InventoryForGallery = {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  colorVariantId: Types.ObjectId;
  availableQuantity: number;
};

type GalleryRow = {
  galleryImageId: string;
  productId: string;
  variantId: string;
  colorVariantId: string;
  imageUrl: string;
  imageSource: 'product_image' | 'color_variant_image';
  productName: string;
  categoryId: string;
  categoryName: string;
  brandId: string;
  brandName: string;
  gender: string;
  color: string;
  price: number | '';
  finalPrice: number | '';
  isActive: boolean;
  availableQuantity: number;
};

const headers: Array<keyof GalleryRow> = [
  'galleryImageId',
  'productId',
  'variantId',
  'colorVariantId',
  'imageUrl',
  'imageSource',
  'productName',
  'categoryId',
  'categoryName',
  'brandId',
  'brandName',
  'gender',
  'color',
  'price',
  'finalPrice',
  'isActive',
  'availableQuantity',
];

// Lấy giá trị của tham số dạng --ten=value khi chạy script.
const getArgValue = (name: string) => {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};

// Kiểm tra script có được chạy kèm một cờ như --active-only hay không.
const hasFlag = (flag: string) => process.argv.includes(flag);

// Đọc tham số số nguyên dương, ví dụ --limit=50.
const getNumberArg = (name: string) => {
  const rawValue = getArgValue(name);
  const value = Number(rawValue);
  return Number.isInteger(value) && value > 0 ? value : undefined;
};

// Chuẩn hóa ObjectId hoặc object đã populate thành chuỗi id.
const toIdString = (value: unknown) => {
  if (!value) return '';
  if (value instanceof Types.ObjectId) return value.toString();
  if (typeof value === 'object' && '_id' in value && value._id instanceof Types.ObjectId) {
    return value._id.toString();
  }
  return String(value);
};

// Lấy tên danh mục/thương hiệu sau khi dữ liệu đã được populate.
const getRelationName = (value: unknown) => {
  if (value && typeof value === 'object' && 'name' in value && typeof value.name === 'string') {
    return value.name;
  }
  return '';
};

// Lấy giới tính của danh mục để phục vụ lọc và đánh giá visual search.
const getRelationGender = (value: unknown) => {
  if (value && typeof value === 'object' && 'gender' in value && typeof value.gender === 'string') {
    return value.gender;
  }
  return '';
};

// Tính giá sau giảm để file gallery có cùng thông tin giá với catalog.
const getFinalPrice = (price: number, discount: number) => {
  if (discount <= 0) return price;
  return Math.round(price * (1 - discount / 100));
};

// Tạo khóa gộp tồn kho theo sản phẩm, biến thể và màu.
const getInventoryKey = (productId: string, variantId = '', colorVariantId = '') =>
  [productId, variantId, colorVariantId].join('|');

// Gom tồn kho để biết mỗi ảnh/sản phẩm còn bao nhiêu hàng có thể bán.
const buildInventoryMaps = (items: InventoryForGallery[]) => {
  const productTotals = new Map<string, number>();
  const colorTotals = new Map<string, number>();

  items.forEach((item) => {
    const productId = item.productId.toString();
    const variantId = item.variantId.toString();
    const colorVariantId = item.colorVariantId.toString();
    const availableQuantity = Math.max(0, item.availableQuantity);

    productTotals.set(
      getInventoryKey(productId),
      (productTotals.get(getInventoryKey(productId)) ?? 0) + availableQuantity,
    );
    colorTotals.set(
      getInventoryKey(productId, variantId, colorVariantId),
      (colorTotals.get(getInventoryKey(productId, variantId, colorVariantId)) ?? 0) + availableQuantity,
    );
  });

  return { productTotals, colorTotals };
};

// Chọn biến thể đại diện để lấy giá cho ảnh chính của sản phẩm.
const getDisplayVariant = (variants: IProductVariant[]) => {
  return variants.find((variant) => variant.isActive) ?? variants[0];
};

// Bọc giá trị CSV khi có dấu phẩy, dấu nháy hoặc xuống dòng.
const escapeCsvValue = (value: GalleryRow[keyof GalleryRow]) => {
  const stringValue = String(value ?? '');
  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

// Chuyển danh sách dòng gallery thành nội dung CSV hoàn chỉnh.
const toCsv = (rows: GalleryRow[]) => {
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(',')),
  ];

  return `${lines.join('\n')}\n`;
};

// Tạo các dòng gallery từ dữ liệu sản phẩm: gồm ảnh chính và ảnh từng màu.
const buildGalleryRows = (
  products: ProductForGallery[],
  inventoryItems: InventoryForGallery[],
) => {
  const { productTotals, colorTotals } = buildInventoryMaps(inventoryItems);
  const rows: GalleryRow[] = [];

  products.forEach((product) => {
    const productId = product._id.toString();
    const categoryId = toIdString(product.category_id);
    const brandId = toIdString(product.brand_id);
    const categoryName = getRelationName(product.category_id);
    const brandName = getRelationName(product.brand_id);
    const gender = getRelationGender(product.category_id);
    const displayVariant = getDisplayVariant(product.variant ?? []);
    const price = displayVariant?.price ?? '';
    const finalPrice = displayVariant ? getFinalPrice(displayVariant.price, displayVariant.discount) : '';

    if (product.product_image?.trim()) {
      rows.push({
        galleryImageId: `${productId}:product_image`,
        productId,
        variantId: '',
        colorVariantId: '',
        imageUrl: product.product_image.trim(),
        imageSource: 'product_image',
        productName: product.name,
        categoryId,
        categoryName,
        brandId,
        brandName,
        gender,
        color: '',
        price,
        finalPrice,
        isActive: product.isActive,
        availableQuantity: productTotals.get(getInventoryKey(productId)) ?? 0,
      });
    }

    (product.variant ?? []).forEach((variant) => {
      const variantId = toIdString(variant._id);
      variant.colors.forEach((color) => {
        const colorVariantId = toIdString(color._id);
        if (!color.image?.trim()) {
          return;
        }

        rows.push({
          galleryImageId: `${productId}:${variantId}:${colorVariantId}`,
          productId,
          variantId,
          colorVariantId,
          imageUrl: color.image.trim(),
          imageSource: 'color_variant_image',
          productName: product.name,
          categoryId,
          categoryName,
          brandId,
          brandName,
          gender,
          color: color.color,
          price: variant.price,
          finalPrice: getFinalPrice(variant.price, variant.discount),
          isActive: product.isActive && variant.isActive,
          availableQuantity: colorTotals.get(getInventoryKey(productId, variantId, colorVariantId)) ?? 0,
        });
      });
    });
  });

  return rows;
};

// Luồng chính: kết nối DB, đọc sản phẩm, tạo CSV và in thống kê kết quả.
const run = async () => {
  await connectDB();

  const outputPath = path.resolve(
    process.cwd(),
    getArgValue('out') ?? 'docs_vs/visual-search-gallery.csv',
  );
  const activeOnly = hasFlag('--active-only');
  const limit = getNumberArg('limit');
  const productQuery = Product.find(activeOnly ? { isActive: true } : {})
    .populate('category_id', '_id name gender')
    .populate('brand_id', '_id name')
    .sort({ createdAt: -1 });

  if (limit) {
    productQuery.limit(limit);
  }

  const products = await productQuery.lean<ProductForGallery[]>();
  const productIds = products.map((product) => product._id);
  const inventoryItems = productIds.length
    ? await Inventory.find({ productId: { $in: productIds } })
        .select('productId variantId colorVariantId availableQuantity')
        .lean<InventoryForGallery[]>()
    : [];
  const rows = buildGalleryRows(products, inventoryItems);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, toCsv(rows), 'utf8');

  console.log(JSON.stringify({
    outputPath,
    productCount: products.length,
    imageCount: rows.length,
    productImageCount: rows.filter((row) => row.imageSource === 'product_image').length,
    colorVariantImageCount: rows.filter((row) => row.imageSource === 'color_variant_image').length,
    activeOnly,
    limit: limit ?? null,
  }, null, 2));
};

run()
  .catch((error) => {
    console.error('Visual search gallery export failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
