import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useStaleFocusEffect } from '../../hooks/useStaleFocusEffect';
import { RemoteImage } from '../../components/media/RemoteImage';
import { brandedHeaderStyles, colors, radii, shadows, spacing } from '../../theme';
import { useAuth } from '../auth/AuthContext';
import { FavoriteProduct, favoritesApi } from './favoritesApi';

type FavoritesNavigationProp = StackNavigationProp<RootStackParamList, 'Favorites'>;

const FAVORITE_PAGE_LIMIT = 10;

const formatCurrency = (value: number) =>
  `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;

const isRemoteImage = (value?: string | null) => Boolean(value && /^https?:\/\//i.test(value.trim()));

const formatFavoriteDate = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1)
    .toString()
    .padStart(2, '0')}/${date.getFullYear()}`;
};

const FavoritesScreen = () => {
  const navigation = useNavigation<FavoritesNavigationProp>();
  const { isAuthenticated, session, runWithAuth } = useAuth();
  const [items, setItems] = React.useState<FavoriteProduct[]>([]);
  const [keyword, setKeyword] = React.useState('');
  const [submittedKeyword, setSubmittedKeyword] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pagination, setPagination] = React.useState({
    page: 1,
    limit: FAVORITE_PAGE_LIMIT,
    totalItems: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [removingProductIds, setRemovingProductIds] = React.useState<Set<string>>(() => new Set());
  const requestSequenceRef = React.useRef(0);
  const removingProductIdsRef = React.useRef(new Set<string>());
  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      requestSequenceRef.current += 1;
      removingProductIdsRef.current.clear();
    };
  }, []);

  const loadFavorites = React.useCallback(
    async (silent = false) => {
      const requestSequence = requestSequenceRef.current + 1;
      requestSequenceRef.current = requestSequence;

      if (!isAuthenticated || !session?.accessToken) {
        setItems([]);
        setPagination({
          page: 1,
          limit: FAVORITE_PAGE_LIMIT,
          totalItems: 0,
          totalPages: 0,
        });
        setError(null);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const response = await runWithAuth((accessToken) =>
          favoritesApi.getFavorites(accessToken, {
            keyword: submittedKeyword,
            page,
            limit: FAVORITE_PAGE_LIMIT,
            sort: 'favorited_desc',
          }),
        );
        if (requestSequenceRef.current !== requestSequence) return;
        setItems(response.items);
        setPagination(response.pagination);
        setPage((currentPage) => (
          currentPage === response.pagination.page ? currentPage : response.pagination.page
        ));
      } catch (loadError) {
        if (requestSequenceRef.current !== requestSequence) return;
        const message = loadError instanceof Error ? loadError.message : 'Không thể tải danh sách yêu thích';
        if (silent) {
          Alert.alert('Chưa tải được yêu thích', message);
        } else {
          setError(message);
        }
      } finally {
        if (requestSequenceRef.current === requestSequence) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [isAuthenticated, page, runWithAuth, session?.accessToken, submittedKeyword],
  );

  useStaleFocusEffect(
    () => {
      void loadFavorites();
    },
    [loadFavorites],
    { staleMs: 30 * 1000, runOnDepsChange: true },
  );

  const handleSearchSubmit = () => {
    setPage(1);
    setSubmittedKeyword(keyword.trim());
  };

  const handleClearSearch = () => {
    setKeyword('');
    setSubmittedKeyword('');
    setPage(1);
  };

  const handleRemoveFavorite = async (product: FavoriteProduct) => {
    if (removingProductIdsRef.current.has(product._id)) {
      return;
    }

    removingProductIdsRef.current.add(product._id);
    setRemovingProductIds(new Set(removingProductIdsRef.current));

    try {
      await runWithAuth((accessToken) => favoritesApi.removeFavorite(accessToken, product._id));

      if (items.length === 1 && page > 1) {
        setPage((currentPage) => Math.max(currentPage - 1, 1));
      } else {
        await loadFavorites(true);
      }
    } catch (removeError) {
      Alert.alert(
        'Chưa xoá được yêu thích',
        removeError instanceof Error ? removeError.message : 'Bạn thử lại sau nha.',
      );
    } finally {
      removingProductIdsRef.current.delete(product._id);
      if (isMountedRef.current) {
        setRemovingProductIds(new Set(removingProductIdsRef.current));
      }
    }
  };

  const handleProductPress = (product: FavoriteProduct) => {
    navigation.navigate('ProductDetail', { productId: product._id });
  };

  const renderProductCard = React.useCallback(
    ({ item: product }: { item: FavoriteProduct }) => {
      const imageUri = isRemoteImage(product.image) ? product.image.trim() : '';
      const originalPrice = product.originalPrice ?? product.price;
      const isRemoving = removingProductIds.has(product._id);
      const favoritedDate = formatFavoriteDate(product.favoritedAt);

      return (
        <TouchableOpacity
          style={styles.card}
          onPress={() => handleProductPress(product)}
          activeOpacity={0.86}
          accessibilityLabel={`Xem ${product.name}`}
      >
        <View style={styles.imageWrap}>
          {imageUri ? (
            <RemoteImage uri={imageUri} style={styles.image} recyclingKey={product._id} />
          ) : (
            <View style={styles.placeholder}>
              <MaterialCommunityIcons name="tshirt-crew-outline" size={34} color={colors.brand} />
            </View>
          )}

          <TouchableOpacity
            style={styles.heartButton}
            onPress={(event) => {
              event.stopPropagation();
              void handleRemoveFavorite(product);
            }}
            disabled={isRemoving}
            activeOpacity={0.82}
            accessibilityLabel={`Bỏ yêu thích ${product.name}`}
          >
            {isRemoving ? (
              <ActivityIndicator size="small" color={colors.coral} />
            ) : (
              <MaterialCommunityIcons name="heart" size={20} color={colors.coral} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {product.name}
          </Text>

          <Text style={styles.productMeta} numberOfLines={1}>
            {product.brand?.name ?? 'FASHIONISTA'}{product.category ? ` • ${product.category.name}` : ''}
          </Text>

          <View style={styles.priceRow}>
            <View style={styles.priceCopy}>
              <Text style={styles.price}>{formatCurrency(product.finalPrice)}</Text>
              {product.isSale ? (
                <Text style={styles.originalPrice}>{formatCurrency(originalPrice)}</Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={[styles.cartButton, !product.isAvailable && styles.cartButtonDisabled]}
              onPress={(event) => {
                event.stopPropagation();
                handleProductPress(product);
              }}
              disabled={!product.isAvailable}
              activeOpacity={0.82}
              accessibilityLabel={`Mua ${product.name}`}
            >
              <MaterialCommunityIcons name="cart-outline" size={18} color={colors.white} />
            </TouchableOpacity>
          </View>

          <View style={styles.cardFooter}>
            <View style={styles.ratingRow}>
              <MaterialCommunityIcons name="star" size={13} color={colors.goldDark} />
              <Text style={styles.footerText}>{product.averageRating.toFixed(1)}</Text>
            </View>
            {favoritedDate ? <Text style={styles.footerText}>Lưu {favoritedDate}</Text> : null}
          </View>
        </View>
      </TouchableOpacity>
    );
    },
    [handleProductPress, removingProductIds],
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.headerButton}
        onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
        activeOpacity={0.82}
        accessibilityLabel="Trở về"
      >
        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.white} />
      </TouchableOpacity>
      <View style={styles.headerTitleBlock}>
        <Text style={styles.headerTitle}>Sản phẩm yêu thích</Text>
      </View>
      <TouchableOpacity
        style={styles.headerButton}
        onPress={() => navigation.navigate('Cart', { selectionSource: 'normal' })}
        activeOpacity={0.82}
        accessibilityLabel="Giỏ hàng"
      >
        <MaterialCommunityIcons name="shopping-outline" size={23} color={colors.white} />
      </TouchableOpacity>
    </View>
  );

  const renderLoggedOutState = () => (
    <View style={styles.centerState}>
      <MaterialCommunityIcons name="heart-outline" size={42} color={colors.brand} />
      <Text style={styles.stateTitle}>Đăng nhập để lưu món bạn thích</Text>
      <Text style={styles.stateText}>Danh sách yêu thích được lưu theo tài khoản để bạn xem lại trên mọi thiết bị.</Text>
      <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Login')} activeOpacity={0.82}>
        <Text style={styles.primaryButtonText}>Đăng nhập</Text>
      </TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    if (!isAuthenticated) {
      return renderLoggedOutState();
    }

    if (isLoading) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.stateText}>Đang tải danh sách yêu thích</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerState}>
          <MaterialCommunityIcons name="alert-circle-outline" size={36} color={colors.danger} />
          <Text style={styles.stateTitle}>Chưa tải được yêu thích</Text>
          <Text style={styles.stateText}>{error}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => loadFavorites()} activeOpacity={0.82}>
            <Text style={styles.primaryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadFavorites(true)} />}
      >
        <View style={styles.searchPanel}>
          <View style={styles.searchRow}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
            <TextInput
              value={keyword}
              onChangeText={setKeyword}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
              placeholder="Tìm trong yêu thích"
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
            />
            {keyword || submittedKeyword ? (
              <TouchableOpacity onPress={handleClearSearch} activeOpacity={0.82} accessibilityLabel="Xoá tìm kiếm">
                <MaterialCommunityIcons name="close-circle" size={19} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          <Text style={styles.summaryText}>
            {pagination.totalItems} sản phẩm đã lưu{submittedKeyword ? ` cho "${submittedKeyword}"` : ''}
          </Text>
        </View>

        {items.length ? (
          <>
            <FlatList
              data={items}
              keyExtractor={(item) => item._id}
              renderItem={renderProductCard}
              numColumns={2}
              columnWrapperStyle={styles.grid}
              contentContainerStyle={styles.gridContent}
              scrollEnabled={false}
              initialNumToRender={8}
              maxToRenderPerBatch={8}
              windowSize={5}
            />

            {pagination.totalPages > 1 ? (
              <View style={styles.pagination}>
                <TouchableOpacity
                  style={[styles.pageButton, page === 1 && styles.pageButtonDisabled]}
                  onPress={() => setPage((currentPage) => Math.max(currentPage - 1, 1))}
                  disabled={page === 1}
                  activeOpacity={0.82}
                >
                  <MaterialCommunityIcons
                    name="chevron-left"
                    size={18}
                    color={page === 1 ? colors.textSubtle : colors.brand}
                  />
                  <Text style={[styles.pageButtonText, page === 1 && styles.pageButtonTextDisabled]}>Trước</Text>
                </TouchableOpacity>

                <Text style={styles.pageInfo}>
                  {page}/{pagination.totalPages}
                </Text>

                <TouchableOpacity
                  style={[styles.pageButton, page >= pagination.totalPages && styles.pageButtonDisabled]}
                  onPress={() => setPage((currentPage) => Math.min(currentPage + 1, pagination.totalPages))}
                  disabled={page >= pagination.totalPages}
                  activeOpacity={0.82}
                >
                  <Text style={[styles.pageButtonText, page >= pagination.totalPages && styles.pageButtonTextDisabled]}>
                    Sau
                  </Text>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={18}
                    color={page >= pagination.totalPages ? colors.textSubtle : colors.brand}
                  />
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name={submittedKeyword ? 'magnify-close' : 'heart-off-outline'}
              size={42}
              color={colors.brand}
            />
            <Text style={styles.stateTitle}>
              {submittedKeyword ? 'Không tìm thấy món đã lưu' : 'Chưa có sản phẩm yêu thích'}
            </Text>
            <Text style={styles.stateText}>
              {submittedKeyword
                ? 'Bạn thử đổi từ khoá hoặc xoá tìm kiếm để xem toàn bộ danh sách.'
                : 'Khi thấy món hợp gu, bấm tim ở chi tiết sản phẩm để lưu lại tại đây.'}
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => (submittedKeyword ? handleClearSearch() : navigation.navigate('ProductList'))}
              activeOpacity={0.82}
            >
              <Text style={styles.primaryButtonText}>{submittedKeyword ? 'Xoá tìm kiếm' : 'Khám phá sản phẩm'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {renderHeader()}
      {renderContent()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    ...brandedHeaderStyles.container,
  },
  headerButton: {
    ...brandedHeaderStyles.action,
  },
  headerTitleBlock: {
    ...brandedHeaderStyles.titleGroup,
    alignItems: 'center',
  },
  headerBrand: {
    color: colors.brandMist,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  headerTitle: {
    ...brandedHeaderStyles.title,
    marginTop: 0,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  searchPanel: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  searchRow: {
    minHeight: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    minHeight: 42,
    paddingVertical: 0,
    color: colors.text,
    fontSize: 14,
  },
  summaryText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  grid: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  gridContent: {
    paddingBottom: spacing.md,
  },
  card: {
    flex: 1,
    minWidth: 0,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadows.card,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.brandSoft,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandPale,
  },
  heartButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    minHeight: 138,
    padding: spacing.md,
    gap: spacing.sm,
  },
  productName: {
    minHeight: 36,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  productMeta: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  priceRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  priceCopy: {
    flex: 1,
    minWidth: 0,
  },
  price: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  originalPrice: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    textDecorationLine: 'line-through',
    marginTop: 1,
  },
  cartButton: {
    width: 34,
    height: 34,
    borderRadius: radii.xs,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  cardFooter: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  emptyState: {
    minHeight: 260,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    marginTop: spacing.sm,
  },
  stateTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: spacing.md,
  },
  stateText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  primaryButton: {
    minHeight: 40,
    borderRadius: radii.xs,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  pagination: {
    marginTop: spacing.xl,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageButton: {
    minWidth: 86,
    height: 38,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageButtonDisabled: {
    backgroundColor: colors.field,
  },
  pageButtonText: {
    color: colors.brand,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  pageButtonTextDisabled: {
    color: colors.textSubtle,
  },
  pageInfo: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
});

export default FavoritesScreen;
