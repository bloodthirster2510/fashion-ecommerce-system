import type { RecommendationItem, RecommendationReasonCode } from '../recommendationApi';
import {
  getRecommendationReasonLabel,
  getUnsentVisibleRecommendationItems,
} from '../recommendationUtils';

const recommendationItem = (
  id: string,
  reasonCodes: RecommendationReasonCode[] = ['popular'],
): RecommendationItem => ({
  product: { _id: id } as RecommendationItem['product'],
  score: 0.8,
  rank: 1,
  reason: '',
  reasonCodes,
});

describe('recommendation presentation', () => {
  it('shows the most relevant localized reason', () => {
    expect(getRecommendationReasonLabel(
      recommendationItem('one', ['preferred_category', 'popular']),
    )).toBe('Hợp sở thích của bạn');
    expect(getRecommendationReasonLabel(
      recommendationItem('two', ['same_color', 'similar_price']),
    )).toBe('Màu sắc tương tự');
    expect(getRecommendationReasonLabel(
      recommendationItem('three', ['completes_outfit', 'same_gender']),
    )).toBe('Hoàn thiện set đồ');
  });

  it('tracks only visible products that have not been sent', () => {
    const items = [
      recommendationItem('one'),
      recommendationItem('two'),
      recommendationItem('three'),
    ];

    const result = getUnsentVisibleRecommendationItems(
      items,
      new Set(['one', 'two']),
      new Set(['one']),
    );

    expect(result.map((item) => item.product._id)).toEqual(['two']);
  });
});
