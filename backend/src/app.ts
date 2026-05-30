import express from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/user.routes';
import membershipRoutes from './modules/users/membership.routes';
import locationRoutes from './modules/locations/location.routes';
import routes from './routes';

const app = express();

app.use(cors());
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true, limit: '8mb' }));
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});


app.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

export default app;
