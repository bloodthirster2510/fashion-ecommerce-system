import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/role.middleware';
import {
  addCartItem,
  deleteCartItem,
  getCart,
  selectAllCartItems,
  selectCartItem,
  updateCartItem,
} from './cart.controller';

const router = Router();

router.use(authenticate);
router.use(authorize('user'));

router.get('/', getCart);
router.post('/items', addCartItem);
router.put('/items/:itemId', updateCartItem);
router.patch('/items/:itemId/selected', selectCartItem);
router.patch('/select-all', selectAllCartItems);
router.delete('/items/:itemId', deleteCartItem);

export default router;
