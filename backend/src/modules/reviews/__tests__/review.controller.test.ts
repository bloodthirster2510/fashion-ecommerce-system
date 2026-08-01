import type { Request, Response } from 'express';
import {
  createReview,
  listAdminReviews,
  listProductReviews,
  updateModerationStatus,
  updateReview,
} from '../review.controller';
import { reviewService } from '../review.service';

type MockResponse = Response & {
  status: jest.Mock;
  json: jest.Mock;
};

const createResponse = () => {
  // Response mock tối thiểu nhưng vẫn chain được res.status(...).json(...).
  const response = {
    status: jest.fn(),
    json: jest.fn(),
  } as unknown as MockResponse;
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response;
};

describe('review controller validation', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('returns 400 instead of 500 when create body is null', async () => {
    const response = createResponse();
    const request = { body: null } as unknown as Request;
    const createSpy = jest.spyOn(reviewService, 'createReview');

    await createReview(request, response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: 'Request body must be an object' });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('returns 400 instead of 500 when update body is null', async () => {
    const response = createResponse();
    const request = { body: null } as unknown as Request;
    const updateSpy = jest.spyOn(reviewService, 'updateReview');

    await updateReview(request, response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: 'Request body must be an object' });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('rejects review comments shorter than 10 characters', async () => {
    const response = createResponse();
    const request = {
      body: {
        orderId: '665000000000000000000001',
        orderItemId: '665000000000000000000002',
        rating: 5,
        comment: 'Quá ổn',
      },
      user: { userId: '665000000000000000000003', role: 'user' },
    } as unknown as Request;
    const createSpy = jest.spyOn(reviewService, 'createReview');

    await createReview(request, response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      message: 'comment must contain between 10 and 2000 characters',
    });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('passes moderation actor and rejects hiding without a reason', async () => {
    const response = createResponse();
    const request = {
      params: { id: '665000000000000000000001' },
      body: { status: 'hidden' },
      user: { userId: '665000000000000000000002', role: 'staff' },
    } as unknown as Request;
    const updateSpy = jest.spyOn(reviewService, 'updateModerationStatus');

    await updateModerationStatus(request, response);

    expect(updateSpy).toHaveBeenCalledWith(
      '665000000000000000000001',
      'hidden',
      { userId: '665000000000000000000002', role: 'staff' },
      undefined,
    );
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it('rejects invalid hasImages values', async () => {
    const response = createResponse();
    const request = { query: { hasImages: 'sometimes' } } as unknown as Request;
    const listSpy = jest.spyOn(reviewService, 'listAdminReviews');

    await listAdminReviews(request, response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: 'hasImages must be true or false' });
    expect(listSpy).not.toHaveBeenCalled();
  });

  it('parses a valid false hasImages value', async () => {
    const response = createResponse();
    const request = { query: { hasImages: 'false' } } as unknown as Request;
    const listSpy = jest.spyOn(reviewService, 'listAdminReviews').mockResolvedValue({} as never);

    await listAdminReviews(request, response);

    expect(listSpy).toHaveBeenCalledWith(expect.objectContaining({ hasImages: false }));
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it('passes an optional customer identity when listing public product reviews', async () => {
    const response = createResponse();
    const request = {
      params: { productId: '665000000000000000000001' },
      query: {},
      user: { userId: '665000000000000000000002', role: 'user' },
    } as unknown as Request;
    const listSpy = jest.spyOn(reviewService, 'listProductReviews').mockResolvedValue({} as never);

    await listProductReviews(request, response);

    expect(listSpy).toHaveBeenCalledWith(
      '665000000000000000000001',
      expect.any(Object),
      '665000000000000000000002',
    );
    expect(response.status).toHaveBeenCalledWith(200);
  });
});
