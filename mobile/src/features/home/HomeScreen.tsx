import React from 'react';
import { Alert, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import StorefrontFooter from '../../components/layout/StorefrontFooter';
import StorefrontHeader from '../../components/layout/StorefrontHeader';
import StorefrontBottomNav from '../../components/navigation/StorefrontBottomNav';
import { colors, spacing } from '../../theme';
import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { catalogApi, CatalogCategory, CatalogGender, CatalogProduct } from '../catalog/catalogApi';
import { interactionApi, type InteractionPayload } from '../recommendation/interactionApi';
import { recommendationApi, type RecommendationItem } from '../recommendation/recommendationApi';
import RecommendationRail from '../recommendation/RecommendationRail';
import { useRecommendationImpressions } from '../recommendation/useRecommendationImpressions';
import CategoryDrawer from './components/CategoryDrawer';
import FeatureCard from './components/FeatureCard';
import ProductSection from './components/ProductSection';
import { useCustomerNotifications } from '../notifications/CustomerNotificationProvider';
import { addSearchHistory, createSearchEventId } from '../search/searchHistory';
import { useStaleFocusEffect } from '../../hooks/useStaleFocusEffect';

type HomeNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

const virtualTryOnFeatureImage = require('../../../assets/virtual-try-on/hero-studio.jpg');
const homeDiscoverHeroImage = require('../../../assets/home-discover-hero-v2.png');

const HomeScreen = () => {
  const navigation = useNavigation<HomeNavigationProp>();
  const { isAuthenticated, runWithAuth } = useAuth();
  const { summary: notificationSummary, refresh: refreshNotifications } = useCustomerNotifications();
  const [isCategoryDrawerVisible, setIsCategoryDrawerVisible] = React.useState(false);
  const [categories, setCategories] = React.useState<CatalogCategory[]>([]);
  const [isCategoryLoading, setIsCategoryLoading] = React.useState(false);
  const [bestSellers, setBestSellers] = React.useState<CatalogProduct[]>([]);
  const [recommendationItems, setRecommendationItems] = React.useState<RecommendationItem[]>([]);
  const [recommendationRequestId, setRecommendationRequestId] = React.useState<string | null>(null);
  const [recommendationAlgorithmVersion, setRecommendationAlgorithmVersion] = React.useState<string>();
  const [isProductLoading, setIsProductLoading] = React.useState(true);
  const [bestSellerError, setBestSellerError] = React.useState<string | null>(null);
  const [recommendationError, setRecommendationError] = React.useState<string | null>(null);
  const recommendationAuthStateRef = React.useRef(isAuthenticated);

  const recordInteraction = React.useCallback((payload: InteractionPayload) => {
    if (isAuthenticated) {
      void runWithAuth((accessToken) => interactionApi.recordInteraction(payload, accessToken)).catch(() => undefined);
      return;
    }

    void interactionApi.recordInteraction(payload).catch(() => undefined);
  }, [isAuthenticated, runWithAuth]);

  const recordRecommendationEvent = React.useCallback((item: RecommendationItem, eventType: 'impression' | 'click') => {
    if (!recommendationRequestId) {
      return;
    }

    const payload = {
      requestId: recommendationRequestId,
      eventType,
      context: 'home' as const,
      recommendedProductId: item.product._id,
      algorithmVersion: recommendationAlgorithmVersion,
      score: item.score,
      rank: item.rank,
      reasonCodes: item.reasonCodes,
    };

    if (isAuthenticated) {
      void runWithAuth((accessToken) => recommendationApi.recordEvent(payload, accessToken)).catch(() => undefined);
      return;
    }

    void recommendationApi.recordEvent(payload).catch(() => undefined);
  }, [isAuthenticated, recommendationAlgorithmVersion, recommendationRequestId, runWithAuth]);
  const {
    recommendationSectionRef,
    checkRecommendationVisibility,
    handleRecommendationViewableItemsChanged,
  } = useRecommendationImpressions({
    requestId: recommendationRequestId,
    items: recommendationItems,
    onImpression: (item) => recordRecommendationEvent(item, 'impression'),
  });

  const loadCategories = React.useCallback(() => {
    let isCurrentRequest = true;
    const controller = new AbortController();

    setIsCategoryLoading(true);
    catalogApi
      .getCategories({}, controller.signal, { forceRefresh: true })
      .then((items) => {
        if (isCurrentRequest) {
          setCategories(items);
        }
      })
      .catch(() => {
        // Keep the last good categories during a short network interruption.
      })
      .finally(() => {
        if (isCurrentRequest) {
          setIsCategoryLoading(false);
        }
      });

    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
  }, []);

  const loadHomeProducts = React.useCallback(() => {
    let isCurrentRequest = true;
    const controller = new AbortController();

    setIsProductLoading(true);
    setBestSellerError(null);
    setRecommendationError(null);
    if (recommendationAuthStateRef.current !== isAuthenticated) {
      recommendationAuthStateRef.current = isAuthenticated;
      setRecommendationItems([]);
      setRecommendationRequestId(null);
      setRecommendationAlgorithmVersion(undefined);
    }

    const recommendationPromise = isAuthenticated
      ? runWithAuth((accessToken) =>
          recommendationApi.getPersonalRecommendations(10, accessToken, controller.signal))
      : recommendationApi.getPersonalRecommendations(10, undefined, controller.signal);

    Promise.allSettled([catalogApi.getBestSellers(8, controller.signal), recommendationPromise])
      .then(([bestSellerResult, recommendationResult]) => {
        if (!isCurrentRequest) return;

        if (bestSellerResult.status === 'fulfilled') {
          setBestSellers(bestSellerResult.value.items);
        } else {
          setBestSellerError('Không tải được sản phẩm bán chạy');
        }

        if (recommendationResult.status === 'fulfilled') {
          setRecommendationItems(recommendationResult.value.items);
          setRecommendationRequestId(recommendationResult.value.requestId);
          setRecommendationAlgorithmVersion(recommendationResult.value.algorithmVersion);
        } else {
          setRecommendationError('Không tải được sản phẩm gợi ý');
        }
      })
      .finally(() => {
        if (isCurrentRequest) {
          setIsProductLoading(false);
        }
      });

    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
  }, [isAuthenticated, runWithAuth]);

  useStaleFocusEffect(loadCategories, [loadCategories], { staleMs: 60 * 1000 });
  useStaleFocusEffect(loadHomeProducts, [loadHomeProducts], {
    staleMs: 60 * 1000,
    runOnDepsChange: true,
  });
  useFocusEffect(React.useCallback(() => { void refreshNotifications(); }, [refreshNotifications]));

  const navigateToProductList = (params?: RootStackParamList['ProductList']) => {
    setIsCategoryDrawerVisible(false);
    navigation.navigate('ProductList', params);
  };

  const handleGenderSelect = (gender: CatalogGender) => {
    navigateToProductList({
      title:
        gender === 'male'
          ? 'Thời trang nam'
          : gender === 'female'
            ? 'Thời trang nữ'
            : 'Thời trang unisex',
      gender,
    });
  };

  const handleCategorySelect = (category: CatalogCategory) => {
    navigateToProductList({
      title: category.name,
      gender: category.gender,
      categoryId: category._id,
    });
  };

  const handleSearchSubmit = (keyword: string) => {
    void addSearchHistory(keyword);
    recordInteraction({
      actionType: 'search',
      source: 'search',
      metadata: { keyword },
    });

    navigation.navigate('ProductList', {
      title: `Tìm kiếm: ${keyword}`,
      keyword,
      searchEventId: createSearchEventId(),
      searchSource: 'mobile_manual',
    });
  };

  const handleProductPress = (product: CatalogProduct) => {
    if (product._id) {
      navigation.navigate('ProductDetail', { productId: product._id });
    } else {
    Alert.alert('Chi tiết sản phẩm', `${product.name} sẽ được bổ sung ở màn chi tiết sản phẩm.`);
    }
  };

  const handleCartPress = (product: CatalogProduct) => {
    if (product._id) {
      navigation.navigate('ProductDetail', { productId: product._id });
      return;
    }

    Alert.alert('Giỏ hàng', 'Bạn mở chi tiết sản phẩm để chọn màu, size và số lượng trước nha.');
  };

  const handleRecommendationProductPress = (item: RecommendationItem) => {
    recordRecommendationEvent(item, 'click');

    if (item.product._id) {
      navigation.navigate('ProductDetail', {
        productId: item.product._id,
        recommendationRequestId: recommendationRequestId ?? undefined,
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StorefrontHeader
        onMenuPress={() => setIsCategoryDrawerVisible(true)}
        menuIcon="filter-variant"
        menuAccessibilityLabel="Mở bộ lọc sản phẩm"
        isAuthenticated={isAuthenticated}
        onAccountPress={() => navigation.navigate('Login')}
        onFavoritesPress={() => navigation.navigate(isAuthenticated ? 'Favorites' : 'Login')}
        onCartPress={() => navigation.navigate(isAuthenticated ? 'Cart' : 'Login')}
        onSearchSubmit={handleSearchSubmit}
        onSearchFocus={() => navigation.navigate('Search')}
        cartBadgeCount={notificationSummary?.cartItems ?? 0}
      />
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={checkRecommendationVisibility}
        scrollEventThrottle={100}
      >
        <TouchableOpacity
          onPress={() => navigateToProductList({ title: 'Khám phá gu riêng' })}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Khám phá thời trang sang trọng"
        >
          <Image
            source={homeDiscoverHeroImage}
            style={styles.hero}
            resizeMode="cover"
          />
        </TouchableOpacity>

        <View style={styles.featureStack}>
          <FeatureCard
            title="Phòng thử đồ"
            description="Trải nghiệm thử đồ ảo ngay tại nhà"
            icon="hanger"
            imageSource={virtualTryOnFeatureImage}
            onPress={() => navigation.navigate(isAuthenticated ? 'VirtualTryOnHome' : 'Login')}
          />
        </View>

        <ProductSection
          title="Sản phẩm bán chạy"
          products={bestSellers}
          isLoading={isProductLoading}
          error={bestSellerError}
          onRetry={loadHomeProducts}
          onViewMore={() => navigateToProductList({
            title: 'Sản phẩm bán chạy',
            sort: 'best_seller',
            discoveryEntry: 'products',
          })}
          onProductPress={handleProductPress}
          onCartPress={handleCartPress}
        />

        <RecommendationRail
          title="Dành cho bạn"
          subtitle={isAuthenticated ? 'Dựa trên những sản phẩm bạn đã quan tâm' : 'Những lựa chọn đang được yêu thích'}
          items={recommendationItems}
          isLoading={isProductLoading}
          error={recommendationError}
          onRetry={loadHomeProducts}
          trackingRef={recommendationSectionRef}
          onViewableItemsChanged={handleRecommendationViewableItemsChanged}
          onProductPress={handleRecommendationProductPress}
        />

        <View style={styles.footerGap}>
          <StorefrontFooter />
        </View>
      </ScrollView>

      <CategoryDrawer
        visible={isCategoryDrawerVisible}
        categories={categories}
        isLoading={isCategoryLoading}
        onClose={() => setIsCategoryDrawerVisible(false)}
        onSelectAll={() => navigateToProductList({ title: 'Tất cả sản phẩm' })}
        onSelectGender={handleGenderSelect}
        onSelectCategory={handleCategorySelect}
      />
      <StorefrontBottomNav activeTab="home" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.brand,
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  hero: {
    width: '100%',
    height: 138,
    backgroundColor: colors.brandLight,
  },
  featureStack: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    gap: spacing.lg,
    backgroundColor: colors.background,
  },
  footerGap: {
    paddingTop: spacing.xxl,
    backgroundColor: colors.background,
  },
});

export default HomeScreen;
