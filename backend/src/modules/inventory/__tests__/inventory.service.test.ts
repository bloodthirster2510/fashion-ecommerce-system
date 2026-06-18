import mongoose, { Types } from 'mongoose';
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
const startSessionSpy = jest.spyOn(mongoose, 'startSession');

type MockSession = {
  withTransaction: jest.Mock;
  endSession: jest.Mock;
};

let mockSession: MockSession;

const createMockSession = (): MockSession => ({
  withTransaction: jest.fn(async (callback: () => Promise<unknown>) => callback()),
  endSession: jest.fn().mockResolvedValue(undefined),
});

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
        {
          size: 'L',
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
    jest.resetAllMocks();
    mockSession = createMockSession();
    startSessionSpy.mockResolvedValue(mockSession as never);
    mockedProduct.findById.mockResolvedValue(productDocument as never);
  });

  it('creates an import record and increments inventory quantities', async () => {
    const importRecord = { _id: new Types.ObjectId(), productId };
    mockedInventoryImport.create.mockResolvedValue([importRecord] as never);
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
      [
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
      ],
      { session: mockSession },
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
        returnDocument: 'after',
        upsert: true,
        session: mockSession,
      },
    );
    expect(mockSession.withTransaction).toHaveBeenCalledTimes(1);
    expect(mockSession.endSession).toHaveBeenCalledTimes(1);
  });

  it('aborts the import transaction when an inventory upsert fails midway', async () => {
    const importRecord = {
      _id: new Types.ObjectId(),
      productId,
      deleteOne: jest.fn().mockResolvedValue(undefined),
    };
    const upsertError = new Error('inventory write failed');
    mockedInventoryImport.create.mockResolvedValue([importRecord] as never);
    mockedInventory.findOneAndUpdate
      .mockResolvedValueOnce({ _id: new Types.ObjectId() } as never)
      .mockRejectedValueOnce(upsertError);

    await expect(
      inventoryService.createImport({
        productId,
        variantId,
        colorVariantId,
        detail: [
          { size: 'M', quantity: 20 },
          { size: 'L', quantity: 10 },
        ],
      }),
    ).rejects.toBe(upsertError);

    expect(mockedInventory.updateOne).not.toHaveBeenCalled();
    expect(importRecord.deleteOne).not.toHaveBeenCalled();
    expect(mockSession.withTransaction).toHaveBeenCalledTimes(1);
    expect(mockSession.endSession).toHaveBeenCalledTimes(1);
  });

  it('deletes an import with conditional stock decrements', async () => {
    const importRecord = {
      _id: new Types.ObjectId(),
      productId: new Types.ObjectId(productId),
      variantId: new Types.ObjectId(variantId),
      colorVariantId: new Types.ObjectId(colorVariantId),
      detail: [{ size: 'M', quantity: 10, remainingQuantity: 10 }],
      deleteOne: jest.fn().mockResolvedValue(undefined),
    };
    mockedInventoryImport.findById.mockResolvedValue(importRecord as never);
    mockedInventory.updateOne.mockResolvedValue({ matchedCount: 1 } as never);

    const result = await inventoryService.deleteImport(importRecord._id.toString());

    expect(result).toBe(importRecord);
    expect(mockedInventory.countDocuments).not.toHaveBeenCalled();
    expect(mockedInventory.updateOne).toHaveBeenCalledWith(
      {
        productId: importRecord.productId,
        variantId: importRecord.variantId,
        colorVariantId: importRecord.colorVariantId,
        size: 'M',
        quantity: { $gte: 10 },
        availableQuantity: { $gte: 10 },
      },
      {
        $inc: {
          quantity: -10,
          availableQuantity: -10,
        },
      },
    );
    expect(importRecord.deleteOne).toHaveBeenCalled();
  });

  it('rolls back decremented inventory when deleting an import fails midway', async () => {
    const importRecord = {
      _id: new Types.ObjectId(),
      productId: new Types.ObjectId(productId),
      variantId: new Types.ObjectId(variantId),
      colorVariantId: new Types.ObjectId(colorVariantId),
      detail: [
        { size: 'M', quantity: 10, remainingQuantity: 10 },
        { size: 'L', quantity: 5, remainingQuantity: 5 },
      ],
      deleteOne: jest.fn().mockResolvedValue(undefined),
    };
    mockedInventoryImport.findById.mockResolvedValue(importRecord as never);
    mockedInventory.updateOne
      .mockResolvedValueOnce({ matchedCount: 1 } as never)
      .mockResolvedValueOnce({ matchedCount: 0 } as never)
      .mockResolvedValueOnce({ matchedCount: 1 } as never);

    await expect(
      inventoryService.deleteImport(importRecord._id.toString()),
    ).rejects.toMatchObject({
      message: 'Cannot delete import because imported stock has been used or reserved',
      statusCode: 409,
    });

    expect(mockedInventory.updateOne).toHaveBeenLastCalledWith(
      {
        productId: importRecord.productId,
        variantId: importRecord.variantId,
        colorVariantId: importRecord.colorVariantId,
        size: 'M',
      },
      {
        $inc: {
          quantity: 10,
          availableQuantity: 10,
        },
      },
    );
    expect(importRecord.deleteOne).not.toHaveBeenCalled();
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

  it('commits reservations even when stock came from manual adjustment without import history', async () => {
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
    const sort = jest.fn().mockResolvedValue([]);

    mockedInventoryReservation.find.mockResolvedValue([reservation] as never);
    mockedInventory.updateOne.mockResolvedValue({} as never);
    mockedInventoryImport.find.mockReturnValue({ sort } as never);

    await inventoryService.commitReservations({
      reservationIds: [reservation._id.toString()],
    });

    expect(mockedInventory.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: reservation.productId,
        variantId: reservation.variantId,
        colorVariantId: reservation.colorVariantId,
        size: 'M',
        reservedQuantity: { $gte: 2 },
      }),
      {
        $inc: {
          quantity: -2,
          reservedQuantity: -2,
        },
      },
    );
    expect(sort).toHaveBeenCalledWith({ createdAt: 1 });
    expect(reservation.status).toBe('committed');
    expect(reservation.save).toHaveBeenCalled();
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

  it('adjusts inventory atomically and restores import remaining quantities on stock increase', async () => {
    const inventoryId = new Types.ObjectId();
    const previousInventory = {
      _id: inventoryId,
      productId: new Types.ObjectId(productId),
      variantId: new Types.ObjectId(variantId),
      colorVariantId: new Types.ObjectId(colorVariantId),
      size: 'M',
      quantity: 10,
      reservedQuantity: 2,
      availableQuantity: 8,
    };
    const updatedInventory = {
      ...previousInventory,
      quantity: 15,
      availableQuantity: 13,
    };
    const sort = jest.fn().mockResolvedValue([]);

    mockedInventory.findOneAndUpdate.mockResolvedValue(previousInventory as never);
    mockedInventory.findById.mockResolvedValue(updatedInventory as never);
    mockedInventoryImport.find.mockReturnValue({ sort } as never);

    const result = await inventoryService.adjustInventory(inventoryId.toString(), {
      quantity: 15,
    });

    expect(mockedInventory.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: inventoryId,
        reservedQuantity: { $lte: 15 },
      },
      [
        {
          $set: {
            quantity: 15,
            availableQuantity: { $subtract: [15, '$reservedQuantity'] },
          },
        },
      ],
      {
        returnDocument: 'before',
        runValidators: true,
      },
    );
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(result).toBe(updatedInventory);
  });

  it('adjusts inventory atomically and consumes import remaining quantities on stock decrease', async () => {
    const inventoryId = new Types.ObjectId();
    const previousInventory = {
      _id: inventoryId,
      productId: new Types.ObjectId(productId),
      variantId: new Types.ObjectId(variantId),
      colorVariantId: new Types.ObjectId(colorVariantId),
      size: 'M',
      quantity: 10,
      reservedQuantity: 2,
      availableQuantity: 8,
    };
    const updatedInventory = {
      ...previousInventory,
      quantity: 7,
      availableQuantity: 5,
    };
    const importRecord = {
      detail: [{ size: 'M', quantity: 10, remainingQuantity: 6 }],
      save: jest.fn().mockResolvedValue(undefined),
    };
    const sort = jest.fn().mockResolvedValue([importRecord]);

    mockedInventory.findOneAndUpdate.mockResolvedValue(previousInventory as never);
    mockedInventory.findById.mockResolvedValue(updatedInventory as never);
    mockedInventoryImport.find.mockReturnValue({ sort } as never);

    const result = await inventoryService.adjustInventory(inventoryId.toString(), {
      deltaQuantity: -3,
    });

    expect(mockedInventory.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: inventoryId,
        $expr: {
          $gte: [{ $add: ['$quantity', -3] }, '$reservedQuantity'],
        },
      },
      [
        {
          $set: {
            quantity: { $add: ['$quantity', -3] },
            availableQuantity: { $add: ['$availableQuantity', -3] },
          },
        },
      ],
      {
        returnDocument: 'before',
        runValidators: true,
      },
    );
    expect(sort).toHaveBeenCalledWith({ createdAt: 1 });
    expect(importRecord.detail[0].remainingQuantity).toBe(3);
    expect(importRecord.save).toHaveBeenCalled();
    expect(result).toBe(updatedInventory);
  });

  it('rejects inventory adjustment when the atomic guard does not match', async () => {
    const inventoryId = new Types.ObjectId();
    mockedInventory.findOneAndUpdate.mockResolvedValue(null);
    mockedInventory.findById.mockResolvedValue({
      _id: inventoryId,
      reservedQuantity: 4,
    } as never);

    await expect(
      inventoryService.adjustInventory(inventoryId.toString(), {
        quantity: 2,
      }),
    ).rejects.toMatchObject({
      message: 'quantity cannot be lower than reservedQuantity',
      statusCode: 400,
    });
  });
});
