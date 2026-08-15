import { Router } from 'express';
import * as authController from './auth.controller';
import { authenticate, requireActiveAccount } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/role.middleware';
import { createAuthRateLimitMiddleware } from '../../middlewares/security.middleware';

const router = Router();
const authRateLimit = createAuthRateLimitMiddleware();

router.post('/send-otp', authRateLimit, authController.sendOtp);
router.post('/verify-otp', authRateLimit, authController.verifyOtp);
router.post('/register', authRateLimit, authController.register);
router.post('/login', authRateLimit, authController.login);
router.post('/login/unlock/request', authRateLimit, authController.requestLoginUnlock);
router.post('/login/unlock/verify', authRateLimit, authController.verifyLoginUnlock);
router.post('/admin/login', authRateLimit, authController.adminLogin);
router.get(
  '/admin/session',
  authenticate,
  requireActiveAccount,
  authorize('admin', 'staff'),
  authController.getAdminSession,
);
router.post('/logout', authController.logout);
router.post('/refresh-token', authRateLimit, authController.refreshToken);
router.post('/forgot-password', authRateLimit, authController.forgotPassword);
router.post('/reset-password', authRateLimit, authController.resetPassword);
router.post('/change-password', authenticate, authController.changePassword);

export default router;
