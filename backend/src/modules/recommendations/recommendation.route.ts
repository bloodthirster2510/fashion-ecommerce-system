import { Router } from 'express';
import {
  authenticate,
  optionalAuthenticate,
  requireActiveAccount,
  requireActiveAccountIfAuthenticated,
} from '../../middlewares/auth.middleware';
import {
  createRecommendationEvent,
  getCartRecommendations,
  getMyRecommendations,
  getSimilarProducts,
} from './recommendation.controller';

const router = Router();

router.get('/me', optionalAuthenticate, requireActiveAccountIfAuthenticated, getMyRecommendations);
router.get('/cart', authenticate, requireActiveAccount, getCartRecommendations);
router.get(
  '/products/:productId/similar',
  optionalAuthenticate,
  requireActiveAccountIfAuthenticated,
  getSimilarProducts,
);
router.post(
  '/events',
  optionalAuthenticate,
  requireActiveAccountIfAuthenticated,
  createRecommendationEvent,
);

export default router;
