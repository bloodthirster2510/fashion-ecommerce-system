import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../../middlewares/auth.middleware';
import {
  createRecommendationEvent,
  getCartRecommendations,
  getMyRecommendations,
  getSimilarProducts,
} from './recommendation.controller';

const router = Router();

router.get('/me', optionalAuthenticate, getMyRecommendations);
router.get('/cart', authenticate, getCartRecommendations);
router.get('/products/:productId/similar', optionalAuthenticate, getSimilarProducts);
router.post('/events', optionalAuthenticate, createRecommendationEvent);

export default router;
