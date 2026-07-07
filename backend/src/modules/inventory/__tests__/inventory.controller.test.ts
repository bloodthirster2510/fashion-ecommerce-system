import type { Request, Response } from 'express';
import { createReceipt, getInventory, getInventoryProducts } from '../inventory.controller';
import { productService } from '../../catalog/products/product.service';
import { InventoryServiceError, inventoryService } from '../inventory.service';

jest.mock('../inventory.service', () => ({
  InventoryServiceError: class InventoryServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
      this.name = 'InventoryServiceError';
    }
  },
  inventoryService: {
    createReceipt: jest.fn(),
    getInventory: jest.fn(),
  },
}));

jest.mock('../../catalog/products/product.service', () => ({
  productService: {
    getManagementProducts: jest.fn(),
  },
}));

const mockedInventoryService = inventoryService as jest.Mocked<typeof inventoryService>;
const mockedProductService = productService as jest.Mocked<typeof productService>;

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  } as unknown as Response;

  return res;
};

const createRequest = (query: Request['query'] = {}) => ({
  query,
}) as Request;

const createReceiptRequest = () => ({
  body: {
    receiptCode: 'PN00012',
    importDate: '2026-07-04',
    lines: [],
  },
  user: {
    userId: '665000000000000000000020',
    email: 'admin@example.com',
    role: 'admin',
  },
}) as Request;

describe('inventory controller error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not expose raw internal errors to the client', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockedInventoryService.getInventory.mockRejectedValue(new Error('MongoServerError: auth failed'));
    const res = createResponse();

    await getInventory(createRequest(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal Server Error' });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Inventory controller error:', expect.any(Error));
  });

  it('still returns safe service validation messages', async () => {
    mockedInventoryService.getInventory.mockRejectedValue(
      new InventoryServiceError('Invalid productId', 400),
    );
    const res = createResponse();

    await getInventory(createRequest(), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid productId' });
  });

  it('passes authenticated user and parsed import date when creating a receipt', async () => {
    const receipt = { _id: 'receipt-id', receiptCode: 'PN00012' };
    mockedInventoryService.createReceipt.mockResolvedValue(receipt as never);
    const res = createResponse();

    await createReceipt(createReceiptRequest(), res);

    expect(mockedInventoryService.createReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        receiptCode: 'PN00012',
        importDate: expect.any(Date),
      }),
      '665000000000000000000020',
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Created',
      data: receipt,
    });
  });

  it('loads products through the inventory controller', async () => {
    const products = [{ _id: 'product-id', name: 'Áo sơ mi' }];
    mockedProductService.getManagementProducts.mockResolvedValue(products as never);
    const res = createResponse();

    await getInventoryProducts(createRequest(), res);

    expect(mockedProductService.getManagementProducts).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Success',
      data: products,
    });
  });
});
