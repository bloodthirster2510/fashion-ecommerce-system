import { Types } from 'mongoose';
import { Inventory, InventoryImport, InventoryReservation, Product } from '../../../database/models';
import { InventoryServiceError, inventoryService } from '../inventory.service';

jest.mock('../../../database/models', () => ({
  Product: {
    findById: jest.fn(),
  },
  Inventory: {
    find: jest.fn(),
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
    countDocuments: jest.fn(),
  },
  InventoryImport: {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    countDocuments: jest.fn(),
    distinct: jest.fn(),
  },
  InventoryReservation: {
    create: jest.fn(),
    find: jest.fn(),
  },
}));

const mockedProduct = Product as jest.Mocked<typeof Product>;
const mockedInventory = Inventory as jest.Mocked<typeof Inventory>;
const mockedInventoryImport = InventoryImport as jest.Mocked<typeof InventoryImport>;
const mockedInventoryReservation = InventoryReservation as jest.Mocked<typeof InventoryReservation>;

const productId = '665000000000000000000003';
const variantId = '665000000000000000000011';
const colorVariantId = '665000000000000000000012';
const userId = '665000000000000000000020';

const productDocument = {
  _id: new Types.ObjectId(productId),
  isActive: true,
  variant: [
    {
      _id: new Types.ObjectId(variantId),
      isActive: true,
      sizeMeasurements: [
        {
          size: 'M',
          measurements: [],
        },
      ],
      colors: [
        {
          _id: new Types.ObjectId(colorVariantId),
          color: 'Black',
          image: 'https://example.com/black.png',
        },
      ],
    },
  ],
};

describe('inventoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedProduct.findById.mockResolvedValue(productDocument as never);
  });

  it('creates an import record and increments inventory quantities', async () => {
    const importRecord = { _id: new Types.ObjectId(), productId };
    mockedInventoryImport.create.mockResolvedValue(importRecord as never);
    mockedInventory.findOneAndUpdate.mockResolvedValue({ _id: new Types.ObjectId() } as never);

    const result = await inventoryService.createImport({
      productId,
      variantId,
      colorVariantId,
      detail: [
        {
          size: ' M ',
          quantity: 20,
          importPrice: 120000,
        },
      ],
    });

    expect(result).toBe(importRecord);
    expect(mockedInventoryImport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: expect.any(Types.ObjectId),
        variantId: expect.any(Types.ObjectId),
        colorVariantId: expect.any(Types.ObjectId),
        detail: [
          {
            size: 'M',
            quantity: 20,
            remainingQuantity: 20,
            importPrice: 120000,
          },
        ],
      }),
    );
    expect(mockedInventory.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: expect.any(Types.ObjectId),
        variantId: expect.any(Types.ObjectId),
        colorVariantId: expect.any(Types.ObjectId),
        size: 'M',
      }),
      expect.objectContaining({
        $inc: {
          quantity: 20,
          availableQuantity: 20,
        },
      }),
      {
        new: true,
        upsert: true,
      },
    );
  });

  it('rejects reservations when available inventory is insufficient', async () => {
    mockedInventory.findOneAndUpdate.mockResolvedValue(null);

    await expect(
      inventoryService.reserveInventory({
        userId,
        ttlMinutes: 15,
        items: [
          {
            productId,
            variantId,
            colorVariantId,
            size: 'M',
            quantity: 2,
          },
        ],
      }),
    ).rejects.toMatchObject<Partial<InventoryServiceError>>({
      message: 'Insufficient available inventory',
      statusCode: 409,
    });

    expect(mockedInventoryReservation.create).not.toHaveBeenCalled();
  });

  it('rolls back earlier reserved quantities when a later reservation item fails', async () => {
    mockedInventory.findOneAndUpdate
      .mockResolvedValueOnce({ _id: new Types.ObjectId() } as never)
      .mockResolvedValueOnce(null);
    mockedInventoryReservation.create.mockResolvedValue({ _id: new Types.ObjectId() } as never);
    mockedInventory.updateOne.mockResolvedValue({} as never);

    await expect(
      inventoryService.reserveInventory({
        userId,
        ttlMinutes: 15,
        items: [
          {
            productId,
            variantId,
            colorVariantId,
            size: 'M',
            quantity: 1,
          },
          {
            productId,
            variantId,
            colorVariantId,
            size: 'M',
            quantity: 99,
          },
        ],
      }),
    ).rejects.toMatchObject<Partial<InventoryServiceError>>({
      message: 'Insufficient available inventory',
      statusCode: 409,
    });

    expect(mockedInventory.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: expect.any(Types.ObjectId),
        variantId: expect.any(Types.ObjectId),
        colorVariantId: expect.any(Types.ObjectId),
        size: 'M',
      }),
      {
        $inc: {
          reservedQuantity: -1,
          availableQuantity: 1,
        },
      },
    );
  });

  it('consumes import remaining quantities when reservations are committed', async () => {
    const reservation = {
      _id: new Types.ObjectId(),
      productId: new Types.ObjectId(productId),
      variantId: new Types.ObjectId(variantId),
      colorVariantId: new Types.ObjectId(colorVariantId),
      size: 'M',
      quantity: 2,
      status: 'active',
      save: jest.fn().mockResolvedValue(undefined),
    };
    const firstImport = {
      detail: [{ size: 'M', quantity: 10, remainingQuantity: 1 }],
      save: jest.fn().mockResolvedValue(undefined),
    };
    const secondImport = {
      detail: [{ size: 'M', quantity: 10, remainingQuantity: 5 }],
      save: jest.fn().mockResolvedValue(undefined),
    };
    const sort = jest.fn().mockResolvedValue([firstImport, secondImport]);

    mockedInventoryReservation.find.mockResolvedValue([reservation] as never);
    mockedInventory.updateOne.mockResolvedValue({} as never);
    mockedInventoryImport.find.mockReturnValue({ sort } as never);

    await inventoryService.commitReservations({
      reservationIds: [reservation._id.toString()],
    });

    expect(sort).toHaveBeenCalledWith({ createdAt: 1 });
    expect(firstImport.detail[0].remainingQuantity).toBe(0);
    expect(secondImport.detail[0].remainingQuantity).toBe(4);
    expect(firstImport.save).toHaveBeenCalled();
    expect(secondImport.save).toHaveBeenCalled();
  });

  it('restores import remaining quantities when committed stock is returned', async () => {
    const oldImport = {
      detail: [{ size: 'M', quantity: 10, remainingQuantity: 8 }],
      save: jest.fn().mockResolvedValue(undefined),
    };
    const latestImport = {
      detail: [{ size: 'M', quantity: 10, remainingQuantity: 9 }],
      save: jest.fn().mockResolvedValue(undefined),
    };
    const sort = jest.fn().mockResolvedValue([latestImport, oldImport]);

    mockedInventoryImport.find.mockReturnValue({ sort } as never);

    await inventoryService.restoreImportRemainingQuantities([
      {
        productId: new Types.ObjectId(productId),
        variantId: new Types.ObjectId(variantId),
        colorVariantId: new Types.ObjectId(colorVariantId),
        size: 'M',
        quantity: 2,
      },
    ]);

    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(latestImport.detail[0].remainingQuantity).toBe(10);
    expect(oldImport.detail[0].remainingQuantity).toBe(9);
    expect(latestImport.save).toHaveBeenCalled();
    expect(oldImport.save).toHaveBeenCalled();
  });
});
