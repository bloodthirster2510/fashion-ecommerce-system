import React from 'react';
import {
  ActivityIndicator,
  Image,
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
import { colors, radii, spacing } from '../../theme';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useSuggest } from './useSuggest';
import {
  addSearchHistory,
  clearSearchHistory,
  getSearchHistory,
  removeSearchHistory,
} from './searchHistory';
import { useAuth } from '../auth/AuthContext';
import {
  interactionApi,
  type InteractionPayload,
} from '../recommendation/interactionApi';

type SearchNavigationProp = StackNavigationProp<RootStackParamList, 'Search'>;

const formatCurrency = (value: number) =>
  `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;

const isRemoteImage = (value?: string | null) => Boolean(value && /^https?:\/\//i.test(value.trim()));

const normalizeSearchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi-VN')
    .trim()
    .replace(/\s+/g, ' ');

const mergeSuggestions = (primary: string[], secondary: string[], limit = 10) => {
  const seen = new Set<string>();
  const merged: string[] = [];

  [...primary, ...secondary].forEach((item) => {
    const trimmed = item.trim();
    const key = normalizeSearchText(trimmed);
    if (!trimmed || seen.has(key)) return;

    seen.add(key);
    merged.push(trimmed);
  });

  return merged.slice(0, limit);
};

const SearchScreen = () => {
  const navigation = useNavigation<SearchNavigationProp>();
  const { isAuthenticated, runWithAuth } = useAuth();
  const [query, setQuery] = React.useState('');
  const [history, setHistory] = React.useState<string[]>([]);
  const inputRef = React.useRef<TextInput>(null);

  React.useEffect(() => {
    void getSearchHistory().then(setHistory);
    setTimeout(() => inputRef.current?.focus(), 150);
  }, []);

  const { result, isLoading } = useSuggest(query);

  const recordInteraction = React.useCallback((payload: InteractionPayload) => {
    if (isAuthenticated) {
      void runWithAuth((accessToken) =>
        interactionApi.recordInteraction(payload, accessToken)).catch(() => undefined);
      return;
    }

    void interactionApi.recordInteraction(payload).catch(() => undefined);
  }, [isAuthenticated, runWithAuth]);

  const handleSearch = async (keyword: string) => {
    const trimmed = keyword.trim();
    if (!trimmed) return;
    await addSearchHistory(trimmed);
    navigation.navigate('ProductList', { title: `Tìm kiếm: ${trimmed}`, keyword: trimmed });
  };

  const handleHistoryRemove = async (keyword: string) => {
    await removeSearchHistory(keyword);
    setHistory(await getSearchHistory());
  };

  const handleHistoryClear = async () => {
    await clearSearchHistory();
    setHistory([]);
  };

  const hasQuery = query.trim().length >= 2;
  const showSuggestions = hasQuery && (result || isLoading);
  const showHistory = !hasQuery && history.length > 0;
  const historySuggestions = React.useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    if (normalizedQuery.length < 2) return [];

    return history.filter((keyword) => normalizeSearchText(keyword).startsWith(normalizedQuery));
  }, [history, query]);
  const keywordSuggestions = React.useMemo(
    () => mergeSuggestions(historySuggestions, result?.keywords ?? []),
    [historySuggestions, result?.keywords],
  );

  const renderProductItem = (product: { _id: string; name: string; image: string; finalPrice: number; brandName?: string }) => (
    <TouchableOpacity
      key={product._id}
      style={styles.productRow}
      onPress={() => {
        recordInteraction({
          productId: product._id,
          actionType: 'search_result_click',
          source: 'search',
          metadata: {
            keyword: query.trim(),
            surface: 'search_suggestions',
          },
        });
        navigation.navigate('ProductDetail', { productId: product._id });
      }}
      activeOpacity={0.82}
    >
      <View style={styles.productImageWrap}>
        {isRemoteImage(product.image) ? (
          <Image source={{ uri: product.image }} style={styles.productImage} />
        ) : (
          <MaterialCommunityIcons name="image-outline" size={22} color={colors.textSubtle} />
        )}
      </View>
      <View style={styles.productCopy}>
        <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
        {product.brandName ? <Text style={styles.productBrand}>{product.brandName}</Text> : null}
        <Text style={styles.productPrice}>{formatCurrency(product.finalPrice)}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderCategoryItem = (category: { _id: string; name: string; gender: string }) => {
    const genderLabel = category.gender === 'male' ? 'Nam' : category.gender === 'female' ? 'Nữ' : 'Unisex';
    return (
      <TouchableOpacity
        key={category._id}
        style={styles.categoryRow}
        onPress={() => navigation.navigate('ProductList', { title: category.name, categoryId: category._id })}
        activeOpacity={0.82}
      >
        <View style={styles.categoryIcon}>
          <MaterialCommunityIcons name="folder-outline" size={20} color={colors.brand} />
        </View>
        <Text style={styles.categoryName}>{category.name}</Text>
        <Text style={styles.categoryGender}>{genderLabel}</Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  const renderKeywordItem = (keyword: string) => {
    const isHistoryKeyword = historySuggestions.some(
      (historyKeyword) => normalizeSearchText(historyKeyword) === normalizeSearchText(keyword),
    );

    return (
    <TouchableOpacity
      key={keyword}
      style={styles.keywordRow}
      onPress={() => {
        setQuery(keyword);
        void handleSearch(keyword);
      }}
      activeOpacity={0.82}
    >
      <View style={styles.keywordIcon}>
        <MaterialCommunityIcons name={isHistoryKeyword ? 'history' : 'magnify'} size={17} color={colors.brand} />
      </View>
      <Text style={styles.keywordText} numberOfLines={1}>{keyword}</Text>
      <MaterialCommunityIcons name="arrow-top-left" size={18} color={colors.textMuted} />
    </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
          activeOpacity={0.82}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Bạn tìm gì hôm nay?"
            placeholderTextColor={colors.textSubtle}
            returnKeyType="search"
            onSubmitEditing={() => handleSearch(query)}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.82}>
              <MaterialCommunityIcons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {showHistory ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Lịch sử tìm kiếm</Text>
              <TouchableOpacity onPress={handleHistoryClear} activeOpacity={0.82}>
                <Text style={styles.clearText}>Xóa tất cả</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.chipRow}>
              {history.map((keyword) => (
                <TouchableOpacity
                  key={keyword}
                  style={styles.chip}
                  onPress={() => {
                    setQuery(keyword);
                    void handleSearch(keyword);
                  }}
                  activeOpacity={0.82}
                >
                  <Text style={styles.chipText} numberOfLines={1}>{keyword}</Text>
                  <MaterialCommunityIcons
                    name="close"
                    size={14}
                    color={colors.textMuted}
                    onPress={() => handleHistoryRemove(keyword)}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        {showSuggestions && isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.brand} size="small" />
            <Text style={styles.loadingText}>Đang gợi ý...</Text>
          </View>
        ) : null}

        {showSuggestions && result ? (
          <>
            {keywordSuggestions.length > 0 ? (
              <View style={styles.suggestionPanel}>
                <Text style={styles.suggestionTitle}>Gợi ý tìm kiếm</Text>
                <View style={styles.keywordList}>
                  {keywordSuggestions.map(renderKeywordItem)}
                </View>
              </View>
            ) : null}

            {result.products.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Sản phẩm nổi bật</Text>
                <View style={styles.productList}>
                  {result.products.slice(0, 3).map(renderProductItem)}
                </View>
              </View>
            ) : null}

            {result.categories.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Danh mục</Text>
                <View style={styles.categoryList}>
                  {result.categories.map(renderCategoryItem)}
                </View>
              </View>
            ) : null}

            {result.products.length === 0 && result.categories.length === 0 && keywordSuggestions.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="magnify-close" size={32} color={colors.brand} />
                <Text style={styles.emptyTitle}>Chưa có gợi ý phù hợp</Text>
                <Text style={styles.emptyText}>Bạn thử từ khóa khác hoặc ngắn hơn nhé.</Text>
              </View>
            ) : null}
          </>
        ) : null}

        {!hasQuery && history.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="magnify" size={32} color={colors.brand} />
            <Text style={styles.emptyTitle}>Tìm sản phẩm bạn thích</Text>
            <Text style={styles.emptyText}>Gõ tên sản phẩm, danh mục hoặc chất liệu vải để xem gợi ý.</Text>
          </View>
        ) : null}

        {hasQuery && !isLoading && !result ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="magnify" size={32} color={colors.brand} />
            <Text style={styles.emptyTitle}>Nhấn tìm kiếm</Text>
            <Text style={styles.emptyText}>Gõ thêm ký tự hoặc nhấn Enter để tìm "{query.trim()}".</Text>
            <TouchableOpacity style={styles.searchButton} onPress={() => handleSearch(query)} activeOpacity={0.82}>
              <Text style={styles.searchButtonText}>Tìm "{query.trim()}"</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 0,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  clearText: {
    color: colors.brand,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    maxWidth: 140,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  suggestionPanel: {
    marginBottom: spacing.xl,
    borderRadius: radii.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  suggestionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  keywordList: {
    backgroundColor: colors.white,
  },
  productList: {
    gap: spacing.sm,
  },
  productRow: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productImageWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.xs,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  productCopy: {
    flex: 1,
    gap: 2,
    justifyContent: 'center',
  },
  productName: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  productBrand: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  productPrice: {
    color: colors.brand,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  categoryList: {
    gap: spacing.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  categoryGender: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  keywordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  keywordIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keywordText: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    textAlign: 'center',
  },
  searchButton: {
    marginTop: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  searchButtonText: {
    color: colors.white,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
});

export default SearchScreen;
