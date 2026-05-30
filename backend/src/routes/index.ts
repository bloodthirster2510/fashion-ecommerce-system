import { Router } from 'express';
import brandRouter from '../modules/catalog/brands/brand.route';
import categoryRouter from '../modules/catalog/categories/categories.route';
import productRouter from '../modules/catalog/products/product.route';
import authRoutes from '../modules/auth/auth.routes';
import userRoutes from '../modules/users/user.routes';
import membershipRoutes from '../modules/users/membership.routes';
import locationRoutes from '../modules/locations/location.routes';
import app from '../app';


const router = Router();

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/membership-rankings', membershipRoutes);
app.use('/api/locations', locationRoutes);


router.use('/api/brands', brandRouter);
router.use('/api/categories', categoryRouter);
router.use('/api/products', productRouter);

export default router;
