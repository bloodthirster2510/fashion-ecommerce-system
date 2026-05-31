import { Router } from 'express';
import { createBrand, deleteBrand, getBrands, updateBrand } from './brand.controller';

const router = Router();

router.post('/', createBrand);
router.post('/create', createBrand);
router.put('/:id', updateBrand);
router.put('/update/:id', updateBrand);
router.get('/getAll', getBrands);
router.delete('/:id', deleteBrand);
router.delete('/delete/:id', deleteBrand);

export default router;
