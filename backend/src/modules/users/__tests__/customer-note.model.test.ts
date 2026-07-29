import { Types } from 'mongoose';
import { CustomerNote } from '../../../database/models';

describe('CustomerNote model', () => {
  it('validates an internal note with actor ownership', async () => {
    const note = new CustomerNote({
      customerId: new Types.ObjectId(),
      content: 'Khách ưu tiên liên hệ qua email.',
      createdBy: new Types.ObjectId(),
      updatedBy: new Types.ObjectId(),
    });

    await expect(note.validate()).resolves.toBeUndefined();
  });

  it('rejects empty and oversized content', async () => {
    const base = {
      customerId: new Types.ObjectId(),
      createdBy: new Types.ObjectId(),
      updatedBy: new Types.ObjectId(),
    };

    await expect(new CustomerNote({ ...base, content: '' }).validate()).rejects.toMatchObject({
      errors: { content: expect.anything() },
    });
    await expect(
      new CustomerNote({ ...base, content: 'x'.repeat(2001) }).validate(),
    ).rejects.toMatchObject({
      errors: { content: expect.anything() },
    });
  });

  it('indexes notes by customer and recency', () => {
    expect(CustomerNote.schema.indexes()).toContainEqual([
      { customerId: 1, createdAt: -1 },
      expect.any(Object),
    ]);
  });
});
