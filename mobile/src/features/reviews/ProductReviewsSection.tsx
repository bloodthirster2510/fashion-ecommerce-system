import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../theme';
import { reviewApi } from './reviewApi';
import type { PublicReview, PublicReviewList } from './review.types';
import { useAuth } from '../auth/AuthContext';

const PAGE_SIZE = 5;
const RATINGS = [5, 4, 3, 2, 1] as const;

const emptyData: PublicReviewList = {
  items: [],
  summary: {
    averageRating: 0,
    reviewCount: 0,
    distribution: RATINGS.map((rating) => ({ rating, count: 0, percent: 0 })),
  },
  pagination: { page: 1, limit: PAGE_SIZE, totalItems: 0, totalPages: 0 },
};
type ReviewSummary = PublicReviewList['summary'];

const formatDate = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric',
}).format(new Date(value));

const formatVariant = (review: PublicReview) => {
  if (!review.purchasedVariant) return '';
  return [
    review.purchasedVariant.fitType,
    review.purchasedVariant.color,
    `Size ${review.purchasedVariant.size}`,
  ].filter(Boolean).join(' / ');
};

const Stars = ({ rating, size = 14 }: { rating: number; size?: number }) => (
  <View style={s.stars}>
    {[1, 2, 3, 4, 5].map((value) => (
      <MaterialCommunityIcons
        key={value}
        name={value <= Math.round(rating) ? 'star' : 'star-outline'}
        size={size}
        color={colors.goldDark}
      />
    ))}
  </View>
);

type ProductReviewsSectionProps = {
  productId: string;
  onSummaryChange?: (summary: ReviewSummary) => void;
};

export default function ProductReviewsSection({ productId, onSummaryChange }: ProductReviewsSectionProps) {
  const { runWithAuth, session } = useAuth();
  const [data, setData] = React.useState<PublicReviewList>(emptyData);
  const [page, setPage] = React.useState(1);
  const [selectedRating, setSelectedRating] = React.useState<number>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [helpfulLoadingId, setHelpfulLoadingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPage(1);
    setSelectedRating(undefined);
    setData(emptyData);
    onSummaryChange?.(emptyData.summary);
  }, [onSummaryChange, productId]);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    reviewApi.listProductReviews(productId, { page, limit: PAGE_SIZE, rating: selectedRating })
      .then((result) => {
        if (!active) return;
        setData(result);
        onSummaryChange?.(result.summary);
        if (result.pagination.totalPages > 0 && page > result.pagination.totalPages) {
          setPage(result.pagination.totalPages);
        }
      })
      .catch(() => {
        if (active) setError('Chưa thể tải đánh giá sản phẩm.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [onSummaryChange, page, productId, selectedRating]);

  const selectRating = (rating?: number) => {
    setSelectedRating(rating);
    setPage(1);
  };

  const distribution = RATINGS.map((rating) => (
    data.summary.distribution.find((item) => item.rating === rating) ?? { rating, count: 0, percent: 0 }
  ));

  const toggleHelpful = async (review: PublicReview) => {
    if (!session || session.user.role !== 'user') {
      Alert.alert('Cần đăng nhập', 'Vui lòng đăng nhập bằng tài khoản khách hàng để đánh dấu hữu ích.');
      return;
    }
    if (review.user._id === session.user._id) {
      Alert.alert('Đánh giá của bạn', 'Bạn không thể đánh dấu đánh giá của chính mình là hữu ích.');
      return;
    }
    setHelpfulLoadingId(review._id);
    try {
      const result = await runWithAuth((token) => reviewApi.toggleHelpful(token, review._id));
      setData((current) => ({
        ...current,
        items: current.items.map((item) => item._id === review._id
          ? { ...item, helpfulCount: result.helpfulCount, hasVotedHelpful: result.hasVotedHelpful }
          : item),
      }));
    } catch (caught) {
      Alert.alert('Không thể cập nhật', caught instanceof Error ? caught.message : 'Vui lòng thử lại.');
    } finally {
      setHelpfulLoadingId(null);
    }
  };

  return (
    <View>
      <Text style={s.title}>Đánh giá của khách hàng</Text>

      <View style={s.overview}>
        <View style={s.scoreBlock}>
          <Text style={s.score}>{data.summary.averageRating.toFixed(1)}</Text>
          <Stars rating={data.summary.averageRating} size={18} />
          <Text style={s.reviewCount}>{data.summary.reviewCount} đánh giá</Text>
        </View>

        <View style={s.distribution}>
          {distribution.map((item) => (
            <View key={item.rating} style={s.distributionRow}>
              <Text style={s.distributionLabel}>{item.rating}</Text>
              <MaterialCommunityIcons name="star" size={11} color={colors.goldDark} />
              <View style={s.track}>
                <View style={[s.fill, { width: `${Math.min(100, Math.max(0, item.percent))}%` }]} />
              </View>
              <Text style={s.distributionCount}>{item.count}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={s.promise}>
        <Text style={s.promiseTitle}>Đánh giá sản phẩm từ người mua</Text>
        <View style={s.promiseRow}>
          <MaterialCommunityIcons name="check-circle" size={15} color={colors.success} />
          <Text style={s.promiseText}>Chỉ khách đã nhận và thanh toán đơn hàng mới có thể đánh giá.</Text>
        </View>
        <View style={s.promiseRow}>
          <MaterialCommunityIcons name="check-circle" size={15} color={colors.success} />
          <Text style={s.promiseText}>Mỗi đánh giá đều được xác minh từ đơn mua thực tế.</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filters}
        accessibilityLabel="Lọc đánh giá"
      >
        <FilterButton
          label={`Tất cả (${data.summary.reviewCount})`}
          active={selectedRating === undefined}
          onPress={() => selectRating()}
        />
        {distribution.map((item) => (
          <FilterButton
            key={item.rating}
            label={`${item.rating} sao (${item.count})`}
            active={selectedRating === item.rating}
            onPress={() => selectRating(item.rating)}
          />
        ))}
      </ScrollView>

      {loading ? (
        <View style={s.state}><ActivityIndicator color={colors.brand} /></View>
      ) : error ? (
        <Text style={s.empty}>{error}</Text>
      ) : !data.items.length ? (
        <Text style={s.empty}>
          {selectedRating ? `Chưa có đánh giá ${selectedRating} sao.` : 'Chưa có đánh giá nào.'}
        </Text>
      ) : (
        <View style={s.list}>
          {data.items.map((review) => (
            <ReviewItem
              key={review._id}
              review={review}
              loading={helpfulLoadingId === review._id}
              isOwnReview={review.user._id === session?.user._id}
              onHelpful={() => { void toggleHelpful(review); }}
            />
          ))}
        </View>
      )}

      {data.pagination.totalPages > 1 ? (
        <View style={s.pagination}>
          <TouchableOpacity
            style={[s.pageButton, page === 1 && s.pageButtonDisabled]}
            disabled={page === 1 || loading}
            onPress={() => setPage((current) => Math.max(1, current - 1))}
          >
            <MaterialCommunityIcons name="chevron-left" size={20} color={page === 1 ? colors.textSubtle : colors.brand} />
            <Text style={[s.pageButtonText, page === 1 && s.pageButtonTextDisabled]}>Trước</Text>
          </TouchableOpacity>
          <Text style={s.pageStatus}>Trang {page}/{data.pagination.totalPages}</Text>
          <TouchableOpacity
            style={[s.pageButton, page === data.pagination.totalPages && s.pageButtonDisabled]}
            disabled={page === data.pagination.totalPages || loading}
            onPress={() => setPage((current) => Math.min(data.pagination.totalPages, current + 1))}
          >
            <Text style={[s.pageButtonText, page === data.pagination.totalPages && s.pageButtonTextDisabled]}>Sau</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={page === data.pagination.totalPages ? colors.textSubtle : colors.brand} />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function FilterButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.filterButton, active && s.filterButtonActive]} onPress={onPress}>
      <Text style={[s.filterText, active && s.filterTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ReviewItem({
  review,
  loading,
  isOwnReview,
  onHelpful,
}: {
  review: PublicReview;
  loading: boolean;
  isOwnReview: boolean;
  onHelpful: () => void;
}) {
  return (
    <View style={s.reviewItem}>
      {review.user.avatarImage ? (
        <Image source={{ uri: review.user.avatarImage }} style={s.avatar} />
      ) : (
        <View style={s.avatarFallback}>
          <Text style={s.avatarText}>{review.user.name?.trim().charAt(0).toUpperCase() || 'K'}</Text>
        </View>
      )}
      <View style={s.content}>
        <View style={s.authorLine}>
          <Text style={s.name}>{review.user.name || 'Khách hàng'}</Text>
          {review.verifiedPurchase ? (
            <View style={s.verifiedRow}>
              <MaterialCommunityIcons name="check-circle" size={14} color={colors.success} />
              <Text style={s.verified}>Đã mua hàng</Text>
            </View>
          ) : null}
        </View>
        {review.purchasedVariant ? <Text style={s.variant}>Phân loại: {formatVariant(review)}</Text> : null}
        <Stars rating={review.rating} />
        <Text style={s.comment}>{review.comment}</Text>
        {review.images.length ? (
          <View style={s.images}>
            {review.images.map((image) => (
              <Image key={image._id ?? image.url} source={{ uri: image.thumbnailUrl || image.url }} style={s.image} />
            ))}
          </View>
        ) : null}
        {review.adminReply ? (
          <View style={s.reply}>
            <Text style={s.replyTitle}>Phản hồi từ Fashionista</Text>
            <Text style={s.replyText}>{review.adminReply.content}</Text>
          </View>
        ) : null}
        <Text style={s.date}>Đã đánh giá vào {formatDate(review.createdAt)}</Text>
        <TouchableOpacity
          style={[s.helpfulButton, review.hasVotedHelpful && s.helpfulButtonActive, isOwnReview && s.helpfulButtonDisabled]}
          disabled={loading || isOwnReview}
          onPress={onHelpful}
          accessibilityLabel={`Đánh dấu hữu ích, hiện có ${review.helpfulCount} lượt`}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.brand} />
          ) : (
            <MaterialCommunityIcons
              name={review.hasVotedHelpful ? 'thumb-up' : 'thumb-up-outline'}
              size={16}
              color={review.hasVotedHelpful ? colors.brand : colors.textMuted}
            />
          )}
          <Text style={[s.helpfulText, review.hasVotedHelpful && s.helpfulTextActive]}>
            Hữu ích ({review.helpfulCount})
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  title: { color: colors.text, fontSize: 17, lineHeight: 23, fontWeight: '900', marginBottom: spacing.md },
  overview: { flexDirection: 'row', borderRadius: radii.sm, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.md },
  scoreBlock: { width: 105, alignItems: 'center', justifyContent: 'center' },
  score: { color: colors.text, fontSize: 34, lineHeight: 40, fontWeight: '900' },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  reviewCount: { color: colors.textMuted, fontSize: 11, marginTop: spacing.xs },
  distribution: { flex: 1, gap: 6 },
  distributionRow: { minHeight: 16, flexDirection: 'row', alignItems: 'center', gap: 4 },
  distributionLabel: { width: 9, color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.brandPale, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.brand },
  distributionCount: { width: 20, color: colors.textMuted, fontSize: 10, textAlign: 'right' },
  promise: { marginTop: spacing.md, borderRadius: radii.sm, backgroundColor: colors.brandSoft, padding: spacing.md, gap: spacing.sm },
  promiseTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  promiseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  promiseText: { flex: 1, color: colors.textBody, fontSize: 11, lineHeight: 16 },
  filters: { paddingVertical: spacing.md, gap: spacing.sm },
  filterButton: { height: 38, paddingHorizontal: spacing.md, borderRadius: radii.xs, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  filterButtonActive: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  filterText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  filterTextActive: { color: colors.brand },
  state: { minHeight: 100, alignItems: 'center', justifyContent: 'center' },
  empty: { color: colors.textMuted, textAlign: 'center', padding: spacing.lg },
  list: { borderTopWidth: 1, borderTopColor: colors.border },
  reviewItem: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.brand, fontWeight: '900' },
  content: { flex: 1, minWidth: 0, gap: spacing.xs },
  authorLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  name: { color: colors.text, fontWeight: '900' },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  verified: { color: colors.success, fontSize: 11, fontWeight: '800' },
  variant: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  comment: { color: colors.textBody, lineHeight: 20, marginTop: spacing.xs },
  images: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  image: { width: 62, height: 62, borderRadius: radii.sm },
  reply: { marginTop: spacing.xs, padding: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.brand, backgroundColor: colors.brandSoft, borderRadius: radii.sm },
  replyTitle: { color: colors.brand, fontWeight: '900', fontSize: 12 },
  replyText: { color: colors.textBody, marginTop: 3, lineHeight: 18 },
  date: { color: colors.textSubtle, fontSize: 11, marginTop: spacing.xs },
  helpfulButton: { marginTop: spacing.xs, minHeight: 36, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radii.pill, backgroundColor: colors.field },
  helpfulButtonActive: { backgroundColor: colors.brandSoft },
  helpfulButtonDisabled: { opacity: 0.5 },
  helpfulText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  helpfulTextActive: { color: colors.brand },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  pageButton: { minWidth: 88, height: 38, borderRadius: radii.xs, borderWidth: 1, borderColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  pageButtonDisabled: { borderColor: colors.border, backgroundColor: colors.field },
  pageButtonText: { color: colors.brand, fontSize: 12, fontWeight: '800' },
  pageButtonTextDisabled: { color: colors.textSubtle },
  pageStatus: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
});
