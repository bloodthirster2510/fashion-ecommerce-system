import React from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { RemoteImage } from '../../components/media/RemoteImage';
import { colors, radii, shadows, spacing } from '../../theme';
import { catalogApi, type CatalogProduct, type CatalogProductDetail } from '../catalog/catalogApi';
import { useAuth } from '../auth/AuthContext';
import { virtualTryOnApi } from './virtualTryOnApi';
import type { TryOnContextPreset, TryOnItemRole, TryOnOutfitMode, TryOnSelectedItem } from './virtualTryOn.types';

type NavigationProp = StackNavigationProp<RootStackParamList, 'VirtualTryOnBuilder'>;
type RouteProps = RouteProp<RootStackParamList, 'VirtualTryOnBuilder'>;

const formatPrice = (value: number) =>
  `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;

const outfitModes: Array<{ key: TryOnOutfitMode; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
  { key: 'single', label: 'Một món', icon: 'tshirt-crew-outline' },
  { key: 'top_bottom', label: 'Áo + quần', icon: 'human' },
  { key: 'full_set', label: 'Full set', icon: 'wardrobe-outline' },
];

const contextOptions: Array<{ key: TryOnContextPreset; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
  { key: 'none', label: 'Không đổi nền', icon: 'image-outline' },
  { key: 'work', label: 'Đi làm', icon: 'briefcase-outline' },
  { key: 'casual', label: 'Đi chơi', icon: 'party-popper' },
  { key: 'party', label: 'Dự tiệc', icon: 'glass-cocktail' },
  { key: 'travel', label: 'Du lịch', icon: 'airplane' },
  { key: 'sport', label: 'Thể thao', icon: 'run' },
  { key: 'date', label: 'Hẹn hò', icon: 'heart-outline' },
  { key: 'custom', label: 'Tự mô tả', icon: 'pencil-outline' },
];

const roleLabel: Record<TryOnItemRole, string> = {
  top: 'Áo',
  bottom: 'Quần',
  dress: 'Váy/đầm',
  shoes: 'Giày',
  accessory: 'Phụ kiện',
  outerwear: 'Áo khoác',
};

const inferRole = (product: CatalogProduct | CatalogProductDetail): TryOnItemRole => {
  const haystack = `${product.name} ${product.category?.name ?? ''}`.toLowerCase();
  if (haystack.includes('giày') || haystack.includes('dép') || haystack.includes('sandal')) return 'shoes';
  if (haystack.includes('quần') || haystack.includes('jean') || haystack.includes('short')) return 'bottom';
  if (haystack.includes('váy') || haystack.includes('đầm') || haystack.includes('dress')) return 'dress';
  if (haystack.includes('khoác') || haystack.includes('blazer') || haystack.includes('jacket')) return 'outerwear';
  if (haystack.includes('túi') || haystack.includes('mũ') || haystack.includes('nón') || haystack.includes('phụ kiện')) return 'accessory';
  return 'top';
};

const resolveDefaultItem = (detail: CatalogProductDetail): TryOnSelectedItem | null => {
  const variant =
    detail.variants.find((item) => item.isActive && item.colors.length && item.sizes.some((size) => size.isAvailable)) ??
    detail.variants.find((item) => item.isActive && item.colors.length) ??
    detail.variants[0];
  const color = variant?.colors[0];

  if (!variant || !color) return null;

  const size =
    variant.sizes.find((item) => item.isAvailable)?.size ??
    variant.sizes[0]?.size;

  return {
    productId: detail._id,
    variantId: variant._id,
    colorVariantId: color._id,
    size,
    role: inferRole(detail),
    nameSnapshot: detail.name,
    colorSnapshot: color.color,
    imageSnapshot: color.image || detail.productImage,
    priceSnapshot: variant.originalPrice,
    finalPriceSnapshot: variant.finalPrice,
  };
};

const VirtualTryOnBuilderScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { runWithAuth } = useAuth();
  const [products, setProducts] = React.useState<CatalogProduct[]>([]);
  const [selectedItems, setSelectedItems] = React.useState<TryOnSelectedItem[]>([]);
  const [outfitMode, setOutfitMode] = React.useState<TryOnOutfitMode>('full_set');
  const [contextPreset, setContextPreset] = React.useState<TryOnContextPreset>('none');
  const [contextPrompt, setContextPrompt] = React.useState('');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectingProductId, setSelectingProductId] = React.useState<string | null>(null);

  const sourceAssetId = route.params?.assetId;
  const sourceImageUrl = route.params?.imageUrl;

  React.useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    catalogApi
      .getProducts({ page: 1, limit: 24, sort: 'newest' })
      .then((response) => {
        if (isCurrent) setProducts(response.items);
      })
      .catch(() => {
        if (isCurrent) Alert.alert('Sản phẩm', 'Không tải được danh sách sản phẩm.');
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => { isCurrent = false; };
  }, []);

  React.useEffect(() => {
    if (outfitMode === 'single' && selectedItems.length > 1) {
      setSelectedItems((current) => current.slice(0, 1));
    }
  }, [outfitMode, selectedItems.length]);

  const filteredProducts = React.useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return products;
    return products.filter((product) =>
      `${product.name} ${product.category?.name ?? ''} ${product.brand?.name ?? ''}`
        .toLowerCase()
        .includes(keyword),
    );
  }, [products, searchTerm]);

  const addSelectedItem = (item: TryOnSelectedItem) => {
    setSelectedItems((current) => {
      if (outfitMode === 'single') return [item];
      const withoutSameProduct = current.filter((entry) => entry.productId !== item.productId);
      const withoutSameRole = withoutSameProduct.filter((entry) => {
        if (item.role === 'accessory' || item.role === 'outerwear') return true;
        return entry.role !== item.role;
      });
      return [...withoutSameRole, item].slice(0, 4);
    });
  };

  const selectProduct = async (product: CatalogProduct) => {
    setSelectingProductId(product._id);
    try {
      const detail = await catalogApi.getProductById(product._id);
      const item = resolveDefaultItem(detail);
      if (!item) {
        Alert.alert('Sản phẩm', 'Sản phẩm này chưa có biến thể phù hợp để phối đồ.');
        return;
      }
      addSelectedItem(item);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không lấy được chi tiết sản phẩm.';
      Alert.alert('Sản phẩm', message);
    } finally {
      setSelectingProductId(null);
    }
  };

  const removeSelectedItem = (productId: string) => {
    setSelectedItems((current) => current.filter((item) => item.productId !== productId));
  };

  const createJob = async () => {
    if (!sourceAssetId) {
      Alert.alert('Ảnh của bạn', 'Bạn cần tải ảnh hoặc chụp ảnh trước.');
      navigation.navigate('VirtualTryOnHome');
      return;
    }

    if (!selectedItems.length) {
      Alert.alert('Chọn sản phẩm', 'Bạn hãy chọn ít nhất một sản phẩm để phối đồ.');
      return;
    }

    setIsSubmitting(true);
    try {
      const job = await runWithAuth((token) =>
        virtualTryOnApi.createJob(token, {
          sourceAssetId,
          outfitMode,
          selectedItems: selectedItems.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            colorVariantId: item.colorVariantId,
            size: item.size,
            role: item.role,
          })),
          contextPreset,
          contextPrompt: contextPreset === 'custom' ? contextPrompt.trim() : undefined,
          outputMode: 'image',
        }, `try-on-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      );
      navigation.replace('VirtualTryOnProcessing', { jobId: job._id });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tạo yêu cầu phối đồ.';
      Alert.alert('Phối đồ ảo', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <MaterialCommunityIcons name="arrow-left" size={25} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chọn outfit</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.sourceCard}>
          <View style={styles.sourceImageWrap}>
            {sourceImageUrl ? (
              <RemoteImage uri={sourceImageUrl} style={styles.sourceImage} recyclingKey={sourceAssetId} />
            ) : (
              <MaterialCommunityIcons name="image-outline" size={36} color={colors.brand} />
            )}
          </View>
          <View style={styles.sourceCopy}>
            <Text style={styles.sourceTitle}>Ảnh của bạn</Text>
            <Text style={styles.sourceText}>Ảnh này sẽ được dùng làm đầu vào cho kết quả phối đồ.</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Chế độ phối</Text>
        <View style={styles.modeRow}>
          {outfitModes.map((mode) => {
            const active = outfitMode === mode.key;
            return (
              <TouchableOpacity
                key={mode.key}
                style={[styles.modeButton, active && styles.modeButtonActive]}
                onPress={() => setOutfitMode(mode.key)}
                activeOpacity={0.82}
              >
                <MaterialCommunityIcons name={mode.icon} size={20} color={active ? colors.white : colors.brandDark} />
                <Text style={[styles.modeText, active && styles.modeTextActive]}>{mode.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.searchRow}>
          <MaterialCommunityIcons name="magnify" size={22} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Tìm áo, quần, giày..."
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <Text style={styles.sectionTitle}>Sản phẩm</Text>
        {isLoading ? (
          <ActivityIndicator color={colors.brand} style={styles.loading} />
        ) : (
          <View style={styles.productGrid}>
            {filteredProducts.map((product) => {
              const selected = selectedItems.some((item) => item.productId === product._id);
              const isSelecting = selectingProductId === product._id;

              return (
                <TouchableOpacity
                  key={product._id}
                  style={[styles.productCard, selected && styles.productCardSelected]}
                  onPress={() => selectProduct(product)}
                  activeOpacity={0.86}
                  disabled={isSelecting}
                >
                  <View style={styles.productImageWrap}>
                    <RemoteImage uri={product.image} style={styles.productImage} recyclingKey={product._id} />
                    {selected ? (
                      <View style={styles.selectedMark}>
                        <MaterialCommunityIcons name="check" size={18} color={colors.white} />
                      </View>
                    ) : null}
                    {isSelecting ? <ActivityIndicator style={StyleSheet.absoluteFillObject} color={colors.brand} /> : null}
                  </View>
                  <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                  <Text style={styles.productPrice}>{formatPrice(product.finalPrice)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Text style={styles.sectionTitle}>Đã chọn</Text>
        {selectedItems.length ? (
          <View style={styles.selectedList}>
            {selectedItems.map((item) => (
              <View key={`${item.productId}-${item.colorVariantId}`} style={styles.selectedItem}>
                <RemoteImage uri={item.imageSnapshot} style={styles.selectedImage} recyclingKey={item.colorVariantId} />
                <View style={styles.selectedCopy}>
                  <Text style={styles.selectedRole}>{roleLabel[item.role]}</Text>
                  <Text style={styles.selectedName} numberOfLines={2}>{item.nameSnapshot}</Text>
                  <Text style={styles.selectedMeta}>
                    {[item.colorSnapshot, item.size].filter(Boolean).join(' / ') || 'Biến thể mặc định'}
                  </Text>
                </View>
                <TouchableOpacity style={styles.removeButton} onPress={() => removeSelectedItem(item.productId)}>
                  <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptySelection}>
            <Text style={styles.emptySelectionText}>Chưa chọn sản phẩm nào.</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Bối cảnh</Text>
        <View style={styles.contextGrid}>
          {contextOptions.map((option) => {
            const active = contextPreset === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.contextChip, active && styles.contextChipActive]}
                onPress={() => setContextPreset(option.key)}
                activeOpacity={0.82}
              >
                <MaterialCommunityIcons name={option.icon} size={18} color={active ? colors.white : colors.brandDark} />
                <Text style={[styles.contextText, active && styles.contextTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {contextPreset === 'custom' ? (
          <TextInput
            style={styles.promptInput}
            value={contextPrompt}
            onChangeText={setContextPrompt}
            placeholder="VD: đi phỏng vấn ở văn phòng hiện đại"
            placeholderTextColor={colors.textMuted}
            maxLength={200}
            multiline
          />
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>{selectedItems.length}/4 món</Text>
          <Text style={styles.footerTotal}>
            {formatPrice(selectedItems.reduce((sum, item) => sum + item.finalPriceSnapshot, 0))}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.submitButton, (!selectedItems.length || isSubmitting) && styles.submitButtonDisabled]}
          onPress={createJob}
          disabled={!selectedItems.length || isSubmitting}
          activeOpacity={0.86}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <MaterialCommunityIcons name="auto-fix" size={22} color={colors.white} />
              <Text style={styles.submitText}>Tạo kết quả</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.brand,
  },
  header: {
    minHeight: 70,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: colors.white,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 116,
    gap: spacing.md,
  },
  sourceCard: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  sourceImageWrap: {
    width: 74,
    height: 92,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceImage: {
    width: '100%',
    height: '100%',
  },
  sourceCopy: {
    flex: 1,
  },
  sourceTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
  },
  sourceText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '900',
    marginTop: spacing.sm,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  modeButtonActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  modeText: {
    color: colors.brandDark,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  modeTextActive: {
    color: colors.white,
  },
  searchRow: {
    minHeight: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    color: colors.text,
    fontSize: 14,
  },
  loading: {
    paddingVertical: spacing.xl,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  productCard: {
    width: '47.8%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  productCardSelected: {
    borderColor: colors.brand,
    borderWidth: 2,
  },
  productImageWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.brandSoft,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  selectedMark: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productName: {
    minHeight: 38,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  productPrice: {
    color: colors.brand,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  selectedList: {
    gap: spacing.sm,
  },
  selectedItem: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  selectedImage: {
    width: 58,
    height: 58,
    borderRadius: radii.xs,
  },
  selectedCopy: {
    flex: 1,
  },
  selectedRole: {
    color: colors.brand,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  selectedName: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  selectedMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  removeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySelection: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  emptySelectionText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  contextGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  contextChip: {
    minHeight: 38,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  contextChipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  contextText: {
    color: colors.brandDark,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  contextTextActive: {
    color: colors.white,
  },
  promptInput: {
    minHeight: 86,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  footerLabel: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  footerTotal: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '900',
  },
  submitButton: {
    minWidth: 170,
    minHeight: 50,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  submitButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  submitText: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
});

export default VirtualTryOnBuilderScreen;

