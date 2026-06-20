import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../../middlewares/role.middleware';
import {
  createMembershipRanking,
  createMembershipRankingsBatch,
  adjustLoyaltyPoints,
  deleteMembershipRanking,
  listLoyaltyPointHistory,
  listLoyaltyUsers,
  listMembershipRankings,
  reorderMembershipRankings,
  updateMembershipRanking,
  updateMembershipRankingStatus,
} from './membership-ranking.controller';
import {
  createLoyaltyRule,
  deleteLoyaltyRule,
  listLoyaltyRules,
  updateLoyaltyRule,
} from './loyalty-rule.controller';

const membershipRankingAdminRouter = Router();
const loyaltyReaders = [authenticate, authorize('admin', 'staff'), requirePermission('loyalty.read')];
const loyaltyWriters = [authenticate, authorize('admin', 'staff'), requirePermission('loyalty.write')];

membershipRankingAdminRouter.get('/', loyaltyReaders, listMembershipRankings);
membershipRankingAdminRouter.get('/users', loyaltyReaders, listLoyaltyUsers);
membershipRankingAdminRouter.get('/point-history', loyaltyReaders, listLoyaltyPointHistory);
membershipRankingAdminRouter.post('/point-adjustments', loyaltyWriters, adjustLoyaltyPoints);
membershipRankingAdminRouter.post('/batch', loyaltyWriters, createMembershipRankingsBatch);
membershipRankingAdminRouter.put('/reorder', loyaltyWriters, reorderMembershipRankings);
membershipRankingAdminRouter.get('/rules', loyaltyReaders, listLoyaltyRules);
membershipRankingAdminRouter.post('/rules', loyaltyWriters, createLoyaltyRule);
membershipRankingAdminRouter.put('/rules/:ruleId', loyaltyWriters, updateLoyaltyRule);
membershipRankingAdminRouter.delete('/rules/:ruleId', loyaltyWriters, deleteLoyaltyRule);
membershipRankingAdminRouter.post('/', loyaltyWriters, createMembershipRanking);
membershipRankingAdminRouter.put('/:id', loyaltyWriters, updateMembershipRanking);
membershipRankingAdminRouter.patch('/:id/status', loyaltyWriters, updateMembershipRankingStatus);
membershipRankingAdminRouter.delete('/:id', loyaltyWriters, deleteMembershipRanking);

export default membershipRankingAdminRouter;
