import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../middlewares/role.middleware';
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
const canReadInventory = [...canManageInventory, requirePermission('inventory.read')];
const canWriteInventory = [...canManageInventory, requirePermission('inventory.write')];

router.get('/', canReadInventory, getInventory);
router.get('/low-stock', canReadInventory, getLowStockInventory);
router.get('/imports', canReadInventory, getImports);
router.post('/imports', canWriteInventory, createImport);
router.get('/imports/:id', canReadInventory, getImportById);
router.patch('/:id/adjust', canWriteInventory, adjustInventory);
router.post('/reserve', canWriteInventory, reserveInventory);
router.post('/release', canWriteInventory, releaseReservations);
router.post('/commit', canWriteInventory, commitReservations);
router.post('/expire', canWriteInventory, expireReservations);

export default router;
