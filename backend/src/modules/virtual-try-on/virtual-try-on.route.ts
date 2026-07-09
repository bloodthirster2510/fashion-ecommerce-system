import { Router } from 'express';
import { authenticate, requireActiveAccount } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/role.middleware';
import { upload, withMulterErrorHandling } from '../../middlewares/upload.middleware';
import {
  cancelJob,
  createJob,
  deleteAsset,
  deleteJob,
  getJob,
  getLatestJob,
  listAssets,
  listJobs,
  retryJob,
  uploadAsset,
  validateAsset,
} from './virtual-try-on.controller';

const router = Router();
const assetUpload = withMulterErrorHandling(upload.single('image'));

router.use(authenticate);
router.use(requireActiveAccount);
router.use(authorize('user'));

router.get('/assets', listAssets);
router.post('/assets', assetUpload, uploadAsset);
router.post('/assets/:assetId/validate', validateAsset);
router.delete('/assets/:assetId', deleteAsset);

router.get('/jobs/latest', getLatestJob);
router.get('/jobs', listJobs);
router.post('/jobs', createJob);
router.get('/jobs/:jobId', getJob);
router.post('/jobs/:jobId/retry', retryJob);
router.post('/jobs/:jobId/cancel', cancelJob);
router.delete('/jobs/:jobId', deleteJob);

export default router;

