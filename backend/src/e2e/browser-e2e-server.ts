import './e2e.setup';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import app from '../app';
import { Order, User } from '../database/models';
import { startApiE2EHarness, type ApiE2EHarness } from './e2e-harness';

const apiPort = Number(process.env.BROWSER_E2E_API_PORT ?? 5001);
const adminEmail = 'browser.e2e.admin@fashion.test';
const customerEmail = 'browser.e2e.customer@fashion.test';
const password = 'BrowserE2E123!';
const orderCode = 'FS-BROWSER-E2E';
const shippingAddress = {
  customerName: 'Browser E2E Customer',
  province: 'Hồ Chí Minh',
  district: 'Quận 1',
  ward: 'Bến Nghé',
  wardCode: '26734',
  streetName: '1 Đồng Khởi',
  phoneNumber: '0343149694',
};

const seedBrowserFixtures = async () => {
  const hashedPassword = await bcrypt.hash(password, 4);
  const [customer] = await User.create([
    {
      name: 'Browser E2E Customer',
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
      name: 'Browser E2E Admin',
      email: adminEmail,
      password: hashedPassword,
      role: 'admin',
      phone: '0900000001',
      gender: 'male',
      dateOfBirth: new Date('1990-01-01'),
      address: [{
        ...shippingAddress,
        customerName: 'Browser E2E Admin',
        phoneNumber: '0900000001',
        isDefault: true,
      }],
      mustChangePassword: false,
      isActive: true,
    },
  ]);

  await Order.create({
    orderCode,
    user_id: customer._id,
    order_list: [{
      productId: new Types.ObjectId(),
      variantId: new Types.ObjectId(),
      colorVariantId: new Types.ObjectId(),
      size: 'M',
      sku: 'BROWSER-E2E-SHIRT-M',
      name: 'Áo sơ mi browser E2E',
      fitType: 'regular',
      color: 'Trắng',
      image: 'https://example.com/browser-e2e-shirt.jpg',
      quantity: 1,
      priceAtPurchased: 250_000,
    }],
    subTotal: 250_000,
    shippingFee: 30_000,
    couponDiscountAmount: 0,
    shippingDiscountAmount: 0,
    membershipDiscountAmount: 0,
    taxAmount: 0,
    totalAmount: 280_000,
    status: 'confirmed',
    paymentMethod: 'COD',
    paymentStatus: 'pending',
    shipping: {
      provider: 'GHN',
      status: 'ready',
      trackingCode: 'GHN-BROWSER-E2E',
    },
    shippingAddress,
  });
};

const main = async () => {
  let harness: ApiE2EHarness | null = null;
  let stopping = false;

  const stop = async (exitCode: number) => {
    if (stopping) return;
    stopping = true;
    if (harness) await harness.stop();
    process.exit(exitCode);
  };

  process.once('SIGINT', () => { void stop(0); });
  process.once('SIGTERM', () => { void stop(0); });

  try {
    harness = await startApiE2EHarness({
      databaseName: 'fashion-ecommerce-browser-e2e',
      port: apiPort,
    });
    await seedBrowserFixtures();
    app.get('/__e2e__/ready', (_req, res) => {
      res.status(200).json({ status: 'ready', orderCode });
    });
    console.log(`Browser E2E backend ready at ${harness.baseUrl}`);
  } catch (error) {
    console.error('Browser E2E backend failed to start:', error);
    await stop(1);
  }
};

void main();
