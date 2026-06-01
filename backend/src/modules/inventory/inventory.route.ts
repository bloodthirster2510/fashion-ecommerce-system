import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/role.middleware';
import {
  adjustInventory,
  commitReservations,
  createImport,
  expireReservations,
  getImportById,
  getImports,
  getInventory,
  getLowStockInventory,
  releaseReservations,
  reserveInventory,
} from './inventory.controller';

const router = Router();
const canManageInventory = [authenticate, authorize('admin', 'staff')];

router.get('/', canManageInventory, getInventory);
router.get('/low-stock', canManageInventory, getLowStockInventory);
router.get('/imports', canManageInventory, getImports);
router.post('/imports', canManageInventory, createImport);
router.get('/imports/:id', canManageInventory, getImportById);
router.patch('/:id/adjust', canManageInventory, adjustInventory);
router.post('/reserve', canManageInventory, reserveInventory);
router.post('/release', canManageInventory, releaseReservations);
router.post('/commit', canManageInventory, commitReservations);
router.post('/expire', canManageInventory, expireReservations);

export default router;
