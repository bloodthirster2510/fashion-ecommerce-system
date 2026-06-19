import { STAFF_PERMISSION_VALUES } from '../account.permissions';

describe('account permissions', () => {
  it('includes audit log read permission for staff assignment', () => {
    expect(STAFF_PERMISSION_VALUES).toContain('audit.read');
  });
});
