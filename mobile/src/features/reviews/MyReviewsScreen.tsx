import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { colors, radii, spacing } from '../../theme';
import { useAuth } from '../auth/AuthContext';
import { reviewApi } from './reviewApi';
import type { EligibleReviewItem, MyReview } from './review.types';
import { hasNextPage, mergePageItems, type PageInfo } from '../../utils/pagination';

const PAGE_SIZE = 20;
type ReviewTab = 'eligible' | 'reviewed';
type LoadMode = 'initial' | 'refresh';

const statusMeta = {
  visible: { label: 'Đã hiển thị', color: colors.success, background: colors.successSoft },
  pending: { label: 'Chờ duyệt', color: colors.goldText, background: colors.goldSoft },
  hidden: { label: 'Đã ẩn', color: colors.danger, background: colors.dangerSoft },
} as const;

const formatDate = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}).format(new Date(value));

const mergeEligibleItems = (current: EligibleReviewItem[], incoming: EligibleReviewItem[]) => {
  const itemsById = new Map(current.map((item) => [item.orderItemId, item]));
  incoming.forEach((item) => itemsById.set(item.orderItemId, item));
  return Array.from(itemsById.values());
};

const formatCriteria = (review: MyReview) => {
  const fit = review.criteria?.sizeFit === 'small'
    ? 'Hơi chật'
    : review.criteria?.sizeFit === 'large'
      ? 'Hơi rộng'
      : review.criteria?.sizeFit === 'true_to_size'
        ? 'Vừa vặn'
        : '';
  return [
    review.criteria?.productQuality ? `Chất lượng ${review.criteria.productQuality}/5` : '',
    review.criteria?.descriptionMatch ? `Đúng mô tả ${review.criteria.descriptionMatch}/5` : '',
    fit,
  ].filter(Boolean).join(' · ');
};

export default function MyReviewsScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'MyReviews'>>();
  const { runWithAuth } = useAuth();
  const [activeTab, setActiveTab] = React.useState<ReviewTab>('eligible');
  const [eligibleItems, setEligibleItems] = React.useState<EligibleReviewItem[]>([]);
  const [reviews, setReviews] = React.useState<MyReview[]>([]);
  const [eligiblePagination, setEligiblePagination] = React.useState<PageInfo | null>(null);
  const [reviewPagination, setReviewPagination] = React.useState<PageInfo | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState('');
  const requestSequenceRef = React.useRef(0);

  const loadAll = React.useCallback(async (mode: LoadMode = 'initial') => {
    if (mode === 'refresh') setIsRefreshing(true);
    else setIsLoading(true);
    setError('');

    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    try {
      const [eligibleResult, reviewResult] = await Promise.all([
        runWithAuth((token) => reviewApi.listEligible(token, { page: 1, limit: PAGE_SIZE })),
        runWithAuth((token) => reviewApi.listMine(token, { page: 1, limit: PAGE_SIZE })),
      ]);
      if (requestSequenceRef.current !== requestSequence) return;
      setEligibleItems(eligibleResult.items);
      setEligiblePagination(eligibleResult.pagination);
      setReviews(reviewResult.items);
      setReviewPagination(reviewResult.pagination);
    } catch (caught) {
      if (requestSequenceRef.current !== requestSequence) return;
      setError(caught instanceof Error ? caught.message : 'Vui lòng thử lại.');
    } finally {
      if (requestSequenceRef.current !== requestSequence) return;
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [runWithAuth]);

  const loadMore = async () => {
    const pagination = activeTab === 'eligible' ? eligiblePagination : reviewPagination;
    if (!hasNextPage(pagination) || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const page = (pagination?.page ?? 0) + 1;
      if (activeTab === 'eligible') {
        const result = await runWithAuth((token) => reviewApi.listEligible(token, { page, limit: PAGE_SIZE }));
        setEligibleItems((current) => mergeEligibleItems(current, result.items));
        setEligiblePagination(result.pagination);
      } else {
        const result = await runWithAuth((token) => reviewApi.listMine(token, { page, limit: PAGE_SIZE }));
        setReviews((current) => mergePageItems(current, result.items));
        setReviewPagination(result.pagination);
      }
    } catch (caught) {
      Alert.alert('Không thể tải thêm', caught instanceof Error ? caught.message : 'Vui lòng thử lại.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  useFocusEffect(React.useCallback(() => {
    void loadAll();
    return () => {
      requestSequenceRef.current += 1;
    };
  }, [loadAll]));

  const writeReview = (item: EligibleReviewItem) => navigation.navigate('ReviewComposer', {
    orderId: item.orderId,
    orderItemId: item.orderItemId,
    orderCode: item.orderCode,
    productName: item.product.name,
    productImage: item.product.image,
    variantLabel: `${item.variant.color} · Size ${item.variant.size}`,
  });

  const editReview = (review: MyReview) => navigation.navigate('ReviewComposer', {
    orderId: review.orderId,
    orderItemId: review.orderItemId,
    orderCode: '—',
    productName: review.product.name,
    productImage: review.product.image,
    variantLabel: review.purchasedVariant ? `${review.purchasedVariant.color} · Size ${review.purchasedVariant.size}` : '',
    editReviewId: review._id,
    editRating: review.rating,
    editComment: review.comment,
    editCriteria: review.criteria,
    editImages: review.images,
  });

  const removeReview = (review: MyReview) => Alert.alert(
    'Xóa đánh giá?',
    'Sản phẩm sẽ trở lại danh sách có thể đánh giá.',
    [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await runWithAuth((token) => reviewApi.deleteMine(token, review._id));
              await loadAll('refresh');
            } catch (caught) {
              Alert.alert('Không thể xóa đánh giá', caught instanceof Error ? caught.message : 'Vui lòng thử lại.');
            }
          })();
        },
      },
    ],
  );

  const activeItems = activeTab === 'eligible' ? eligibleItems : reviews;
  const activePagination = activeTab === 'eligible' ? eligiblePagination : reviewPagination;
  const canLoadMore = hasNextPage(activePagination);
  const eligibleCount = eligiblePagination?.totalItems ?? eligibleItems.length;
  const reviewedCount = reviewPagination?.totalItems ?? reviews.length;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.headerAction} onPress={() => navigation.goBack()} accessibilityLabel="Quay lại">
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={s.title}>Đánh giá của tôi</Text>
        <View style={s.headerAction} />
      </View>

      <View style={s.tabs} accessibilityRole="tablist">
        <ReviewTabButton
          label="Có thể đánh giá"
          count={eligibleCount}
          active={activeTab === 'eligible'}
          onPress={() => setActiveTab('eligible')}
        />
        <ReviewTabButton
          label="Đã đánh giá"
          count={reviewedCount}
          active={activeTab === 'reviewed'}
          onPress={() => setActiveTab('reviewed')}
        />
      </View>

      {isLoading ? (
        <View style={s.loadingState}><ActivityIndicator color={colors.brand} /></View>
      ) : error ? (
        <View style={s.state}>
          <MaterialCommunityIcons name="alert-circle-outline" size={32} color={colors.danger} />
          <Text style={s.error}>{error}</Text>
          <TouchableOpacity style={s.retryButton} onPress={() => void loadAll()}>
            <Text style={s.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          key={activeTab}
          contentContainerStyle={[s.content, activeItems.length === 0 && s.emptyContent]}
          showsVerticalScrollIndicator={false}
          refreshControl={(
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void loadAll('refresh')}
              tintColor={colors.brand}
            />
          )}
        >
          {activeTab === 'eligible' ? (
            eligibleItems.length ? eligibleItems.map((item) => (
              <EligibleCard key={item.orderItemId} item={item} onWrite={() => writeReview(item)} />
            )) : (
              <EmptyState
                icon="check-all"
                title="Bạn đã đánh giá hết rồi"
                description="Sản phẩm mới sẽ xuất hiện ở đây sau khi đơn được giao và thanh toán."
              />
            )
          ) : reviews.length ? reviews.map((review) => (
            <ReviewedCard
              key={review._id}
              review={review}
              onOpenProduct={() => navigation.navigate('ProductDetail', { productId: review.product._id })}
              onEdit={() => editReview(review)}
              onRemove={() => removeReview(review)}
            />
          )) : (
            <EmptyState
              icon="message-star-outline"
              title="Chưa có bài đánh giá"
              description="Các đánh giá bạn đã gửi sẽ được lưu lại tại đây."
            />
          )}

          {canLoadMore ? (
            <TouchableOpacity style={s.loadMore} disabled={isLoadingMore} onPress={() => void loadMore()}>
              {isLoadingMore
                ? <ActivityIndicator color={colors.brandDark} />
                : <Text style={s.loadMoreText}>Xem thêm</Text>}
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ReviewTabButton({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.tab, active && s.tabActive]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Text style={[s.tabText, active && s.tabTextActive]}>{label}</Text>
      <Text style={[s.tabCount, active && s.tabCountActive]}>{count}</Text>
    </TouchableOpacity>
  );
}

function EligibleCard({ item, onWrite }: { item: EligibleReviewItem; onWrite: () => void }) {
  return (
    <View style={s.card}>
      <View style={s.productRow}>
        <Image source={{ uri: item.product.image }} style={s.eligibleImage} />
        <View style={s.productCopy}>
          <Text style={s.productName} numberOfLines={2}>{item.product.name}</Text>
          <Text style={s.variant}>{item.variant.color} · Size {item.variant.size}</Text>
          <Text style={s.orderCode}>Đơn {item.orderCode}</Text>
          <View style={s.verifiedRow}>
            <MaterialCommunityIcons name="check-decagram" size={14} color={colors.success} />
            <Text style={s.verifiedText}>Đã nhận hàng và thanh toán</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity style={s.writeButton} onPress={onWrite}>
        <MaterialCommunityIcons name="star-outline" size={18} color={colors.white} />
        <Text style={s.writeButtonText}>Đánh giá sản phẩm</Text>
      </TouchableOpacity>
    </View>
  );
}

function ReviewedCard({
  review,
  onOpenProduct,
  onEdit,
  onRemove,
}: {
  review: MyReview;
  onOpenProduct: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const status = statusMeta[review.moderationStatus];
  const criteria = formatCriteria(review);
  return (
    <View style={s.card}>
      <TouchableOpacity style={s.reviewProductRow} onPress={onOpenProduct} accessibilityRole="button">
        <Image source={{ uri: review.product.image }} style={s.reviewImage} />
        <View style={s.productCopy}>
          <Text style={s.productName} numberOfLines={2}>{review.product.name}</Text>
          {review.purchasedVariant ? (
            <Text style={s.variant}>{review.purchasedVariant.color} · Size {review.purchasedVariant.size}</Text>
          ) : null}
        </View>
        <MaterialCommunityIcons name="chevron-right" size={21} color={colors.textSubtle} />
      </TouchableOpacity>

      <View style={s.reviewSummary}>
        <View style={s.stars}>
          {[1, 2, 3, 4, 5].map((value) => (
            <MaterialCommunityIcons
              key={value}
              name={value <= review.rating ? 'star' : 'star-outline'}
              size={16}
              color={colors.goldDark}
            />
          ))}
        </View>
        <View style={[s.statusBadge, { backgroundColor: status.background }]}>
          <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      <Text style={s.comment}>{review.comment}</Text>
      {criteria ? <Text style={s.criteria}>{criteria}</Text> : null}

      {review.images.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.reviewImages}>
          {review.images.map((image) => (
            <Image key={image._id ?? image.url} source={{ uri: image.thumbnailUrl || image.url }} style={s.reviewThumbnail} />
          ))}
        </ScrollView>
      ) : null}

      {review.adminReply ? (
        <View style={s.reply}>
          <Text style={s.replyTitle}>Phản hồi từ Fashionista</Text>
          <Text style={s.replyText}>{review.adminReply.content}</Text>
        </View>
      ) : null}

      <View style={s.reviewFooter}>
        <Text style={s.reviewDate}>{formatDate(review.createdAt)}</Text>
        <View style={s.actions}>
          <TouchableOpacity style={s.actionButton} onPress={onEdit}>
            <MaterialCommunityIcons name="pencil-outline" size={17} color={colors.brandDark} />
            <Text style={s.actionText}>Sửa</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionButton} onPress={onRemove}>
            <MaterialCommunityIcons name="trash-can-outline" size={17} color={colors.danger} />
            <Text style={s.deleteText}>Xóa</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function EmptyState({ icon, title, description }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; description: string }) {
  return (
    <View style={s.emptyState}>
      <MaterialCommunityIcons name={icon} size={38} color={colors.textSubtle} />
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyDescription}>{description}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 64, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.brand },
  headerAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: colors.white, fontWeight: '800', fontSize: 18, textAlign: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.brandDark },
  tabText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: colors.text, fontWeight: '800' },
  tabCount: { color: colors.textSubtle, fontSize: 11, fontWeight: '700' },
  tabCountActive: { color: colors.brandDark },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  emptyContent: { flexGrow: 1 },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  state: { flex: 1, padding: spacing.xl, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  error: { color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  retryButton: { minWidth: 104, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.brandDark },
  retryText: { color: colors.brandDark, fontWeight: '800' },
  card: { padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm },
  productRow: { flexDirection: 'row', gap: spacing.md },
  reviewProductRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  eligibleImage: { width: 68, height: 84, borderRadius: radii.xs, backgroundColor: colors.field },
  reviewImage: { width: 52, height: 64, borderRadius: radii.xs, backgroundColor: colors.field },
  productCopy: { flex: 1, minWidth: 0 },
  productName: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: '800' },
  variant: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  orderCode: { color: colors.textSubtle, fontSize: 10, marginTop: 2 },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  verifiedText: { color: colors.success, fontSize: 10, fontWeight: '700' },
  writeButton: { minHeight: 44, marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radii.xs, backgroundColor: colors.brand },
  writeButtonText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  reviewSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radii.pill },
  statusText: { fontSize: 10, fontWeight: '800' },
  comment: { color: colors.textBody, fontSize: 14, lineHeight: 21, marginTop: spacing.md },
  criteria: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: spacing.sm },
  reviewImages: { gap: spacing.xs, marginTop: spacing.md },
  reviewThumbnail: { width: 64, height: 74, borderRadius: radii.xs, backgroundColor: colors.field },
  reply: { marginTop: spacing.md, paddingVertical: spacing.sm, paddingLeft: spacing.md, borderLeftWidth: 2, borderLeftColor: colors.brand, backgroundColor: colors.field },
  replyTitle: { color: colors.brandDark, fontSize: 11, fontWeight: '800' },
  replyText: { color: colors.textBody, fontSize: 12, lineHeight: 18, marginTop: 3 },
  reviewFooter: { minHeight: 44, marginTop: spacing.md, paddingTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border },
  reviewDate: { color: colors.textSubtle, fontSize: 10 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actionButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actionText: { color: colors.brandDark, fontSize: 12, fontWeight: '800' },
  deleteText: { color: colors.danger, fontSize: 12, fontWeight: '800' },
  emptyState: { flex: 1, minHeight: 280, paddingHorizontal: spacing.xl, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: spacing.md },
  emptyDescription: { color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: spacing.xs },
  loadMore: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.brandDark },
  loadMoreText: { color: colors.brandDark, fontWeight: '800' },
});
