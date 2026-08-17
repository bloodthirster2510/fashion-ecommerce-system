import type { RecommendationItem, RecommendationReasonCode } from '../recommendationApi';
import {
  getRecommendationReasonLabel,
  getVisibleRatioInViewport,
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

  it('calculates how much of a vertical card is visible', () => {
    expect(getVisibleRatioInViewport(100, 120, 800)).toBe(1);
    expect(getVisibleRatioInViewport(-48, 120, 800)).toBe(0.6);
    expect(getVisibleRatioInViewport(728, 120, 800)).toBe(0.6);
    expect(getVisibleRatioInViewport(900, 120, 800)).toBe(0);
  });
});
