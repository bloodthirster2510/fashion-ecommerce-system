import React from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { RemoteImage } from '../../components/media/RemoteImage';
import { colors, radii, shadows, spacing } from '../../theme';
import { useAuth } from '../auth/AuthContext';
import { cartApi } from '../cart/cartApi';
import { virtualTryOnApi } from './virtualTryOnApi';
import type { VirtualTryOnJob } from './virtualTryOn.types';

type NavigationProp = StackNavigationProp<RootStackParamList, 'VirtualTryOnResult'>;
type RouteProps = RouteProp<RootStackParamList, 'VirtualTryOnResult'>;

const formatPrice = (value: number) =>
  `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;

const contextLabel: Record<string, string> = {
  none: 'Giữ nền cũ',
  work: 'Đi làm',
  casual: 'Đi chơi',
  party: 'Dự tiệc',
  travel: 'Du lịch',
  sport: 'Thể thao',
  date: 'Hẹn hò',
  custom: 'Tự nhập',
};

const studioPalette = {
  ink: '#213448',
  primaryDark: '#213448',
  primary: '#547792',
  primarySoft: '#EDF4F7',
  primaryPale: '#DDE7EC',
  header: '#547792',
  headerSoft: '#DDE7EC',
  surface: '#FFFFFF',
  canvas: '#F6FAFD',
  line: '#DDE7EC',
  success: '#198754',
  successSoft: '#EAF7EF',
} as const;

const VirtualTryOnResultScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { runWithAuth } = useAuth();
  const [job, setJob] = React.useState<VirtualTryOnJob | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isAddingCart, setIsAddingCart] = React.useState(false);

  const jobId = route.params.jobId;

  React.useEffect(() => {
    let isCurrent = true;
    runWithAuth((token) => virtualTryOnApi.getJob(token, jobId))
      .then((nextJob) => {
        if (isCurrent) setJob(nextJob);
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        const message = error instanceof Error ? error.message : 'Không tải được kết quả phối đồ.';
        Alert.alert('Phối đồ ảo', message);
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => { isCurrent = false; };
  }, [jobId, runWithAuth]);

  const shareResult = async () => {
    const url = job?.generatedImageUrl || job?.sourceImageUrl;
    if (!url) return;
    await Share.share({
      title: 'Kết quả phối đồ',
      message: `Kết quả phối đồ của tôi: ${url}`,
    });
  };

  const addSetToCart = async () => {
    if (!job) return;
    const itemWithoutSize = job.selectedItems.find((item) => !item.size);
    if (itemWithoutSize) {
      Alert.alert('Chọn kích cỡ', `Sản phẩm ${itemWithoutSize.nameSnapshot} chưa có kích cỡ để thêm vào giỏ.`);
      return;
    }

    setIsAddingCart(true);
    try {
      await runWithAuth(async (token) => {
        for (const item of job.selectedItems) {
          await cartApi.addItem(token, {
            productId: item.productId,
            variantId: item.variantId,
            colorVariantId: item.colorVariantId,
            size: item.size!,
            quantity: 1,
          });
        }
      });
      Alert.alert('Đã thêm vào giỏ', 'Toàn bộ sản phẩm trong bộ phối đã được thêm vào giỏ hàng.', [
        { text: 'Ở lại' },
        { text: 'Xem giỏ', onPress: () => navigation.navigate('Cart') },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể thêm bộ phối vào giỏ.';
      Alert.alert('Giỏ hàng', message);
    } finally {
      setIsAddingCart(false);
    }
  };

  const imageUrl = job?.generatedImageUrl || job?.sourceImageUrl || '';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <MaterialCommunityIcons name="arrow-left" size={25} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerKicker}>Fit Studio</Text>
          <Text style={styles.headerTitle}>Kết quả thử đồ</Text>
        </View>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('VirtualTryOnHome')} activeOpacity={0.8}>
          <MaterialCommunityIcons name="home-outline" size={23} color={colors.white} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : job ? (
        <>
          <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.resultImageWrap}>
              {imageUrl ? (
                <RemoteImage uri={imageUrl} style={styles.resultImage} recyclingKey={`${job._id}-result`} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <MaterialCommunityIcons name="image-outline" size={48} color={colors.brand} />
                </View>
              )}
              <View style={styles.resultOverlay}>
                <View style={styles.contextBadge}>
                  <MaterialCommunityIcons name="map-marker-radius-outline" size={17} color={studioPalette.ink} />
                  <Text style={styles.contextText}>{contextLabel[job.contextPreset] ?? 'Phối đồ'}</Text>
                </View>
                {job.provider === 'mock' ? (
                  <View style={styles.mockBadge}>
                    <Text style={styles.mockText}>Bản thử nghiệm</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {job.generatedImageUrl && job.sourceImageUrl ? (
              <View style={styles.compareStrip}>
                <View style={styles.compareTile}>
                  <RemoteImage uri={job.sourceImageUrl} style={styles.compareImage} recyclingKey={`${job._id}-source`} />
                  <Text style={styles.compareLabel}>Trước</Text>
                </View>
                <View style={styles.compareArrow}>
                  <MaterialCommunityIcons name="arrow-right" size={20} color={studioPalette.ink} />
                </View>
                <View style={styles.compareTile}>
                  <RemoteImage uri={job.generatedImageUrl} style={styles.compareImage} recyclingKey={`${job._id}-generated`} />
                  <Text style={styles.compareLabel}>Sau</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionButton} onPress={shareResult} activeOpacity={0.86}>
                <MaterialCommunityIcons name="share-variant-outline" size={24} color={studioPalette.ink} />
                <Text style={styles.actionText}>Chia sẻ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => Alert.alert('Tải ảnh', 'Tính năng lưu ảnh vào máy sẽ được bổ sung sau.')}
                activeOpacity={0.86}
              >
                <MaterialCommunityIcons name="download-outline" size={24} color={studioPalette.ink} />
                <Text style={styles.actionText}>Tải về</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('VirtualTryOnBuilder', {
                  assetId: job.sourceAsset?._id,
                  imageUrl: job.sourceImageUrl,
                })}
                activeOpacity={0.86}
              >
                <MaterialCommunityIcons name="reload" size={24} color={studioPalette.ink} />
                <Text style={styles.actionText}>Phối lại</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Bộ đồ trên ảnh</Text>
              <Text style={styles.sectionMeta}>{job.selectedItems.length} món</Text>
            </View>
            <View style={styles.itemList}>
              {job.selectedItems.map((item, index) => (
                <View key={`${item.productId}-${item.colorVariantId}`} style={styles.itemCard}>
                  <RemoteImage uri={item.imageSnapshot} style={styles.itemImage} recyclingKey={item.colorVariantId} />
                  <View style={styles.itemCopy}>
                    <Text style={styles.itemIndex}>Món {index + 1}</Text>
                    <Text style={styles.itemName} numberOfLines={2}>{item.nameSnapshot}</Text>
                    <Text style={styles.itemMeta}>
                      {[item.colorSnapshot, item.size].filter(Boolean).join(' / ') || 'Biến thể mặc định'}
                    </Text>
                  </View>
                  <Text style={styles.itemPrice}>{formatPrice(item.finalPriceSnapshot)}</Text>
                </View>
              ))}
            </View>

            <View style={styles.totalCard}>
              <View>
                <Text style={styles.totalLabel}>Tổng giá trị bộ phối</Text>
                <Text style={styles.totalSubtext}>Sẵn sàng thêm tất cả vào giỏ</Text>
              </View>
              <Text style={styles.totalValue}>{formatPrice(job.totalFinalPrice)}</Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.cartButton, isAddingCart && styles.cartButtonDisabled]}
              onPress={addSetToCart}
              disabled={isAddingCart}
              activeOpacity={0.86}
            >
              {isAddingCart ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <MaterialCommunityIcons name="cart-plus" size={23} color={colors.white} />
                  <Text style={styles.cartText}>Thêm cả bộ - {formatPrice(job.totalFinalPrice)}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.loadingWrap}>
          <Text style={styles.emptyText}>Không tìm thấy kết quả phối đồ.</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: studioPalette.header,
  },
  header: {
    minHeight: 82,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: studioPalette.header,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: spacing.md,
  },
  headerKicker: {
    color: studioPalette.headerSoft,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: colors.white,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  loadingWrap: {
    flex: 1,
    backgroundColor: studioPalette.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    backgroundColor: studioPalette.canvas,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 118,
    gap: spacing.lg,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  contextBadge: {
    minHeight: 36,
    borderRadius: radii.pill,
    backgroundColor: studioPalette.primaryPale,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  contextText: {
    color: studioPalette.ink,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  mockBadge: {
    minHeight: 36,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.88)',
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockText: {
    color: studioPalette.ink,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  resultImageWrap: {
    width: '100%',
    aspectRatio: 0.78,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: studioPalette.primarySoft,
    ...shadows.card,
  },
  resultImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultOverlay: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    top: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  compareStrip: {
    minHeight: 104,
    borderRadius: radii.md,
    backgroundColor: studioPalette.primarySoft,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  compareTile: {
    width: 86,
    alignItems: 'center',
    gap: spacing.xs,
  },
  compareImage: {
    width: 70,
    height: 70,
    borderRadius: radii.sm,
    backgroundColor: studioPalette.primarySoft,
  },
  compareArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: studioPalette.primaryPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compareLabel: {
    color: studioPalette.ink,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    minHeight: 74,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: studioPalette.line,
    ...shadows.card,
  },
  actionText: {
    color: studioPalette.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
  },
  sectionMeta: {
    color: studioPalette.primary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  itemList: {
    gap: spacing.sm,
  },
  itemCard: {
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  itemImage: {
    width: 72,
    height: 72,
    borderRadius: radii.sm,
  },
  itemCopy: {
    flex: 1,
  },
  itemIndex: {
    color: studioPalette.primary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  itemName: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  itemMeta: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  itemPrice: {
    color: studioPalette.primary,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  totalCard: {
    borderWidth: 1.5,
    borderColor: studioPalette.primaryPale,
    borderRadius: radii.md,
    backgroundColor: studioPalette.primarySoft,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
  },
  totalSubtext: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 2,
  },
  totalValue: {
    color: studioPalette.primary,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  cartButton: {
    minHeight: 58,
    borderRadius: radii.md,
    backgroundColor: studioPalette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    ...shadows.card,
  },
  cartButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  cartText: {
    color: colors.white,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
});

export default VirtualTryOnResultScreen;
