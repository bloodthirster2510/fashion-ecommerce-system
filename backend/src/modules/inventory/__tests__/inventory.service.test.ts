import mongoose, { Types } from 'mongoose';
import {
  Inventory,
  InventoryImport,
  InventoryMovement,
  InventoryReceipt,
  InventoryReservation,
  InventoryStocktake,
  InventorySupplier,
  Product,
} from '../../../database/models';
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
    exists: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    countDocuments: jest.fn(),
    distinct: jest.fn(),
  },
  InventoryMovement: {
    create: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  },
  InventoryReceipt: {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
  },
  InventoryReservation: {
    create: jest.fn(),
    find: jest.fn(),
  },
  InventorySupplier: {
    create: jest.fn(),
    updateOne: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
  },
  InventoryStocktake: {
    create: jest.fn(),
  },
}));

const mockedProduct = Product as jest.Mocked<typeof Product>;
const mockedInventory = Inventory as jest.Mocked<typeof Inventory>;
const mockedInventoryImport = InventoryImport as jest.Mocked<typeof InventoryImport>;
const mockedInventoryMovement = InventoryMovement as jest.Mocked<typeof InventoryMovement>;
const mockedInventoryReceipt = InventoryReceipt as jest.Mocked<typeof InventoryReceipt>;
const mockedInventoryReservation = InventoryReservation as jest.Mocked<typeof InventoryReservation>;
const mockedInventorySupplier = InventorySupplier as jest.Mocked<typeof InventorySupplier>;
const mockedInventoryStocktake = InventoryStocktake as jest.Mocked<typeof InventoryStocktake>;
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

const createQueryLikePromise = <T>(value: T) => {
  const query = Promise.resolve(value) as Promise<T> & { session: jest.Mock };
  query.session = jest.fn().mockResolvedValue(value);

  return query;
};

const mockReceiptCodeLookup = (receiptCodes: string[] = []) => {
  const lean = jest.fn().mockResolvedValue(receiptCodes.map((receiptCode) => ({ receiptCode })));
  const select = jest.fn().mockReturnValue({ lean });
  mockedInventoryReceipt.find.mockReturnValue({ select } as never);

  return { select, lean };
};

describe('inventoryService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockSession = createMockSession();
    startSessionSpy.mockResolvedValue(mockSession as never);
    mockedProduct.findById.mockReturnValue(createQueryLikePromise(productDocument) as never);
    mockedInventoryMovement.create.mockResolvedValue({} as never);
    mockedInventorySupplier.updateOne.mockResolvedValue({} as never);
    mockedInventoryStocktake.create.mockResolvedValue([{ _id: new Types.ObjectId() }] as never);
    mockReceiptCodeLookup();
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

  it('creates a draft receipt with a generated PN code and calculated totals', async () => {
    mockReceiptCodeLookup(['PN00001', 'PN00009']);
    const receiptRecord = { _id: new Types.ObjectId(), receiptCode: 'PN00010' };
    mockedInventoryReceipt.create.mockResolvedValue(receiptRecord as never);

    const result = await inventoryService.createReceipt(
      {
        supplierName: ' Công Ty ABC ',
        note: ' Nhập bổ sung ',
        importDate: new Date('2026-07-04T00:00:00.000Z'),
        lines: [
          {
            productId,
            variantId,
            colorVariantId,
            detail: [
              { size: ' M ', quantity: 3, importPrice: 100000 },
              { size: 'L', quantity: 2, importPrice: 120000 },
            ],
          },
        ],
      },
      userId,
    );

    expect(result).toBe(receiptRecord);
    expect(mockedInventoryReceipt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        receiptCode: 'PN00010',
        supplierName: 'Công Ty ABC',
        note: 'Nhập bổ sung',
        createdBy: expect.any(Types.ObjectId),
        status: 'draft',
        totalQuantity: 5,
        totalAmount: 540000,
        lines: [
          {
            productId: expect.any(Types.ObjectId),
            variantId: expect.any(Types.ObjectId),
            colorVariantId: expect.any(Types.ObjectId),
            detail: [
              { size: 'M', quantity: 3, importPrice: 100000 },
              { size: 'L', quantity: 2, importPrice: 120000 },
            ],
          },
        ],
      }),
    );
    expect(mockedInventoryImport.create).not.toHaveBeenCalled();
    expect(mockedInventory.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('retries generated receipt codes when a duplicate key race happens', async () => {
    mockReceiptCodeLookup(['PN00001']);
    const duplicateKeyError = Object.assign(new Error('duplicate key'), { code: 11000 });
    const receiptRecord = { _id: new Types.ObjectId(), receiptCode: 'PN00002' };

    mockedInventoryReceipt.create
      .mockRejectedValueOnce(duplicateKeyError)
      .mockResolvedValueOnce(receiptRecord as never);

    const result = await inventoryService.createReceipt({
      lines: [
        {
          productId,
          variantId,
          colorVariantId,
          detail: [{ size: 'M', quantity: 1 }],
        },
      ],
    });

    expect(result).toBe(receiptRecord);
    expect(mockedInventoryReceipt.create).toHaveBeenCalledTimes(2);
  });

  it('returns a conflict when an admin-provided receipt code already exists', async () => {
    const duplicateKeyError = Object.assign(new Error('duplicate key'), { code: 11000 });
    mockedInventoryReceipt.create.mockRejectedValue(duplicateKeyError);

    await expect(
      inventoryService.createReceipt({
        receiptCode: 'PN00010',
        lines: [
          {
            productId,
            variantId,
            colorVariantId,
            detail: [{ size: 'M', quantity: 1 }],
          },
        ],
      }),
    ).rejects.toMatchObject({
      message: 'Receipt code already exists',
      statusCode: 409,
    });
  });

  it('rejects unsafe receipt quantities before writing data', async () => {
    await expect(
      inventoryService.createReceipt({
        lines: [
          {
            productId,
            variantId,
            colorVariantId,
            detail: [{ size: 'M', quantity: 1_000_001 }],
          },
        ],
      }),
    ).rejects.toMatchObject({
      message: 'Import detail quantity must be an integer greater than or equal to 1',
      statusCode: 400,
    });

    expect(mockedInventoryReceipt.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate receipt selectors when object id casing differs', async () => {
    const casedProductId = 'abcdef000000000000000003';
    const casedVariantId = 'abcdef000000000000000011';
    const casedColorVariantId = 'abcdef000000000000000012';
    mockedProduct.findById.mockReturnValue(createQueryLikePromise({
      ...productDocument,
      _id: new Types.ObjectId(casedProductId),
      variant: [
        {
          ...productDocument.variant[0],
          _id: new Types.ObjectId(casedVariantId),
          colors: [
            {
              ...productDocument.variant[0].colors[0],
              _id: new Types.ObjectId(casedColorVariantId),
            },
          ],
        },
      ],
    }) as never);

    await expect(
      inventoryService.createReceipt({
        lines: [
          {
            productId: casedProductId,
            variantId: casedVariantId,
            colorVariantId: casedColorVariantId,
            detail: [{ size: 'M', quantity: 1 }],
          },
          {
            productId: casedProductId.toUpperCase(),
            variantId: casedVariantId.toUpperCase(),
            colorVariantId: casedColorVariantId.toUpperCase(),
            detail: [{ size: 'm', quantity: 2 }],
          },
        ],
      }),
    ).rejects.toMatchObject({
      message: 'Duplicate product variant size in receipt',
      statusCode: 400,
    });

    expect(mockedInventoryReceipt.create).not.toHaveBeenCalled();
  });

  it('confirms a draft receipt by creating linked import lots and incrementing inventory', async () => {
    const receiptId = new Types.ObjectId();
    const receiptRecord = {
      _id: receiptId,
      receiptCode: 'PN00007',
      supplierName: 'Công Ty ABC',
      status: 'confirmed',
      lines: [
        {
          productId: new Types.ObjectId(productId),
          variantId: new Types.ObjectId(variantId),
          colorVariantId: new Types.ObjectId(colorVariantId),
          detail: [
            { size: 'M', quantity: 4, importPrice: 100000 },
            { size: 'L', quantity: 6, importPrice: 100000 },
          ],
        },
      ],
    };
    const importRecord = { _id: new Types.ObjectId() };

    mockedInventoryReceipt.findOneAndUpdate.mockResolvedValue(receiptRecord as never);
    mockedInventoryImport.exists.mockReturnValue({ session: jest.fn().mockResolvedValue(null) } as never);
    mockedInventoryImport.create.mockResolvedValue([importRecord] as never);
    mockedInventory.findOneAndUpdate.mockResolvedValue({ _id: new Types.ObjectId() } as never);

    const result = await inventoryService.confirmReceipt(receiptId.toString());

    expect(result).toBe(receiptRecord);
    expect(mockedInventoryImport.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          importCode: 'PN00007-01',
          receiptId,
          receiptCode: 'PN00007',
          supplierName: 'Công Ty ABC',
          productId: expect.any(Types.ObjectId),
          variantId: expect.any(Types.ObjectId),
          colorVariantId: expect.any(Types.ObjectId),
          detail: [
            { size: 'M', quantity: 4, remainingQuantity: 4, importPrice: 100000 },
            { size: 'L', quantity: 6, remainingQuantity: 6, importPrice: 100000 },
          ],
          totalAmount: 1000000,
        }),
      ],
      { session: mockSession },
    );
    expect(mockedInventory.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(receiptRecord.status).toBe('confirmed');
    expect(mockSession.withTransaction).toHaveBeenCalledTimes(1);
    expect(mockSession.endSession).toHaveBeenCalledTimes(1);
  });

  it('rejects confirmation when a draft receipt has no product lines', async () => {
    const receiptRecord = {
      _id: new Types.ObjectId(),
      receiptCode: 'PN00008',
      status: 'draft',
      lines: [],
      save: jest.fn(),
    };
    mockedInventoryReceipt.findOneAndUpdate.mockResolvedValue(receiptRecord as never);

    await expect(
      inventoryService.confirmReceipt(receiptRecord._id.toString()),
    ).rejects.toMatchObject({
      message: 'Receipt must include at least one product before confirmation',
      statusCode: 400,
    });

    expect(mockedInventoryImport.create).not.toHaveBeenCalled();
    expect(mockedInventory.findOneAndUpdate).not.toHaveBeenCalled();
    expect(mockSession.endSession).toHaveBeenCalledTimes(1);
  });

  it('returns an already confirmed receipt without creating duplicate import lots', async () => {
    const receiptRecord = {
      _id: new Types.ObjectId(),
      receiptCode: 'PN00009',
      status: 'confirmed',
      lines: [
        {
          productId: new Types.ObjectId(productId),
          variantId: new Types.ObjectId(variantId),
          colorVariantId: new Types.ObjectId(colorVariantId),
          detail: [{ size: 'M', quantity: 2, importPrice: 100000 }],
        },
      ],
    };
    mockedInventoryReceipt.findOneAndUpdate.mockResolvedValue(null);
    mockedInventoryReceipt.findById.mockReturnValue({
      session: jest.fn().mockResolvedValue(receiptRecord),
    } as never);

    const result = await inventoryService.confirmReceipt(receiptRecord._id.toString());

    expect(result).toBe(receiptRecord);
    expect(mockedInventoryImport.create).not.toHaveBeenCalled();
    expect(mockedInventory.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('keeps generated import codes within the schema limit for the 100th receipt line', async () => {
    const receiptRecord = {
      _id: new Types.ObjectId(),
      receiptCode: 'R'.repeat(40),
      supplierName: '',
      status: 'confirmed',
      lines: Array.from({ length: 100 }, () => ({
        productId: new Types.ObjectId(productId),
        variantId: new Types.ObjectId(variantId),
        colorVariantId: new Types.ObjectId(colorVariantId),
        detail: [{ size: 'M', quantity: 1, importPrice: 0 }],
      })),
    };

    mockedInventoryReceipt.findOneAndUpdate.mockResolvedValue(receiptRecord as never);
    mockedInventoryImport.exists.mockReturnValue({ session: jest.fn().mockResolvedValue(null) } as never);
    mockedInventoryImport.create.mockResolvedValue([{ _id: new Types.ObjectId() }] as never);
    mockedInventory.findOneAndUpdate.mockResolvedValue({ _id: new Types.ObjectId() } as never);

    await inventoryService.confirmReceipt(receiptRecord._id.toString());

    expect(mockedInventoryImport.create).toHaveBeenCalledTimes(100);
    const hundredthImportPayload = mockedInventoryImport.create.mock.calls[99][0] as unknown as Array<{
      importCode: string;
    }>;
    expect(hundredthImportPayload[0].importCode).toBe(`${'R'.repeat(36)}-100`);
    expect(hundredthImportPayload[0].importCode).toHaveLength(40);
  });

  it('does not confirm or mutate stock for a cancelled receipt', async () => {
    const receiptRecord = {
      _id: new Types.ObjectId(),
      receiptCode: 'PN00010',
      status: 'cancelled',
      lines: [],
    };
    mockedInventoryReceipt.findOneAndUpdate.mockResolvedValue(null);
    mockedInventoryReceipt.findById.mockReturnValue({
      session: jest.fn().mockResolvedValue(receiptRecord),
    } as never);

    await expect(
      inventoryService.confirmReceipt(receiptRecord._id.toString()),
    ).rejects.toMatchObject({
      message: 'Only draft receipts can be confirmed',
      statusCode: 409,
    });

    expect(mockedInventoryImport.create).not.toHaveBeenCalled();
    expect(mockedInventory.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('updates only draft receipts and recalculates totals', async () => {
    const receiptRecord = {
      _id: new Types.ObjectId(),
      status: 'draft',
      receiptCode: 'PN00011',
      supplierName: '',
      note: '',
      importDate: new Date('2026-07-04T00:00:00.000Z'),
      lines: [],
      totalQuantity: 0,
      totalAmount: 0,
      save: jest.fn().mockImplementation(function save(this: unknown) {
        return Promise.resolve(this);
      }),
    };
    mockedInventoryReceipt.findById.mockResolvedValue(receiptRecord as never);

    const result = await inventoryService.updateReceipt(receiptRecord._id.toString(), {
      supplierName: 'Nhà cung cấp mới',
      lines: [
        {
          productId,
          variantId,
          colorVariantId,
          detail: [{ size: 'M', quantity: 8, importPrice: 50000 }],
        },
      ],
    });

    expect(result).toBe(receiptRecord);
    expect(receiptRecord.supplierName).toBe('Nhà cung cấp mới');
    expect(receiptRecord.totalQuantity).toBe(8);
    expect(receiptRecord.totalAmount).toBe(400000);
    expect(receiptRecord.save).toHaveBeenCalled();
  });

  it('rejects editing a confirmed receipt', async () => {
    const receiptRecord = {
      _id: new Types.ObjectId(),
      status: 'confirmed',
    };
    mockedInventoryReceipt.findById.mockResolvedValue(receiptRecord as never);

    await expect(
      inventoryService.updateReceipt(receiptRecord._id.toString(), {
        supplierName: 'Không hợp lệ',
      }),
    ).rejects.toMatchObject({
      message: 'Only draft receipts can be edited',
      statusCode: 409,
    });
  });

  it('cancels only draft receipts', async () => {
    const receiptRecord = {
      _id: new Types.ObjectId(),
      status: 'draft',
      cancelledAt: null,
      save: jest.fn().mockImplementation(function save(this: unknown) {
        return Promise.resolve(this);
      }),
    };
    mockedInventoryReceipt.findById.mockResolvedValue(receiptRecord as never);

    const result = await inventoryService.cancelReceipt(receiptRecord._id.toString());

    expect(result).toBe(receiptRecord);
    expect(receiptRecord.status).toBe('cancelled');
    expect(receiptRecord.cancelledAt).toBeInstanceOf(Date);
    expect(receiptRecord.save).toHaveBeenCalled();
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
    mockedInventory.findOneAndUpdate.mockResolvedValue({
      _id: new Types.ObjectId(),
      productId: importRecord.productId,
      variantId: importRecord.variantId,
      colorVariantId: importRecord.colorVariantId,
      size: 'M',
      sku: 'INV-M',
      quantity: 0,
      reservedQuantity: 0,
      availableQuantity: 0,
    } as never);

    const result = await inventoryService.deleteImport(importRecord._id.toString());

    expect(result).toBe(importRecord);
    expect(mockedInventory.countDocuments).not.toHaveBeenCalled();
    expect(mockedInventory.findOneAndUpdate).toHaveBeenCalledWith(
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
      {
        returnDocument: 'after',
        runValidators: true,
        session: mockSession,
      },
    );
    expect(mockedInventoryMovement.create).toHaveBeenCalled();
    expect(importRecord.deleteOne).toHaveBeenCalledWith({ session: mockSession });
    expect(mockSession.withTransaction).toHaveBeenCalledTimes(1);
    expect(mockSession.endSession).toHaveBeenCalledTimes(1);
  });

  it('rejects deleting an import lot generated from a receipt', async () => {
    const receiptId = new Types.ObjectId();
    const importRecord = {
      _id: new Types.ObjectId(),
      receiptId,
      productId: new Types.ObjectId(productId),
      variantId: new Types.ObjectId(variantId),
      colorVariantId: new Types.ObjectId(colorVariantId),
      detail: [{ size: 'M', quantity: 10, remainingQuantity: 10 }],
      deleteOne: jest.fn().mockResolvedValue(undefined),
    };

    mockedInventoryImport.findById.mockResolvedValue(importRecord as never);

    await expect(
      inventoryService.deleteImport(importRecord._id.toString()),
    ).rejects.toMatchObject({
      message: 'Cannot delete an import lot generated from a receipt',
      statusCode: 409,
    });

    expect(mockedInventory.updateOne).not.toHaveBeenCalled();
    expect(importRecord.deleteOne).not.toHaveBeenCalled();
  });

  it('aborts the delete transaction when a conditional stock decrement fails midway', async () => {
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
    mockedInventory.findOneAndUpdate
      .mockResolvedValueOnce({
        _id: new Types.ObjectId(),
        productId: importRecord.productId,
        variantId: importRecord.variantId,
        colorVariantId: importRecord.colorVariantId,
        size: 'M',
        sku: 'INV-M',
        quantity: 5,
        reservedQuantity: 0,
        availableQuantity: 5,
      } as never)
      .mockResolvedValueOnce(null);

    await expect(
      inventoryService.deleteImport(importRecord._id.toString()),
    ).rejects.toMatchObject({
      message: 'Cannot delete import because imported stock has been used or reserved',
      statusCode: 409,
    });

    expect(mockedInventory.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(importRecord.deleteOne).not.toHaveBeenCalled();
    expect(mockSession.withTransaction).toHaveBeenCalledTimes(1);
    expect(mockSession.endSession).toHaveBeenCalledTimes(1);
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
    mockedInventory.findOneAndUpdate.mockResolvedValue({
      _id: new Types.ObjectId(),
      productId: reservation.productId,
      variantId: reservation.variantId,
      colorVariantId: reservation.colorVariantId,
      size: 'M',
      sku: 'INV-M',
      quantity: 8,
      reservedQuantity: 0,
      availableQuantity: 8,
    } as never);
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
    mockedInventory.findOneAndUpdate.mockResolvedValue({
      _id: new Types.ObjectId(),
      productId: reservation.productId,
      variantId: reservation.variantId,
      colorVariantId: reservation.colorVariantId,
      size: 'M',
      sku: 'INV-M',
      quantity: 8,
      reservedQuantity: 0,
      availableQuantity: 8,
    } as never);
    mockedInventoryImport.find.mockReturnValue({ sort } as never);

    await inventoryService.commitReservations({
      reservationIds: [reservation._id.toString()],
    });

    expect(mockedInventory.findOneAndUpdate).toHaveBeenCalledWith(
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
      {
        returnDocument: 'after',
        runValidators: true,
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
      reason: 'Kiểm kê lệch',
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
        updatePipeline: true,
        session: mockSession,
      },
    );
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(mockedInventoryImport.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          supplierName: 'Điều chỉnh tồn kho',
          productId: previousInventory.productId,
          variantId: previousInventory.variantId,
          colorVariantId: previousInventory.colorVariantId,
          detail: [
            {
              size: 'M',
              quantity: 5,
              remainingQuantity: 5,
            },
          ],
          totalAmount: 0,
        }),
      ],
      { session: mockSession },
    );
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
      reason: 'Hàng lỗi',
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
        updatePipeline: true,
        session: mockSession,
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
        reason: 'Kiểm kê lệch',
      }),
    ).rejects.toMatchObject({
      message: 'quantity cannot be lower than reservedQuantity',
      statusCode: 400,
    });
  });
});
