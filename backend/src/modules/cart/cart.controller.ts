import type { Request, Response } from 'express';
import { error as errorResponse, ok } from '../../utils/response';
import { SalesServiceError } from '../sales/sales.helpers';
import { cartService } from './cart.service';
import type {
  AddCartItemInput,
  SelectAllCartItemsInput,
  SelectCartItemInput,
  UpdateCartItemInput,
} from './cart.types';

const hasStatusCode = (value: unknown): value is { statusCode: number } => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'statusCode' in value &&
    typeof value.statusCode === 'number'
  );
};

const getErrorResponse = (e: unknown) => {
  if (e instanceof SalesServiceError || hasStatusCode(e)) {
    if (e.statusCode >= 500) {
      console.error('Cart controller error:', e);
      return {
        statusCode: e.statusCode,
        message: 'Internal Server Error',
      };
    }

    return {
      statusCode: e.statusCode,
      message: e instanceof Error ? e.message : 'An error occurred',
    };
  }

  console.error('Cart controller error:', e);
  return {
    statusCode: 500,
    message: 'Internal Server Error',
  };
};

const getUserId = (req: Request) => req.user!.userId;

const getCart = async (req: Request, res: Response) => {
  try {
    const cart = await cartService.getCart(getUserId(req));
    return ok(res, cart);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const addCartItem = async (req: Request, res: Response) => {
  try {
    const input = req.body as AddCartItemInput;

    if (!input.productId || !input.variantId || !input.colorVariantId || !input.size || input.quantity === undefined) {
      return errorResponse(res, 'productId, variantId, colorVariantId, size, and quantity are required', 400);
    }

    const cart = await cartService.addCartItem(getUserId(req), input);
    return ok(res, cart);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const updateCartItem = async (req: Request, res: Response) => {
  try {
    const input = req.body as UpdateCartItemInput;

    if (input.quantity === undefined && input.size === undefined) {
      return errorResponse(res, 'quantity or size is required', 400);
    }

    const cart = await cartService.updateCartItem(getUserId(req), req.params.itemId as string, input);
    return ok(res, cart);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const selectCartItem = async (req: Request, res: Response) => {
  try {
    const input = req.body as SelectCartItemInput;

    if (typeof input.isSelected !== 'boolean') {
      return errorResponse(res, 'isSelected must be a boolean', 400);
    }

    const cart = await cartService.selectCartItem(getUserId(req), req.params.itemId as string, input);
    return ok(res, cart);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const selectAllCartItems = async (req: Request, res: Response) => {
  try {
    const input = req.body as SelectAllCartItemsInput;

    if (typeof input.isSelected !== 'boolean') {
      return errorResponse(res, 'isSelected must be a boolean', 400);
    }

    const cart = await cartService.selectAllCartItems(getUserId(req), input);
    return ok(res, cart);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

const deleteCartItem = async (req: Request, res: Response) => {
  try {
    const cart = await cartService.deleteCartItem(getUserId(req), req.params.itemId as string);
    return ok(res, cart);
  } catch (e: unknown) {
    const { statusCode, message } = getErrorResponse(e);
    return errorResponse(res, message, statusCode);
  }
};

export {
  addCartItem,
  deleteCartItem,
  getCart,
  selectAllCartItems,
  selectCartItem,
  updateCartItem,
};
