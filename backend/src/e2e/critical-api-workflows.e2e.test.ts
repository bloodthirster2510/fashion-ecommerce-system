import axios from 'axios';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { io, type Socket } from 'socket.io-client';
import {
  Category,
  Inventory,
  Order,
  Product,
  User,
  VirtualTryOnJob,
} from '../database/models';
import { GHNService } from '../modules/shipping/ghn.service';
import * as vnpayService from '../modules/payments/payments.service';
import { createVNPaySecureHash } from '../utils/vnpay.util';
import {
  startApiE2EHarness,
  type ApiE2EHarness,
  type ApiEnvelope,
} from './e2e-harness';

let mockCloudinaryUploadIndex = 0;

jest.mock('../utils/cloudinary.util', () => {
  const actual = jest.requireActual('../utils/cloudinary.util');
  return {
    ...actual,
    uploadToCloudinary: jest.fn(async (
      buffer: Buffer,
      fileName: string,
      _folder: string,
      resourceType = 'image',
    ) => {
      mockCloudinaryUploadIndex += 1;
      const extension = resourceType === 'video' ? 'mp4' : 'png';
      return {
        public_id: `e2e/asset-${mockCloudinaryUploadIndex}`,
        secure_url: `https://cdn.example.com/e2e/asset-${mockCloudinaryUploadIndex}.${extension}`,
        width: 768,
        height: 1024,
        bytes: buffer.byteLength,
        format: extension,
        original_filename: fileName,
        resource_type: resourceType,
      };
    }),
    deleteFromCloudinary: jest.fn(async () => undefined),
  };
});

type Session = {
  accessToken: string;
  user: { _id: string; email: string; role: string };
};

type CartView = {
  product_list: Array<{ _id: string }>;
};

type CheckoutPreview = {
  quoteVersion: string;
  shippingComparison: {
    comparisonStatus: string;
    selectedOptionKey: string | null;
  };
};

type OrderView = {
  _id: string;
  orderCode: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalAmount: number;
  shipping?: {
    provider?: string | null;
    status?: string | null;
    trackingCode?: string | null;
  } | null;
};

type TryOnJobView = {
  _id: string;
  status: string;
  outputMode: string;
  generatedImageUrls?: string[];
  generatedVideoUrl?: string | null;
  videoStatus?: string;
};

type SupportRealtimeEvent = {
  type: string;
  ticketId?: string;
  scope?: string;
  message?: {
    body?: string;
    senderType?: string;
  };
};

const password = 'E2ePassword!123';
const customerEmail = 'api-e2e-customer@example.com';
const adminEmail = 'api-e2e-admin@example.com';
const productId = new Types.ObjectId();
const categoryId = new Types.ObjectId();
const fitTypeId = new Types.ObjectId();
const variantId = new Types.ObjectId();
const colorVariantId = new Types.ObjectId();
const shippingAddress = {
  customerName: 'API E2E Customer',
  province: 'Thành phố Hồ Chí Minh',
  provinceCode: '79',
  district: 'Quận 1',
  districtId: 760,
  ward: 'Phường Bến Nghé',
  wardCode: '26734',
  streetName: '123 Nguyễn Huệ',
  phoneNumber: '0343149694',
  ghnProvinceId: 202,
  ghnDistrictId: 1442,
  ghnWardCode: '20101',
  ghnMappingStatus: 'mapped',
  ghnMappingConfidence: 'manual',
  ghnMappingVerifiedAt: '2026-07-29T00:00:00.000Z',
};

const expectStatus = <T>(
  result: { response: Response; payload: ApiEnvelope<T> },
  expectedStatus: number,
) => {
  if (result.response.status !== expectedStatus) {
    throw new Error(
      `Expected HTTP ${expectedStatus}, received ${result.response.status}: ${JSON.stringify(result.payload)}`,
    );
  }
  return result.payload.data;
};

const seedAccountsAndCatalog = async () => {
  const hashedPassword = await bcrypt.hash(password, 4);
  await User.create([
    {
      name: 'API E2E Customer',
      email: customerEmail,
      password: hashedPassword,
      role: 'user',
      phone: '0343149694',
      gender: 'female',
      dateOfBirth: new Date('1995-01-01'),
      address: [{ ...shippingAddress, isDefault: true }],
      mustChangePassword: false,
      isActive: true,
    },
    {
      name: 'API E2E Admin',
      email: adminEmail,
      password: hashedPassword,
      role: 'admin',
      phone: '0900000001',
      gender: 'male',
      dateOfBirth: new Date('1990-01-01'),
      address: [{
        ...shippingAddress,
        customerName: 'API E2E Admin',
        phoneNumber: '0900000001',
        isDefault: true,
      }],
      mustChangePassword: false,
      isActive: true,
    },
  ]);
  await Category.create({
    _id: categoryId,
    name: 'API E2E Tops',
    level: 1,
    gender: 'female',
    image: 'https://example.com/e2e-category.jpg',
    description: 'Catalog fixture for real HTTP workflow tests',
    isLeaf: true,
    sizes: ['M'],
    measurementFields: [
      { key: 'bust', label: 'Bust', unit: 'cm', required: true, sortOrder: 0 },
    ],
    fitTypes: [
      { _id: fitTypeId, key: 'regular', label: 'Regular', sortOrder: 0, isActive: true },
    ],
    isActive: true,
  });
  await Product.create({
    _id: productId,
    category_id: categoryId,
    brand_id: new Types.ObjectId(),
    name: 'API E2E Top',
    description: 'Product used by API-backed checkout and virtual try-on tests',
    product_image: 'https://example.com/e2e-top.jpg',
    isActive: true,
    variant: [{
      _id: variantId,
      fitTypeId,
      price: 200_000,
      discount: 0,
      sizeMeasurements: [{ size: 'M', measurements: [{ key: 'bust', value: 90 }] }],
      colors: [{
        _id: colorVariantId,
        color: 'Black',
        colorCode: '#000000',
        image: 'https://example.com/e2e-top-black.jpg',
      }],
      isActive: true,
    }],
  });
  await Inventory.create({
    productId,
    variantId,
    colorVariantId,
    size: 'M',
    sku: 'API-E2E-TOP-BLACK-M',
    quantity: 20,
    reservedQuantity: 0,
    availableQuantity: 20,
  });
};

const login = async (harness: ApiE2EHarness, email: string, admin = false) => {
  const result = await harness.request<Session>(
    `/api/auth/${admin ? 'admin/' : ''}login`,
    { method: 'POST', body: { identifier: email, password } },
  );
  return expectStatus(result, 200);
};

const addCartItem = async (harness: ApiE2EHarness, token: string) => {
  const result = await harness.request<CartView>('/api/cart/items', {
    method: 'POST',
    token,
    body: {
      productId: productId.toString(),
      variantId: variantId.toString(),
      colorVariantId: colorVariantId.toString(),
      size: 'M',
      quantity: 1,
      isSelected: true,
    },
  });
  const cart = expectStatus(result, 200);
  const item = cart.product_list[cart.product_list.length - 1];
  if (!item) throw new Error('Cart API did not return the added item');
  return item._id;
};

const previewCheckout = async (
  harness: ApiE2EHarness,
  token: string,
  cartItemId: string,
  paymentMethod: 'COD' | 'VNPAY',
) => {
  const result = await harness.request<CheckoutPreview>('/api/orders/preview', {
    method: 'POST',
    token,
    body: {
      cartItemIds: [cartItemId],
      shippingAddress,
      paymentMethod,
    },
  });
  return expectStatus(result, 200);
};

const createOrder = async (
  harness: ApiE2EHarness,
  token: string,
  cartItemId: string,
  paymentMethod: 'COD' | 'VNPAY',
  quoteVersion: string,
) => {
  const result = await harness.request<OrderView>('/api/orders', {
    method: 'POST',
    token,
    headers: { 'Idempotency-Key': `e2e-${paymentMethod.toLowerCase()}-${Date.now()}` },
    body: {
      cartItemIds: [cartItemId],
      shippingAddress,
      paymentMethod,
      quoteVersion,
    },
  });
  return expectStatus(result, 201);
};

const waitForSocketEvent = (
  socket: Socket,
  predicate: (event: SupportRealtimeEvent) => boolean,
  timeoutMs = 8_000,
) => new Promise<SupportRealtimeEvent>((resolve, reject) => {
  const timeout = setTimeout(() => {
    socket.off('ticket:event', handler);
    reject(new Error('Timed out waiting for support realtime event'));
  }, timeoutMs);
  const handler = (event: SupportRealtimeEvent) => {
    if (!predicate(event)) return;
    clearTimeout(timeout);
    socket.off('ticket:event', handler);
    resolve(event);
  };
  socket.on('ticket:event', handler);
});

const connectSupportSocket = (
  baseUrl: string,
  token: string,
) => new Promise<Socket>((resolve, reject) => {
  const socket = io(baseUrl, {
    path: '/realtime/support',
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
  });
  const timeout = setTimeout(() => {
    socket.disconnect();
    reject(new Error('Timed out connecting to support realtime gateway'));
  }, 8_000);
  socket.once('connect', () => {
    clearTimeout(timeout);
    resolve(socket);
  });
  socket.once('connect_error', (error) => {
    clearTimeout(timeout);
    socket.disconnect();
    reject(error);
  });
});

const waitForTryOnJob = async (
  harness: ApiE2EHarness,
  token: string,
  jobId: string,
  predicate: (job: TryOnJobView) => boolean,
) => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const result = await harness.request<TryOnJobView>(`/api/virtual-try-on/jobs/${jobId}`, { token });
    const job = expectStatus(result, 200);
    if (predicate(job)) return job;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for virtual try-on job ${jobId}`);
};

describe('critical API-backed workflows', () => {
  let harness: ApiE2EHarness;
  let customer: Session;
  let admin: Session;

  beforeAll(async () => {
    harness = await startApiE2EHarness();
    await seedAccountsAndCatalog();
    customer = await login(harness, customerEmail);
    admin = await login(harness, adminEmail, true);
  });

  afterAll(async () => {
    await harness.stop();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs login, cart, checkout, admin lifecycle, and customer tracking through HTTP', async () => {
    jest.spyOn(GHNService, 'getAvailableServices').mockResolvedValue({
      data: [{ service_id: 53321, service_type_id: 2, short_name: 'Standard' }],
    });
    jest.spyOn(GHNService, 'calculateShippingFee').mockResolvedValue({
      data: { total: 31_000, expected_delivery_time: '2026-08-02T10:00:00.000Z' },
    });

    const cartItemId = await addCartItem(harness, customer.accessToken);
    const preview = await previewCheckout(harness, customer.accessToken, cartItemId, 'COD');
    const order = await createOrder(
      harness,
      customer.accessToken,
      cartItemId,
      'COD',
      preview.quoteVersion,
    );

    expect(order).toMatchObject({ status: 'confirmed', paymentStatus: 'pending', paymentMethod: 'COD' });
    for (const status of ['packed', 'shipping', 'delivered']) {
      const updated = await harness.request<OrderView>(`/api/admin/orders/${order._id}/status`, {
        method: 'PATCH',
        token: admin.accessToken,
        body: { status, reason: `API E2E transition to ${status}` },
      });
      expectStatus(updated, 200);
    }

    const tracked = await harness.request<OrderView>(`/api/orders/${order._id}`, {
      token: customer.accessToken,
    });
    expect(expectStatus(tracked, 200)).toMatchObject({
      status: 'delivered',
      paymentStatus: 'paid',
    });
  });

  it('runs VNPay create/IPN/reconcile/refund and GHN quote/create/sync/cancel through HTTP', async () => {
    jest.spyOn(GHNService, 'getAvailableServices').mockResolvedValue({
      data: [{ service_id: 53321, service_type_id: 2, short_name: 'Standard' }],
    });
    jest.spyOn(GHNService, 'calculateShippingFee').mockResolvedValue({
      data: { total: 29_000, expected_delivery_time: '2026-08-03T10:00:00.000Z' },
    });
    jest.spyOn(GHNService, 'createShippingOrder').mockResolvedValue({
      data: {
        order_code: 'E2E-GHN-0001',
        total_fee: 29_000,
        expected_delivery_time: '2026-08-03T10:00:00.000Z',
      },
    });
    jest.spyOn(GHNService, 'getOrderDetail').mockResolvedValue({
      data: {
        order_code: 'E2E-GHN-0001',
        status: 'picking',
      },
    });
    jest.spyOn(GHNService, 'cancelOrder').mockResolvedValue({
      data: [{ order_code: 'E2E-GHN-0001', result: true }],
    });

    const cartItemId = await addCartItem(harness, customer.accessToken);
    const rates = await harness.request<{
      quoteVersion: string;
      shippingComparison: CheckoutPreview['shippingComparison'];
    }>('/api/shipping/rates', {
      method: 'POST',
      token: customer.accessToken,
      body: { cartItemIds: [cartItemId], shippingAddress, paymentMethod: 'VNPAY' },
    });
    const rateData = expectStatus(rates, 200);
    expect(rateData.shippingComparison.comparisonStatus).toBe('live');

    const order = await createOrder(
      harness,
      customer.accessToken,
      cartItemId,
      'VNPAY',
      rateData.quoteVersion,
    );
    const paymentRequest = await harness.request<{
      paymentUrl: string;
      txnRef: string;
      amount: number;
    }>(`/api/payments/vnpay/orders/${order._id}/create-payment-url`, {
      method: 'POST',
      token: customer.accessToken,
      body: { locale: 'vn' },
    });
    const payment = expectStatus(paymentRequest, 200);
    expect(payment.paymentUrl).toContain('vnp_SecureHash=');

    const ipnParams: Record<string, string> = {
      vnp_TxnRef: payment.txnRef,
      vnp_Amount: String(payment.amount * 100),
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionNo: 'E2E-VNPAY-0001',
      vnp_BankCode: 'NCB',
      vnp_PayDate: '20260729120000',
    };
    ipnParams.vnp_SecureHash = createVNPaySecureHash(
      ipnParams,
      process.env.VNPAY_HASH_SECRET!,
    );
    const ipn = await harness.request<never>(
      `/api/payments/vnpay/ipn?${new URLSearchParams(ipnParams).toString()}`,
    );
    expect(ipn.response.status).toBe(200);
    expect(ipn.payload).toMatchObject({ RspCode: '00' });

    jest.spyOn(vnpayService, 'queryVNPayTransaction').mockResolvedValue({
      isValidSignature: true,
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionType: '01',
      vnp_TxnRef: payment.txnRef,
      vnp_Amount: String(payment.amount * 100),
      vnp_TransactionNo: 'E2E-VNPAY-0001',
      vnp_BankCode: 'NCB',
      vnp_PayDate: '20260729120000',
    });
    const reconciliation = await harness.request<{ reconciliationStatus: string }>(
      `/api/admin/payments/orders/${order._id}/vnpay/reconcile`,
      { method: 'POST', token: admin.accessToken },
    );
    expect(expectStatus(reconciliation, 200).reconciliationStatus).toBe('paid');

    const mapped = await harness.request<OrderView>(`/api/admin/orders/${order._id}/ghn-mapping`, {
      method: 'PATCH',
      token: admin.accessToken,
      body: {
        ghnProvinceId: 202,
        ghnDistrictId: 1442,
        ghnWardCode: '20101',
        confidence: 'manual',
        note: 'API E2E verified mapping',
        applyToFutureAddresses: false,
      },
    });
    expectStatus(mapped, 200);
    const packed = await harness.request<OrderView>(`/api/admin/orders/${order._id}/status`, {
      method: 'PATCH',
      token: admin.accessToken,
      body: { status: 'packed', reason: 'API E2E ready for GHN' },
    });
    expectStatus(packed, 200);

    const shipment = await harness.request<OrderView>(
      `/api/admin/orders/${order._id}/ghn-shipment`,
      { method: 'POST', token: admin.accessToken },
    );
    expect(expectStatus(shipment, 200).shipping).toMatchObject({
      provider: 'GHN',
      status: 'ready',
      trackingCode: 'E2E-GHN-0001',
    });
    const synced = await harness.request<OrderView>(
      `/api/admin/orders/${order._id}/ghn-shipment/sync`,
      { method: 'POST', token: admin.accessToken },
    );
    expect(expectStatus(synced, 200).shipping?.status).toBe('picking');
    const canceledShipment = await harness.request<OrderView>(
      `/api/admin/orders/${order._id}/ghn-shipment/cancel`,
      {
        method: 'POST',
        token: admin.accessToken,
        body: { reason: 'API E2E cancellation before handoff' },
      },
    );
    expect(expectStatus(canceledShipment, 200).shipping?.status).toBe('cancelled');

    const canceledOrder = await harness.request<OrderView>(`/api/admin/orders/${order._id}/status`, {
      method: 'PATCH',
      token: admin.accessToken,
      body: { status: 'cancelled', reason: 'API E2E customer cancellation' },
    });
    expect(expectStatus(canceledOrder, 200).status).toBe('cancelled');

    jest.spyOn(vnpayService, 'refundVNPayTransaction').mockResolvedValue({
      isValidSignature: true,
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionType: '02',
      vnp_TxnRef: payment.txnRef,
      vnp_Amount: String(payment.amount * 100),
      vnp_TransactionNo: 'E2E-VNPAY-REFUND-0001',
    });
    const refund = await harness.request<{
      refundStatus: string;
      order: OrderView;
    }>(`/api/admin/payments/orders/${order._id}/vnpay/refund`, {
      method: 'POST',
      token: admin.accessToken,
      body: { reason: 'API E2E full refund after cancellation' },
    });
    const refundData = expectStatus(refund, 200);
    expect(refundData).toMatchObject({
      refundStatus: 'completed',
      order: { paymentStatus: 'refunded' },
    });
    expect(await Order.findById(order._id).lean()).toMatchObject({
      status: 'cancelled',
      paymentStatus: 'refunded',
    });
  });

  it('delivers customer and admin support messages through HTTP plus the realtime gateway', async () => {
    const [customerSocket, adminSocket] = await Promise.all([
      connectSupportSocket(harness.baseUrl, customer.accessToken),
      connectSupportSocket(harness.baseUrl, admin.accessToken),
    ]);

    try {
      const adminEventPromise = waitForSocketEvent(
        adminSocket,
        (event) => event.type === 'message'
          && event.scope === 'admin'
          && event.message?.body === 'Ứng dụng không cập nhật trạng thái đơn hàng.',
      );
      const createdTicket = await harness.request<{
        ticket: { _id: string };
      }>('/api/support/tickets', {
        method: 'POST',
        token: customer.accessToken,
        body: {
          type: 'issue',
          category: 'app_website',
          subject: 'Không thấy trạng thái đơn hàng',
          body: 'Ứng dụng không cập nhật trạng thái đơn hàng.',
          requiresReply: true,
          context: {
            source: 'support_home',
            appPlatform: 'android',
            screen: 'OrderDetail',
          },
        },
      });
      const ticket = expectStatus(createdTicket, 201).ticket;
      expect(await adminEventPromise).toMatchObject({ ticketId: ticket._id, scope: 'admin' });

      const customerEventPromise = waitForSocketEvent(
        customerSocket,
        (event) => event.type === 'message'
          && event.scope === 'customer'
          && event.message?.body === 'Shop đã kiểm tra và đồng bộ lại trạng thái cho bạn.',
      );
      const reply = await harness.request<Record<string, unknown>>(
        `/api/admin/support/tickets/${ticket._id}/messages`,
        {
          method: 'POST',
          token: admin.accessToken,
          body: {
            body: 'Shop đã kiểm tra và đồng bộ lại trạng thái cho bạn.',
            isInternal: false,
          },
        },
      );
      expectStatus(reply, 201);
      expect(await customerEventPromise).toMatchObject({
        ticketId: ticket._id,
        scope: 'customer',
        message: { senderType: 'staff' },
      });
    } finally {
      customerSocket.disconnect();
      adminSocket.disconnect();
    }
  });

  it('runs upload, validation, image/video generation, and partial retries through HTTP', async () => {
    mockCloudinaryUploadIndex = 0;
    jest.spyOn(axios, 'get').mockResolvedValue({
      data: Buffer.from('e2e-source-image'),
      headers: { 'content-type': 'image/png' },
    });

    const form = new FormData();
    form.set('source', 'upload');
    form.set(
      'image',
      new Blob([
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nGQAAAAASUVORK5CYII=',
          'base64',
        ),
      ], { type: 'image/png' }),
      'e2e-source.png',
    );
    const uploaded = await harness.request<{ _id: string }>('/api/virtual-try-on/assets', {
      method: 'POST',
      token: customer.accessToken,
      body: form,
    });
    const sourceAsset = expectStatus(uploaded, 201);

    const validation = await harness.request<{ allowed: boolean }>(
      `/api/virtual-try-on/assets/${sourceAsset._id}/validate`,
      {
        method: 'POST',
        token: customer.accessToken,
        body: { outfitMode: 'single', selectedItems: [{ role: 'top' }] },
      },
    );
    expect(expectStatus(validation, 200).allowed).toBe(true);

    const jobInput = {
      sourceAssetId: sourceAsset._id,
      outfitMode: 'single',
      selectedItems: [{
        productId: productId.toString(),
        variantId: variantId.toString(),
        colorVariantId: colorVariantId.toString(),
        size: 'M',
        role: 'top',
      }],
      contextPreset: 'none',
    };
    const imageJobResponse = await harness.request<TryOnJobView>('/api/virtual-try-on/jobs', {
      method: 'POST',
      token: customer.accessToken,
      body: { ...jobInput, outputMode: 'image' },
    });
    const imageJob = expectStatus(imageJobResponse, 201);
    const completedImageJob = await waitForTryOnJob(
      harness,
      customer.accessToken,
      imageJob._id,
      (job) => job.status === 'succeeded',
    );
    expect(completedImageJob.generatedImageUrls?.length).toBeGreaterThan(0);

    const videoJobResponse = await harness.request<TryOnJobView>('/api/virtual-try-on/jobs', {
      method: 'POST',
      token: customer.accessToken,
      body: { ...jobInput, outputMode: 'image_and_video', videoDurationSeconds: 5 },
    });
    const videoJob = expectStatus(videoJobResponse, 201);
    const completedVideoJob = await waitForTryOnJob(
      harness,
      customer.accessToken,
      videoJob._id,
      (job) => job.status === 'succeeded' && job.videoStatus === 'succeeded',
    );
    expect(completedVideoJob).toMatchObject({
      status: 'succeeded',
      videoStatus: 'succeeded',
      generatedVideoUrl: process.env.VIRTUAL_TRY_ON_MOCK_VIDEO_URL,
    });

    await VirtualTryOnJob.updateOne(
      { _id: imageJob._id },
      {
        $set: {
          status: 'failed',
          errorCode: 'PROVIDER_FAILED',
          errorMessage: 'Seeded retryable image failure',
        },
      },
    );
    const retriedImage = await harness.request<TryOnJobView>(
      `/api/virtual-try-on/jobs/${imageJob._id}/retry`,
      { method: 'POST', token: customer.accessToken },
    );
    expect(expectStatus(retriedImage, 200).status).toBe('queued');
    await waitForTryOnJob(
      harness,
      customer.accessToken,
      imageJob._id,
      (job) => job.status === 'succeeded',
    );

    await VirtualTryOnJob.updateOne(
      { _id: videoJob._id },
      {
        $set: {
          videoStatus: 'failed',
          videoErrorCode: 'VIDEO_PROVIDER_FAILED',
          videoErrorMessage: 'Seeded retryable video failure',
          generatedVideoUrl: null,
        },
      },
    );
    const retriedVideo = await harness.request<TryOnJobView>(
      `/api/virtual-try-on/jobs/${videoJob._id}/video/retry`,
      { method: 'POST', token: customer.accessToken },
    );
    expect(expectStatus(retriedVideo, 200).videoStatus).toBe('queued');
    await waitForTryOnJob(
      harness,
      customer.accessToken,
      videoJob._id,
      (job) => job.videoStatus === 'succeeded',
    );
  });
});
