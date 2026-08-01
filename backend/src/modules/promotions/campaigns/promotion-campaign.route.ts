import { Router } from 'express';
import { authenticate, requireActiveAccount } from '../../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../../middlewares/role.middleware';
import { createCampaign, deleteCampaign, listCampaigns, updateCampaign } from './promotion-campaign.controller';

export const adminPromotionCampaignRouter = Router();
adminPromotionCampaignRouter.use(authenticate, requireActiveAccount, authorize('admin', 'staff'));
adminPromotionCampaignRouter.get('/', requirePermission('promotions.read'), listCampaigns);
adminPromotionCampaignRouter.post('/', requirePermission('promotions.write'), createCampaign);
adminPromotionCampaignRouter.put('/:id', requirePermission('promotions.write'), updateCampaign);
adminPromotionCampaignRouter.delete('/:id', requirePermission('promotions.write'), deleteCampaign);
