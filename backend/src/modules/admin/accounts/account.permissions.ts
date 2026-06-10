import type { StaffPermission } from '../../../database/models/user.model';

export const STAFF_PERMISSION_VALUES: StaffPermission[] = [
  'products.read',
  'products.write',
  'catalog.read',
  'catalog.write',
  'orders.read',
  'orders.update',
  'inventory.read',
  'inventory.write',
  'promotions.read',
  'promotions.write',
  'loyalty.read',
  'loyalty.write',
  'customers.read',
  'customers.manage',
  'reviews.moderate',
  'support.reply',
  'reports.read',
];

export const STAFF_PERMISSION_SET = new Set<string>(STAFF_PERMISSION_VALUES);
