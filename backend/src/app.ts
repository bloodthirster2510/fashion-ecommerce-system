import express from 'express';
import cors from 'cors';
import routes from './routes';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(routes);

app.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

export default app;
