import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../../middlewares/role.middleware';
import {
  createMembershipRanking,
  deleteMembershipRanking,
  listMembershipRankings,
  updateMembershipRanking,
  updateMembershipRankingStatus,
} from './membership-ranking.controller';

const membershipRankingAdminRouter = Router();
const loyaltyReaders = [authenticate, authorize('admin', 'staff'), requirePermission('loyalty.read')];
const loyaltyWriters = [authenticate, authorize('admin', 'staff'), requirePermission('loyalty.write')];

membershipRankingAdminRouter.get('/', loyaltyReaders, listMembershipRankings);
membershipRankingAdminRouter.post('/', loyaltyWriters, createMembershipRanking);
membershipRankingAdminRouter.put('/:id', loyaltyWriters, updateMembershipRanking);
membershipRankingAdminRouter.patch('/:id/status', loyaltyWriters, updateMembershipRankingStatus);
membershipRankingAdminRouter.delete('/:id', loyaltyWriters, deleteMembershipRanking);

export default membershipRankingAdminRouter;
