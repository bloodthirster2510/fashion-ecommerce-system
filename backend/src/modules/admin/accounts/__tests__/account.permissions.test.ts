import { expandImpliedStaffPermissions, STAFF_PERMISSION_VALUES } from '../account.permissions';

describe('account permissions', () => {
  it('includes audit log read permission for staff assignment', () => {
    expect(STAFF_PERMISSION_VALUES).toContain('audit.read');
  });

  it('includes support content management and implies reply access', () => {
    expect(STAFF_PERMISSION_VALUES).toContain('support.manage');
    expect(expandImpliedStaffPermissions(['support.manage'])).toEqual([
      'support.manage',
      'support.reply',
    ]);
  });

  it('separates review permissions and implies read access for review actions', () => {
    expect(STAFF_PERMISSION_VALUES).toEqual(expect.arrayContaining([
      'reviews.read',
      'reviews.moderate',
      'reviews.reply',
    ]));
    expect(expandImpliedStaffPermissions(['reviews.moderate', 'reviews.reply'])).toEqual([
      'reviews.moderate',
      'reviews.reply',
      'reviews.read',
    ]);
  });
});
