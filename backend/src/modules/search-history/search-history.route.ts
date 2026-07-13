import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../../middlewares/auth.middleware';
import {
  createSearchHistory,
  getMySearchHistory,
} from './search-history.controller';

const router = Router();

router.post('/', optionalAuthenticate, createSearchHistory);
router.get('/me', authenticate, getMySearchHistory);

export default router;
