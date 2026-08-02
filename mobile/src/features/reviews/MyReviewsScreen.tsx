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
import type { MyReview } from './review.types';
import { hasNextPage, mergePageItems, type PageInfo } from '../../utils/pagination';

const PAGE_SIZE = 20;
type LoadMode = 'initial' | 'refresh' | 'more';

export default function MyReviewsScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'MyReviews'>>();
  const { runWithAuth } = useAuth();
  const [reviews, setReviews] = React.useState<MyReview[]>([]);
  const [pagination, setPagination] = React.useState<PageInfo | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState('');
  const requestSequenceRef = React.useRef(0);

  const load = React.useCallback(async (mode: LoadMode = 'initial', page = 1) => {
    if (mode === 'refresh') setIsRefreshing(true);
    else if (mode === 'more') setIsLoadingMore(true);
    else setIsLoading(true);
    if (mode !== 'more') setError('');

    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    try {
      const result = await runWithAuth((token) => reviewApi.listMine(token, {
        page,
        limit: PAGE_SIZE,
      }));
      if (requestSequenceRef.current !== requestSequence) return;
      setReviews((current) => mode === 'more' ? mergePageItems(current, result.items) : result.items);
      setPagination(result.pagination);
    } catch (caught) {
      if (requestSequenceRef.current !== requestSequence) return;
      const message = caught instanceof Error ? caught.message : 'Vui lòng thử lại.';
      if (mode === 'more') Alert.alert('Không thể tải thêm đánh giá', message);
      else setError(message);
    } finally {
      if (requestSequenceRef.current !== requestSequence) return;
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, [runWithAuth]);

  useFocusEffect(React.useCallback(() => {
    void load();
    return () => {
      requestSequenceRef.current += 1;
    };
  }, [load]));

  const remove = (review: MyReview) => Alert.alert('Xóa đánh giá?', 'Điểm sản phẩm sẽ được tính lại.', [
    { text: 'Hủy', style: 'cancel' },
    {
      text: 'Xóa',
      style: 'destructive',
      onPress: () => {
        void (async () => {
          try {
            await runWithAuth((token) => reviewApi.deleteMine(token, review._id));
            await load('refresh');
          } catch (caught) {
            Alert.alert(
              'Không thể xóa đánh giá',
              caught instanceof Error ? caught.message : 'Vui lòng thử lại.',
            );
          }
        })();
      },
    },
  ]);
  const edit = (review: MyReview) => navigation.navigate('ReviewComposer', {
    orderId: review.orderId,
    orderItemId: review.orderItemId,
    orderCode: '—',
    productName: review.product.name,
    productImage: review.product.image,
    variantLabel: review.purchasedVariant ? `${review.purchasedVariant.color} • Size ${review.purchasedVariant.size}` : '',
    editReviewId: review._id,
    editRating: review.rating,
    editComment: review.comment,
    editCriteria: review.criteria,
    editImages: review.images,
  });
  const openProduct = (review: MyReview) => navigation.navigate('ProductDetail', {
    productId: review.product._id,
  });
  const canLoadMore = hasNextPage(pagination);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={26} color={colors.white} />
        </TouchableOpacity>
        <Text style={s.title}>Đánh giá của tôi</Text>
        <View style={s.back} />
      </View>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={(
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void load('refresh')}
            tintColor={colors.brand}
          />
        )}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.brand} />
        ) : error ? (
          <View style={s.state}>
            <Text style={s.error}>{error}</Text>
            <TouchableOpacity style={s.loadMore} onPress={() => void load()}>
              <Text style={s.loadMoreText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : reviews.length ? reviews.map((review) => (
          <View key={review._id} style={s.card}>
            <TouchableOpacity
              style={s.productImageLink}
              onPress={() => openProduct(review)}
              accessibilityRole="button"
              accessibilityLabel={`Xem chi tiết ${review.product.name}`}
            >
              <Image source={{ uri: review.product.image }} style={s.image} />
            </TouchableOpacity>
            <View style={s.copy}>
              <TouchableOpacity
                onPress={() => openProduct(review)}
                accessibilityRole="button"
                accessibilityLabel={`Xem chi tiết ${review.product.name}`}
              >
                <Text style={s.name}>{review.product.name}</Text>
              </TouchableOpacity>
              <View style={s.stars}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <MaterialCommunityIcons key={value} name={value <= review.rating ? 'star' : 'star-outline'} size={14} color="#e8a528" />
                ))}
              </View>
              <Text style={s.comment}>{review.comment}</Text>
              <Text style={s.status}>Trạng thái: {review.moderationStatus}</Text>
            </View>
            <View style={s.actions}>
              <TouchableOpacity onPress={() => edit(review)}>
                <MaterialCommunityIcons name="pencil-outline" size={22} color={colors.brand} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => remove(review)}>
                <MaterialCommunityIcons name="trash-can-outline" size={22} color={colors.danger} />
              </TouchableOpacity>
            </View>
          </View>
        )) : (
          <Text style={s.empty}>Bạn chưa có đánh giá nào.</Text>
        )}
        {canLoadMore ? (
          <TouchableOpacity
            style={s.loadMore}
            disabled={isLoadingMore}
            onPress={() => void load('more', (pagination?.page ?? 0) + 1)}
          >
            {isLoadingMore ? <ActivityIndicator color={colors.white} /> : <Text style={s.loadMoreText}>Tải thêm đánh giá</Text>}
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 64, backgroundColor: colors.brand, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center' },
  back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: colors.white, fontWeight: '900', fontSize: 18, textAlign: 'center' },
  content: { padding: spacing.md, gap: spacing.sm },
  card: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.white, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  productImageLink: { width: 64, height: 64, borderRadius: radii.sm },
  image: { width: 64, height: 64, borderRadius: radii.sm },
  copy: { flex: 1, gap: 4 },
  name: { color: colors.text, fontWeight: '900' },
  stars: { flexDirection: 'row' },
  comment: { color: colors.textBody },
  status: { color: colors.textMuted, fontSize: 12 },
  actions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  empty: { color: colors.textMuted, textAlign: 'center', padding: spacing.xl },
  state: { padding: spacing.lg, gap: spacing.md, alignItems: 'center' },
  error: { color: colors.danger, textAlign: 'center' },
  loadMore: { minHeight: 44, borderRadius: radii.sm, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  loadMoreText: { color: colors.white, fontWeight: '800' },
});
