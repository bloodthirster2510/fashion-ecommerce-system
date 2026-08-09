import { Router } from 'express';
import { upload, withMulterErrorHandling } from '../../middlewares/upload.middleware';
import { searchProductsByImage, searchProductsByText } from './visual-search.controller';

const router = Router();
const visualSearchUpload = withMulterErrorHandling(upload.single('image'));

// Route nhận một file ảnh từ frontend và chuyển sang controller tìm kiếm bằng hình ảnh.
router.post('/', visualSearchUpload, searchProductsByImage);
// Route nhận text mô tả và tìm trong cùng visual index nhờ embedding text của FashionCLIP.
router.post('/text', searchProductsByText);

export default router;
