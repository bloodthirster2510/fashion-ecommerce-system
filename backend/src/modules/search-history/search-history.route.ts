import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../../middlewares/auth.middleware';
import {
  createSearchHistory,
  deleteMySearchHistory,
  getMySearchHistory,
  syncMySearchHistory,
} from './search-history.controller';

const router = Router();

router.post('/', optionalAuthenticate, createSearchHistory);
router.post('/sync', authenticate, syncMySearchHistory);
router.get('/me', authenticate, getMySearchHistory);
router.delete('/me', authenticate, deleteMySearchHistory);

export default router;
