import express from 'express';
import cors from 'cors';
import path from 'path';
import routes from './routes';
import {
  createApiRateLimitMiddleware,
  createCorsOptions,
  createSecurityHeadersMiddleware,
} from './middlewares/security.middleware';

const app = express();
const defaultBodyLimit = process.env.REQUEST_BODY_LIMIT?.trim() || '2mb';
const orderEvidenceBodyLimit = process.env.ORDER_EVIDENCE_BODY_LIMIT?.trim() || '12mb';

app.use(createSecurityHeadersMiddleware());
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
