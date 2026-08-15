import { User } from '../user.model';

describe('User model indexes', () => {
  it('enforces uniqueness for stored phone numbers while allowing missing phones', () => {
    expect(User.schema.indexes()).toContainEqual([
      { phone: 1 },
      {
        unique: true,
        partialFilterExpression: { phone: { $type: 'string' } },
      },
    ]);
  });
});
