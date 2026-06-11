import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/role.middleware';
import {
  addFavorite,
  getFavoriteStatus,
  listFavorites,
  removeFavorite,
} from './favorite.controller';

const router = Router();

router.use(authenticate);
router.use(authorize('user'));

router.get('/', listFavorites);
router.get('/status', getFavoriteStatus);
router.post('/', addFavorite);
router.delete('/:productId', removeFavorite);

export default router;
