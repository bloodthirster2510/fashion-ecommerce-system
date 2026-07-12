import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { useRecommendationImpressions } from '../recommendation/useRecommendationImpressions';
import CategoryDrawer from './components/CategoryDrawer';
import CategoryRail, { CategoryRailItem } from './components/CategoryRail';
import FeatureCard from './components/FeatureCard';
import ProductSection from './components/ProductSection';
import { useCustomerNotifications } from '../notifications/CustomerNotificationProvider';

type HomeNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

const virtualTryOnFeatureImage = require('../../../assets/virtual-try-on/hero-studio.jpg');

const HomeScreen = () => {
  const navigation = useNavigation<HomeNavigationProp>();
  const { isAuthenticated, session, runWithAuth } = useAuth();
  const { summary: notificationSummary, refresh: refreshNotifications } = useCustomerNotifications();
  const [isCategoryDrawerVisible, setIsCategoryDrawerVisible] = React.useState(false);
  const [categories, setCategories] = React.useState<CatalogCategory[]>([]);
  const [isCategoryLoading, setIsCategoryLoading] = React.useState(false);
  const [bestSellers, setBestSellers] = React.useState<CatalogProduct[]>([]);
  const [recommendations, setRecommendations] = React.useState<CatalogProduct[]>([]);
  const [recommendationItems, setRecommendationItems] = React.useState<RecommendationItem[]>([]);
  const [recommendationRequestId, setRecommendationRequestId] = React.useState<string | null>(null);
  const [recommendationAlgorithmVersion, setRecommendationAlgorithmVersion] = React.useState<string>();
  const [isProductLoading, setIsProductLoading] = React.useState(true);
  const [bestSellerError, setBestSellerError] = React.useState<string | null>(null);
  const [recommendationError, setRecommendationError] = React.useState<string | null>(null);

  const availableCategoryGenders = React.useMemo(
    () => new Set(categories.map((category) => category.gender)),
    [categories],
  );

  const shouldShowGenderShortcut = React.useCallback(
    (gender: CatalogGender) =>
      categories.length ? availableCategoryGenders.has(gender) : gender !== 'unisex',
    [availableCategoryGenders, categories.length],
  );

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
  } = useRecommendationImpressions({
    requestId: recommendationRequestId,
    items: recommendationItems,
    onImpression: (item) => recordRecommendationEvent(item, 'impression'),
  });

  const loadCategories = React.useCallback(() => {
    let isCurrentRequest = true;

    setIsCategoryLoading(true);
    catalogApi
      .getCategories()
      .then((items) => {
        if (isCurrentRequest) {
          setCategories(items);
        }
      })
      .catch(() => {
        if (isCurrentRequest) {
          setCategories([]);
        }
      })
      .finally(() => {
        if (isCurrentRequest) {
          setIsCategoryLoading(false);
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, []);

  const loadHomeProducts = React.useCallback(() => {
    let isCurrentRequest = true;

    setIsProductLoading(true);
    setBestSellerError(null);
    setRecommendationError(null);
    setRecommendationItems([]);
    setRecommendationRequestId(null);
    setRecommendationAlgorithmVersion(undefined);

    const recommendationPromise = isAuthenticated
      ? runWithAuth((accessToken) => recommendationApi.getPersonalRecommendations(4, accessToken))
      : recommendationApi.getPersonalRecommendations(4);

    Promise.allSettled([catalogApi.getBestSellers(4), recommendationPromise])
      .then(([bestSellerResult, recommendationResult]) => {
        if (!isCurrentRequest) return;

        if (bestSellerResult.status === 'fulfilled') {
          setBestSellers(bestSellerResult.value.items);
        } else {
          setBestSellers([]);
          setBestSellerError('Không tải được sản phẩm bán chạy');
        }

        if (recommendationResult.status === 'fulfilled') {
          setRecommendationItems(recommendationResult.value.items);
          setRecommendationRequestId(recommendationResult.value.requestId);
          setRecommendationAlgorithmVersion(recommendationResult.value.algorithmVersion);
          setRecommendations(recommendationResult.value.items.map((item) => item.product));
        } else {
          setRecommendationItems([]);
          setRecommendationRequestId(null);
          setRecommendationAlgorithmVersion(undefined);
          setRecommendations([]);
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
    };
  }, [isAuthenticated, runWithAuth]);

  React.useEffect(() => loadCategories(), [loadCategories]);
  React.useEffect(() => loadHomeProducts(), [loadHomeProducts]);
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

  const quickLinks = React.useMemo<CategoryRailItem[]>(
    () => [
      {
        id: 'all',
        label: 'Tất cả',
        icon: 'view-grid-outline',
        isPrimary: true,
        onPress: () => navigateToProductList({ title: 'Tất cả sản phẩm' }),
      },
      {
        id: 'male',
        label: 'Nam',
        icon: 'gender-male',
        onPress: () => handleGenderSelect('male'),
      },
      {
        id: 'female',
        label: 'Nữ',
        icon: 'gender-female',
        onPress: () => handleGenderSelect('female'),
      },
      ...(shouldShowGenderShortcut('unisex')
        ? [
            {
              id: 'unisex',
              label: 'Unisex',
              icon: 'gender-male-female' as const,
              onPress: () => handleGenderSelect('unisex'),
            },
          ]
        : []),
      {
        id: 'new',
        label: 'Hàng mới',
        icon: 'new-box',
        onPress: () => navigateToProductList({ title: 'Hàng mới', isNew: true, sort: 'newest' }),
      },
      {
        id: 'sale',
        label: 'Đang sale',
        icon: 'sale',
        onPress: () => navigateToProductList({ title: 'Đang sale', isSale: true, sort: 'newest' }),
      },
      {
        id: 'best-seller',
        label: 'Bán chạy',
        icon: 'fire',
        onPress: () => navigateToProductList({ title: 'Bán chạy', sort: 'best_seller' }),
      },
      {
        id: 'polo',
        label: 'Áo polo',
        icon: 'tshirt-crew-outline',
        onPress: () => navigateToProductList({ title: 'Áo polo', keyword: 'Áo polo' }),
      },
      {
        id: 'dress-pants',
        label: 'Quần âu',
        icon: 'briefcase-outline',
        onPress: () => navigateToProductList({ title: 'Quần âu', keyword: 'Quần âu' }),
      },
      {
        id: 'sport',
        label: 'Thể thao',
        icon: 'run',
        onPress: () => navigateToProductList({ title: 'Đồ thể thao', keyword: 'thể thao' }),
      },
    ],
    [navigation, shouldShowGenderShortcut],
  );

  const handleSearchSubmit = (keyword: string) => {
    recordInteraction({
      actionType: 'search',
      source: 'search',
      metadata: { keyword },
    });

    navigation.navigate('ProductList', {
      title: `Tìm kiếm: ${keyword}`,
      keyword,
    });
  };

  const handleComingSoon = (title: string) => {
    Alert.alert(title, 'Tính năng này sẽ được bổ sung khi backend tương ứng hoàn thiện.');
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

  const handleRecommendationProductPress = (product: CatalogProduct) => {
    const item = recommendationItems.find((recommendationItem) => recommendationItem.product._id === product._id);

    if (item) {
      recordRecommendationEvent(item, 'click');
    }

    if (product._id) {
      navigation.navigate('ProductDetail', {
        productId: product._id,
        recommendationRequestId: recommendationRequestId ?? undefined,
      });
    }
  };

  const handleRecommendationCartPress = (product: CatalogProduct) => {
    const item = recommendationItems.find((recommendationItem) => recommendationItem.product._id === product._id);

    if (item) {
      recordRecommendationEvent(item, 'click');
    }

    handleCartPress(product);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StorefrontHeader
        onMenuPress={() => setIsCategoryDrawerVisible(true)}
        menuIcon="filter-variant"
        menuAccessibilityLabel="Mở bộ lọc sản phẩm"
        onProfilePress={() => navigation.navigate(isAuthenticated ? 'Profile' : 'Login')}
        onFavoritesPress={() => navigation.navigate(isAuthenticated ? 'Favorites' : 'Login')}
        onSearchSubmit={handleSearchSubmit}
        onSearchFocus={() => navigation.navigate('Search')}
        onImageSearchPress={() => handleComingSoon('Tìm kiếm bằng hình ảnh')}
        isAuthenticated={isAuthenticated}
        userName={session?.user.name}
        avatarImage={session?.user.avatarImage}
        profileBadgeCount={notificationSummary?.total ?? 0}
      />
      <CategoryRail
        visible
        items={quickLinks}
      />
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={checkRecommendationVisibility}
        scrollEventThrottle={100}
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>FASHIONISTA</Text>
          <Text style={styles.heroSubtitle}>Phong cách thời trang hiện đại</Text>
        </View>

        <View style={styles.featureStack}>
          <FeatureCard
            title="Phòng thử đồ"
            description="Trải nghiệm thử đồ ảo ngay tại nhà"
            icon="hanger"
            imageSource={virtualTryOnFeatureImage}
            onPress={() => navigation.navigate(isAuthenticated ? 'VirtualTryOnHome' : 'Login')}
          />
          <FeatureCard
            title="Tìm kiếm sản phẩm bằng hình ảnh"
            description="Chụp hoặc tải ảnh lên để tìm sản phẩm tương tự"
            icon="camera-iris"
            supportingIcons={['filter-variant']}
            onPress={() => handleComingSoon('Tìm kiếm bằng hình ảnh')}
          />
        </View>

        <ProductSection
          title="Sản phẩm bán chạy"
          products={bestSellers}
          isLoading={isProductLoading}
          error={bestSellerError}
          onRetry={loadHomeProducts}
          onViewMore={() => navigateToProductList({ title: 'Sản phẩm bán chạy', sort: 'best_seller' })}
          onProductPress={handleProductPress}
          onCartPress={handleCartPress}
        />

        <View ref={recommendationSectionRef} collapsable={false}>
        <ProductSection
          title="Bạn cũng có thể thích"
          products={recommendations}
          isLoading={isProductLoading}
          error={recommendationError}
          onRetry={loadHomeProducts}
          onViewMore={() => navigateToProductList({ title: 'Bạn cũng có thể thích', sort: 'newest' })}
          onProductPress={handleRecommendationProductPress}
          onCartPress={handleRecommendationCartPress}
        />
        </View>

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
    minHeight: 138,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  heroTitle: {
    color: colors.white,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  heroSubtitle: {
    color: colors.white,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.sm,
    textAlign: 'center',
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
