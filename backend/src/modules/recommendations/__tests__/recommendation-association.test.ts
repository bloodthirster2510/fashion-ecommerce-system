import { buildCategoryAssociationModel } from '../recommendation-association';

describe('category association model', () => {
  it('assigns a stronger normalized lift to recurring category pairs', () => {
    const model = buildCategoryAssociationModel([
      ['top', 'bottom'],
      ['top', 'bottom'],
      ['top', 'shoes'],
      ['dress', 'shoes'],
      ['dress', 'accessory'],
    ]);

    expect(model.hasEvidence).toBe(true);
    expect(model.score(['top'], 'bottom')).toBeGreaterThan(model.score(['top'], 'shoes'));
    expect(model.score(['top'], 'top')).toBe(0);
  });

  it('requires the configured minimum pair support', () => {
    const model = buildCategoryAssociationModel([
      ['top', 'bottom'],
      ['top', 'shoes'],
    ], 2);

    expect(model.hasEvidence).toBe(false);
    expect(model.score(['top'], 'bottom')).toBe(0);
  });
});
