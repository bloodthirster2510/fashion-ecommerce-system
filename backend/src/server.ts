import http from 'http';
import mongoose from 'mongoose';
import app from './app';
import { connectDB } from './config/database';
import { seedMembershipRankings, seedAdmin, seedInventoryForExistingProducts } from './database/seeders';
import { paymentExpiryScheduler } from './modules/payments/payment-expiry.scheduler';
import { orderPaymentDeadlineScheduler } from './modules/payments/order-payment-deadline.scheduler';
import { couponLifecycleScheduler } from './modules/promotions/coupons/coupon-lifecycle.scheduler';
import { supportTicketLifecycleScheduler } from './modules/support/support-ticket-lifecycle.scheduler';
import { supportGateway } from './modules/realtime/support.gateway';
import { orderGateway } from './modules/realtime/order.gateway';
import { virtualTryOnGateway } from './modules/realtime/virtual-try-on.gateway';
import { shippingReconcileScheduler } from './modules/shipping/shipping-reconcile.scheduler';
import { orderAutoCompleteScheduler } from './modules/orders/order-auto-complete.scheduler';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  if (process.env.SEED_DB === 'true') {
    await seedMembershipRankings();
    await seedAdmin();
    await seedInventoryForExistingProducts();
  }

  paymentExpiryScheduler.startPaymentExpiryScheduler();
  orderPaymentDeadlineScheduler.start();
  couponLifecycleScheduler.start();
  supportTicketLifecycleScheduler.start();
  shippingReconcileScheduler.start();
  orderAutoCompleteScheduler.start();

  const server = http.createServer(app);
  supportGateway.attach(server);
  orderGateway.attach(server);
  virtualTryOnGateway.attach(server);

  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

  let isShuttingDown = false;
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`${signal} received; shutting down gracefully`);

    paymentExpiryScheduler.stopPaymentExpiryScheduler();
    orderPaymentDeadlineScheduler.stop();
    couponLifecycleScheduler.stop();
    supportTicketLifecycleScheduler.stop();
    shippingReconcileScheduler.stop();
    orderAutoCompleteScheduler.stop();

    const forceExitTimer = setTimeout(() => {
      console.error('Graceful shutdown timed out');
      process.exit(1);
    }, 10_000);
    forceExitTimer.unref?.();

    try {
      await Promise.all([supportGateway.close(), orderGateway.close(), virtualTryOnGateway.close()]);
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => error ? reject(error) : resolve());
        });
      }
      await mongoose.disconnect();
      clearTimeout(forceExitTimer);
      process.exit(0);
    } catch (error) {
      console.error('Graceful shutdown failed:', error);
      clearTimeout(forceExitTimer);
      process.exit(1);
    }
  };

  process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.once('SIGINT', () => { void shutdown('SIGINT'); });
};

startServer().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
