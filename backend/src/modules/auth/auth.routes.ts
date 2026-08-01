import { Router } from 'express';
import * as authController from './auth.controller';
import { authenticate } from '../../middlewares/auth.middleware';
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
router.post('/logout', authController.logout);
router.post('/refresh-token', authRateLimit, authController.refreshToken);
router.post('/forgot-password', authRateLimit, authController.forgotPassword);
router.post('/reset-password', authRateLimit, authController.resetPassword);
router.post('/change-password', authenticate, authController.changePassword);
router.post('/social-login', authRateLimit, authController.socialLogin);

export default router;
