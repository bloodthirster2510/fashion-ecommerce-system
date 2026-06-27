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
  none: 'Không đổi nền',
  work: 'Đi làm',
  casual: 'Đi chơi',
  party: 'Dự tiệc',
  travel: 'Du lịch',
  sport: 'Thể thao',
  date: 'Hẹn hò',
  custom: 'Tự mô tả',
};

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
      Alert.alert('Chọn size', `Sản phẩm ${itemWithoutSize.nameSnapshot} chưa có size để thêm vào giỏ.`);
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
      Alert.alert('Đã thêm vào giỏ', 'Toàn bộ set đồ đã được thêm vào giỏ hàng.', [
        { text: 'Ở lại' },
        { text: 'Xem giỏ', onPress: () => navigation.navigate('Cart') },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể thêm set vào giỏ.';
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
        <Text style={styles.headerTitle}>Kết quả phối đồ</Text>
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
            <View style={styles.badgeRow}>
              <View style={styles.contextBadge}>
                <MaterialCommunityIcons name="map-marker-radius-outline" size={17} color={colors.brandDark} />
                <Text style={styles.contextText}>{contextLabel[job.contextPreset] ?? 'Phối đồ'}</Text>
              </View>
              {job.provider === 'mock' ? (
                <View style={styles.mockBadge}>
                  <Text style={styles.mockText}>Mock AI</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.resultImageWrap}>
              {imageUrl ? (
                <RemoteImage uri={imageUrl} style={styles.resultImage} recyclingKey={`${job._id}-result`} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <MaterialCommunityIcons name="image-outline" size={48} color={colors.brand} />
                </View>
              )}
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionButton} onPress={shareResult} activeOpacity={0.86}>
                <MaterialCommunityIcons name="share-variant-outline" size={21} color={colors.brandDark} />
                <Text style={styles.actionText}>Chia sẻ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => Alert.alert('Tải ảnh', 'Ảnh kết quả đang được lưu trên Cloudinary. Tính năng lưu vào máy sẽ bổ sung sau.')}
                activeOpacity={0.86}
              >
                <MaterialCommunityIcons name="download-outline" size={21} color={colors.brandDark} />
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
                <MaterialCommunityIcons name="reload" size={21} color={colors.brandDark} />
                <Text style={styles.actionText}>Tạo lại</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Chi tiết set đồ</Text>
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
              <Text style={styles.totalLabel}>Tổng giá trị</Text>
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
                  <Text style={styles.cartText}>Thêm cả set - {formatPrice(job.totalFinalPrice)}</Text>
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
  loadingWrap: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 110,
    gap: spacing.md,
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
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  contextText: {
    color: colors.brandDark,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  mockBadge: {
    minHeight: 30,
    borderRadius: radii.pill,
    backgroundColor: colors.goldSoft,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockText: {
    color: colors.goldText,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  resultImageWrap: {
    width: '100%',
    aspectRatio: 0.78,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: colors.brandSoft,
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
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionText: {
    color: colors.brandDark,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  itemList: {
    gap: spacing.sm,
  },
  itemCard: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  itemImage: {
    width: 64,
    height: 64,
    borderRadius: radii.xs,
  },
  itemCopy: {
    flex: 1,
  },
  itemIndex: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  itemName: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  itemMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  itemPrice: {
    color: colors.brand,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  totalCard: {
    borderWidth: 1.5,
    borderColor: colors.brand,
    borderRadius: radii.sm,
    backgroundColor: colors.brandSoft,
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
  totalValue: {
    color: colors.brand,
    fontSize: 19,
    lineHeight: 25,
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
    padding: spacing.md,
  },
  cartButton: {
    minHeight: 52,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
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
    fontSize: 15,
    lineHeight: 20,
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

