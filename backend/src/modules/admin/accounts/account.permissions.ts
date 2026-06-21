import type { StaffPermission } from '../../../database/models/user.model';

export const STAFF_PERMISSION_VALUES: StaffPermission[] = [
  'products.read',
  'products.write',
  'catalog.read',
  'catalog.write',
  'orders.read',
  'orders.update',
  'payments.adjust',
  'audit.read',
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
  'support.manage',
  'reports.read',
];

export const STAFF_PERMISSION_SET = new Set<string>(STAFF_PERMISSION_VALUES);

export const expandImpliedStaffPermissions = (permissions: StaffPermission[]) => {
  const expanded = new Set(permissions);
  if (expanded.has('support.manage')) expanded.add('support.reply');
  return Array.from(expanded);
};
