import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize, requirePermission } from '../../middlewares/role.middleware';
import { listAuditLogs } from './audit-log.controller';

const adminAuditLogRouter = Router();

adminAuditLogRouter.use(authenticate);
adminAuditLogRouter.use(authorize('admin', 'staff'));
adminAuditLogRouter.get('/', requirePermission('audit.read'), listAuditLogs);

export { adminAuditLogRouter };
