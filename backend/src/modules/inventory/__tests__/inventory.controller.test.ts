import type { Request, Response } from 'express';
import { getInventory } from '../inventory.controller';
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
    getInventory: jest.fn(),
  },
}));

const mockedInventoryService = inventoryService as jest.Mocked<typeof inventoryService>;

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
});
