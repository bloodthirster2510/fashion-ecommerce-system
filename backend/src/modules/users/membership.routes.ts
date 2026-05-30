import { Router } from 'express';
import { getMembershipRankings } from './membership.service';
import { ok } from '../../utils/response';
import { Request, Response } from 'express';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const tiers = await getMembershipRankings();
    return ok(res, tiers);
  } catch {
    return res.status(500).json({ message: 'Lỗi server' });
  }
});

export default router;
