import React from 'react';
import { Dimensions, type View } from 'react-native';

type TrackableRecommendationItem = {
  product: {
    _id: string;
  };
};

type UseRecommendationImpressionsInput<T extends TrackableRecommendationItem> = {
  requestId?: string | null;
  items: T[];
  onImpression: (item: T) => void;
};

export const useRecommendationImpressions = <T extends TrackableRecommendationItem>({
  requestId,
  items,
  onImpression,
}: UseRecommendationImpressionsInput<T>) => {
  const sectionRef = React.useRef<View>(null);
  const sentProductIdsRef = React.useRef(new Set<string>());
  const latestInputRef = React.useRef({ requestId, items, onImpression });
  latestInputRef.current = { requestId, items, onImpression };

  React.useEffect(() => {
    sentProductIdsRef.current.clear();
  }, [requestId]);

  const checkVisibility = React.useCallback(() => {
    const current = latestInputRef.current;
    if (!current.requestId || !current.items.length || !sectionRef.current) {
      return;
    }

    sectionRef.current.measureInWindow((_x, y, _width, height) => {
      const viewportHeight = Dimensions.get('window').height;
      const isVisible = height > 0 && y < viewportHeight && y + height > 0;

      if (!isVisible) {
        return;
      }

      current.items.forEach((item) => {
        const productId = item.product._id;
        if (!sentProductIdsRef.current.has(productId)) {
          sentProductIdsRef.current.add(productId);
          current.onImpression(item);
        }
      });
    });
  }, []);

  React.useEffect(() => {
    const frame = requestAnimationFrame(checkVisibility);
    return () => cancelAnimationFrame(frame);
  }, [checkVisibility, items, requestId]);

  return {
    recommendationSectionRef: sectionRef,
    checkRecommendationVisibility: checkVisibility,
  };
};
