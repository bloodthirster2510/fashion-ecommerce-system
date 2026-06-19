import type { Request, Response } from 'express';
import { error as errorResponse, ok } from '../../utils/response';
import { SalesServiceError } from '../sales/sales.helpers';
import { orderService } from '../orders/order.service';
import type { PreviewCheckoutInput } from '../orders/order.types';

const hasStatusCode = (value: unknown): value is { statusCode: number } => (
  typeof value === 'object' &&
  value !== null &&
  'statusCode' in value &&
  typeof value.statusCode === 'number'
);

const hasErrorCode = (value: unknown): value is { errorCode?: string; data?: Record<string, unknown> } => (
  typeof value === 'object' && value !== null
);

const getErrorResponse = (error: unknown) => {
  if (error instanceof SalesServiceError || hasStatusCode(error)) {
    return {
      statusCode: error.statusCode,
      message: error instanceof Error ? error.message : 'An error occurred',
      errorCode: hasErrorCode(error) ? error.errorCode : undefined,
      data: hasErrorCode(error) ? error.data : undefined,
    };
  }

  return {
    statusCode: 500,
    message: error instanceof Error ? error.message : 'An error occurred',
    errorCode: undefined,
    data: undefined,
  };
};

const getUserId = (req: Request) => req.user!.userId;

export const getShippingRates = async (req: Request, res: Response) => {
  try {
    const input = req.body as PreviewCheckoutInput;
    if (!input.cartItemIds?.length) {
      return errorResponse(res, 'cartItemIds are required', 400);
    }

    const preview = await orderService.previewCheckout(getUserId(req), input);
    return ok(res, {
      quoteVersion: preview.quoteVersion,
      shippingQuote: preview.shippingQuote,
      shippingComparison: preview.shippingComparison,
    }, 'So sánh phí vận chuyển thành công');
  } catch (error) {
    const { statusCode, message, errorCode, data } = getErrorResponse(error);
    return errorResponse(res, message, statusCode, { errorCode, data });
  }
};
