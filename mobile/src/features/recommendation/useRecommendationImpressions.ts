import React from 'react';
import { Dimensions, type View, type ViewToken } from 'react-native';
import { getUnsentVisibleRecommendationItems } from './recommendationUtils';

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
  const visibleProductIdsRef = React.useRef(new Set<string>());
  const latestInputRef = React.useRef({ requestId, items, onImpression });
  latestInputRef.current = { requestId, items, onImpression };

  React.useEffect(() => {
    sentProductIdsRef.current.clear();
    visibleProductIdsRef.current.clear();
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

      const trackableItems = getUnsentVisibleRecommendationItems(
        current.items,
        visibleProductIdsRef.current,
        sentProductIdsRef.current,
      );

      trackableItems.forEach((item) => {
        const productId = item.product._id;
        sentProductIdsRef.current.add(productId);
        current.onImpression(item);
      });
    });
  }, []);

  const handleViewableItemsChanged = React.useCallback(({
    viewableItems,
  }: {
    viewableItems: ViewToken<T>[];
  }) => {
    visibleProductIdsRef.current = new Set(
      viewableItems
        .filter((token) => token.isViewable)
        .map((token) => token.item.product._id),
    );
    checkVisibility();
  }, [checkVisibility]);

  React.useEffect(() => {
    const frame = requestAnimationFrame(checkVisibility);
    return () => cancelAnimationFrame(frame);
  }, [checkVisibility, items, requestId]);

  return {
    recommendationSectionRef: sectionRef,
    checkRecommendationVisibility: checkVisibility,
    handleRecommendationViewableItemsChanged: handleViewableItemsChanged,
  };
};
