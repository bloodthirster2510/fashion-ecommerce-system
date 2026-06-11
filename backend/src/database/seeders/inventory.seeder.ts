import { Types } from 'mongoose';
import { Inventory, InventoryImport, Product, type IProductVariant } from '../models';

const getSeedQuantity = () => Number(process.env.INVENTORY_SEED_QUANTITY ?? 20);

const normalizeSize = (size: string) => size.trim();

const buildSku = (
  productId: Types.ObjectId,
  variantId: Types.ObjectId,
  colorVariantId: Types.ObjectId,
  size: string,
) => {
  const skuSize = size.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');
  return [
    'INV',
    productId.toString().slice(-6),
    variantId.toString().slice(-6),
    colorVariantId.toString().slice(-6),
    skuSize || 'SIZE',
  ].join('-').toUpperCase();
};

const getInventoryKey = (variantId: Types.ObjectId, colorVariantId: Types.ObjectId, size: string) =>
  [
    variantId.toString(),
    colorVariantId.toString(),
    normalizeSize(size).toLowerCase(),
  ].join(':');

export const seedInventoryForExistingProducts = async () => {
  const seedQuantity = getSeedQuantity();

  if (!Number.isInteger(seedQuantity) || seedQuantity < 1) {
    console.log('Skipped inventory seed: INVENTORY_SEED_QUANTITY must be a positive integer');
    return;
  }

  const products = await Product.find({ isActive: true }).select('_id variant name').lean<{
    _id: Types.ObjectId;
    name: string;
    variant: IProductVariant[];
  }[]>();
  let createdRows = 0;

  for (const product of products) {
    const existingInventory = await Inventory.find({ productId: product._id })
      .select('variantId colorVariantId size')
      .lean<Array<{ variantId: Types.ObjectId; colorVariantId: Types.ObjectId; size: string }>>();
    const existingKeys = new Set(
      existingInventory.map((item) => getInventoryKey(item.variantId, item.colorVariantId, item.size)),
    );

    for (const variant of product.variant ?? []) {
      if (!variant.isActive) {
        continue;
      }

      for (const color of variant.colors ?? []) {
        const missingDetails = (variant.sizeMeasurements ?? [])
          .map((sizeMeasurement) => normalizeSize(sizeMeasurement.size))
          .filter(Boolean)
          .filter((size) => !existingKeys.has(getInventoryKey(variant._id, color._id, size)))
          .map((size) => ({
            size,
            quantity: seedQuantity,
            remainingQuantity: seedQuantity,
          }));

        if (!missingDetails.length) {
          continue;
        }

        const insertedDetails = (
          await Promise.all(
            missingDetails.map(async (detail) => {
              const result = await Inventory.updateOne(
              {
                productId: product._id,
                variantId: variant._id,
                colorVariantId: color._id,
                size: detail.size,
              },
              {
                $setOnInsert: {
                  productId: product._id,
                  variantId: variant._id,
                  colorVariantId: color._id,
                  size: detail.size,
                  sku: buildSku(product._id, variant._id, color._id, detail.size),
                  quantity: detail.quantity,
                  reservedQuantity: 0,
                  availableQuantity: detail.quantity,
                },
              },
              {
                upsert: true,
              },
              );

              return result.upsertedCount > 0 ? detail : null;
            }),
          )
        ).filter((detail): detail is typeof missingDetails[number] => detail !== null);

        if (insertedDetails.length > 0) {
          await InventoryImport.create({
            productId: product._id,
            variantId: variant._id,
            colorVariantId: color._id,
            detail: insertedDetails,
          });
        }

        missingDetails.forEach((detail) => {
          existingKeys.add(getInventoryKey(variant._id, color._id, detail.size));
        });
        createdRows += insertedDetails.length;
      }
    }
  }

  if (createdRows > 0) {
    console.log(`Seeded ${createdRows} inventory rows for existing products`);
  } else {
    console.log('Inventory rows already seeded');
  }
};
