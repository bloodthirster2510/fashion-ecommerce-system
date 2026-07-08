import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../middlewares/role.middleware';
import {
  adjustInventory,
  cancelReceipt,
  commitReservations,
  createImport,
  createReceipt,
  deleteInventory,
  deleteImport,
  expireReservations,
  getImportById,
  getImportSuppliers,
  getImports,
  getInventory,
  getInventoryProducts,
  getLowStockInventory,
  getReceiptById,
  getReceipts,
  confirmReceipt,
  releaseReservations,
  reserveInventory,
  updateReceipt,
} from './inventory.controller';

const router = Router();
const canManageInventory = [authenticate, authorize('admin', 'staff')];
const canReadInventory = [...canManageInventory, requirePermission('inventory.read')];
const canWriteInventory = [...canManageInventory, requirePermission('inventory.write')];

router.get('/', canReadInventory, getInventory);
router.get('/products', canReadInventory, getInventoryProducts);
router.get('/low-stock', canReadInventory, getLowStockInventory);
router.get('/receipts', canReadInventory, getReceipts);
router.post('/receipts', canWriteInventory, createReceipt);
router.get('/receipts/:id', canReadInventory, getReceiptById);
router.patch('/receipts/:id', canWriteInventory, updateReceipt);
router.post('/receipts/:id/confirm', canWriteInventory, confirmReceipt);
router.post('/receipts/:id/cancel', canWriteInventory, cancelReceipt);
router.get('/imports', canReadInventory, getImports);
router.post('/imports', canWriteInventory, createImport);
router.get('/imports/suppliers', canReadInventory, getImportSuppliers);
router.get('/imports/:id', canReadInventory, getImportById);
router.delete('/imports/:id', canWriteInventory, deleteImport);
router.patch('/:id/adjust', canWriteInventory, adjustInventory);
router.delete('/:id', canWriteInventory, deleteInventory);
router.post('/reserve', canWriteInventory, reserveInventory);
router.post('/release', canWriteInventory, releaseReservations);
router.post('/commit', canWriteInventory, commitReservations);
router.post('/expire', canWriteInventory, expireReservations);

export default router;
