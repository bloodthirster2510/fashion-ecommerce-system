import type { Request, Response } from 'express';
import { SalesServiceError } from '../../sales/sales.helpers';
import { getCart } from '../cart.controller';
import { cartService } from '../cart.service';

jest.mock('../cart.service', () => ({
  cartService: {
    getCart: jest.fn(),
  },
}));

const mockedCartService = cartService as jest.Mocked<typeof cartService>;

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  } as unknown as Response;

  return res;
};

const createRequest = () => ({
  user: {
    userId: '665000000000000000000020',
    email: 'customer@example.com',
    role: 'user',
  },
}) as Request;

describe('cart controller error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not expose raw internal errors to the client', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockedCartService.getCart.mockRejectedValue(new Error('database timeout: replica credentials unavailable'));
    const res = createResponse();

    await getCart(createRequest(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal Server Error' });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Cart controller error:', expect.any(Error));
  });

  it('still returns safe service validation messages', async () => {
    mockedCartService.getCart.mockRejectedValue(new SalesServiceError('Cart not found', 404));
    const res = createResponse();

    await getCart(createRequest(), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Cart not found' });
  });
});
