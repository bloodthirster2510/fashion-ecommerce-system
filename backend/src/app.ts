import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import routes from './routes';
import {
  createApiRateLimitMiddleware,
  createCorsOptions,
} from './middlewares/security.middleware';

const app = express();
const trustedProxyHops = Number(process.env.TRUST_PROXY_HOPS);
if (Number.isInteger(trustedProxyHops) && trustedProxyHops > 0) {
  app.set('trust proxy', trustedProxyHops);
}
const defaultBodyLimit = process.env.REQUEST_BODY_LIMIT?.trim() || '2mb';
const orderEvidenceBodyLimit = process.env.ORDER_EVIDENCE_BODY_LIMIT?.trim() || '12mb';
const avatarBodyLimit = process.env.AVATAR_BODY_LIMIT?.trim() || '5mb';

app.use(helmet());
app.use(cors(createCorsOptions()));
app.use('/api', createApiRateLimitMiddleware());
app.use(
  [
    '/api/orders/:id/cancel',
    '/api/orders/:id/request-return',
    '/api/admin/orders/:id/cancel',
    '/api/admin/orders/:id/return-request',
  ],
  express.json({ limit: orderEvidenceBodyLimit }),
);
app.use('/api/users/me/avatar', express.json({ limit: avatarBodyLimit }));
app.use(express.json({ limit: defaultBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: defaultBodyLimit }));
app.use(
  '/uploads',
  express.static(path.resolve(process.cwd(), 'uploads'), {
    dotfiles: 'ignore',
    index: false,
  }),
);

app.use('/api', routes);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

export default app;
