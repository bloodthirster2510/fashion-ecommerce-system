import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../middlewares/role.middleware';
import {
  adjustInventory,
  cancelReceipt,
  commitReservations,
  createReceipt,
  createStocktake,
  createSupplier,
  deleteInventory,
  deleteSupplier,
  expireReservations,
  getImportById,
  getImportSuppliers,
  getImports,
  getInventory,
  getInventoryProducts,
  getInventoryThreshold,
  getLowStockInventory,
  getMovements,
  getReceiptById,
  getReceipts,
  getSuppliers,
  confirmReceipt,
  releaseReservations,
  reserveInventory,
  updateInventoryThreshold,
  updateReceipt,
  updateSupplier,
} from './inventory.controller';

const router = Router();
const canManageInventory = [authenticate, authorize('admin', 'staff')];
const canReadInventory = [...canManageInventory, requirePermission('inventory.read')];
const canWriteInventory = [...canManageInventory, requirePermission('inventory.write')];

router.get('/', canReadInventory, getInventory);
router.get('/products', canReadInventory, getInventoryProducts);
router.get('/low-stock', canReadInventory, getLowStockInventory);
router.get('/threshold', canReadInventory, getInventoryThreshold);
router.patch('/threshold', canWriteInventory, updateInventoryThreshold);
router.get('/movements', canReadInventory, getMovements);
router.get('/suppliers', canReadInventory, getSuppliers);
router.post('/suppliers', canWriteInventory, createSupplier);
router.patch('/suppliers/:id', canWriteInventory, updateSupplier);
router.delete('/suppliers/:id', canWriteInventory, deleteSupplier);
router.post('/stocktakes', canWriteInventory, createStocktake);
router.get('/receipts', canReadInventory, getReceipts);
router.post('/receipts', canWriteInventory, createReceipt);
router.get('/receipts/:id', canReadInventory, getReceiptById);
router.patch('/receipts/:id', canWriteInventory, updateReceipt);
router.post('/receipts/:id/confirm', canWriteInventory, confirmReceipt);
router.post('/receipts/:id/cancel', canWriteInventory, cancelReceipt);
router.get('/imports', canReadInventory, getImports);
router.get('/imports/suppliers', canReadInventory, getImportSuppliers);
router.get('/imports/:id', canReadInventory, getImportById);
router.patch('/:id/adjust', canWriteInventory, adjustInventory);
router.delete('/:id', canWriteInventory, deleteInventory);
router.post('/reserve', canWriteInventory, reserveInventory);
router.post('/release', canWriteInventory, releaseReservations);
router.post('/commit', canWriteInventory, commitReservations);
router.post('/expire', canWriteInventory, expireReservations);

export default router;
