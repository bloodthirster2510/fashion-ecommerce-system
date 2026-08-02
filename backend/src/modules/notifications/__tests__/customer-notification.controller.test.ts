import type { Request, Response } from 'express';
import { pushNotificationService } from '../push-notification.service';
import { unregisterMyPushToken } from '../customer-notification.controller';

jest.mock('../push-notification.service', () => ({
  pushNotificationService: {
    registerPushToken: jest.fn(),
    unregisterPushToken: jest.fn(),
  },
}));

type MockResponse = Response & {
  status: jest.Mock;
  json: jest.Mock;
};

const createResponse = () => {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
  } as unknown as MockResponse;
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response;
};

describe('customer notification controller', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns a validation response for a malformed token during unregister', async () => {
    const request = {
      user: { userId: '665000000000000000000001', role: 'user' },
      body: { token: '' },
    } as unknown as Request;
    const response = createResponse();
    (pushNotificationService.unregisterPushToken as jest.Mock).mockRejectedValue(
      Object.assign(new Error('Invalid Expo push token'), { statusCode: 400 }),
    );

    await unregisterMyPushToken(request, response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: 'Invalid Expo push token' });
  });
});
