import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { colors, radii, spacing } from '../../theme';
import { useAuth } from '../auth/AuthContext';
import { reviewApi } from './reviewApi';
import type { ReviewCriteria, ReviewImage, ReviewImageDraft } from './review.types';
import {
  getAvailableReviewImageSlots,
  getReviewCommentError,
  getReviewEligibilityMessage,
} from './reviewPresentation';

const scoreOptions = [1, 2, 3, 4, 5] as const;
const ratingLabels = ['Rất không hài lòng', 'Chưa hài lòng', 'Bình thường', 'Hài lòng', 'Rất hài lòng'] as const;
const scoreLabels = ['Chưa tốt', 'Cần cải thiện', 'Ổn', 'Tốt', 'Tuyệt vời'] as const;
const sizeFitOptions: Array<{
  value: NonNullable<ReviewCriteria['sizeFit']>;
  label: string;
}> = [
  { value: 'small', label: 'Hơi chật' },
  { value: 'true_to_size', label: 'Vừa vặn' },
  { value: 'large', label: 'Hơi rộng' },
];

export default function ReviewComposerScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'ReviewComposer'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ReviewComposer'>>();
  const { runWithAuth } = useAuth();
  const isEditMode = Boolean(route.params.editReviewId);
  const initialCriteria = route.params.editCriteria;
  const [rating, setRating] = React.useState(route.params.editRating ?? 0);
  const [comment, setComment] = React.useState(route.params.editComment ?? '');
  const [productQuality, setProductQuality] = React.useState(initialCriteria?.productQuality ?? 0);
  const [descriptionMatch, setDescriptionMatch] = React.useState(initialCriteria?.descriptionMatch ?? 0);
  const [sizeFit, setSizeFit] = React.useState<ReviewCriteria['sizeFit']>(initialCriteria?.sizeFit);
  const [existingImages, setExistingImages] = React.useState<ReviewImage[]>(route.params.editImages ?? []);
  const [images, setImages] = React.useState<ReviewImageDraft[]>([]);
  const [loading, setLoading] = React.useState(false);

  const chooseImages = async () => {
    const availableSlots = getAvailableReviewImageSlots(existingImages.length, images.length);
    if (availableSlots <= 0) {
      Alert.alert('Đã đủ ảnh', 'Mỗi đánh giá được giữ tối đa 5 ảnh.');
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Cần quyền truy cập ảnh', 'Vui lòng cho phép ứng dụng truy cập thư viện ảnh.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: availableSlots,
      quality: 0.85,
    });
    if (!result.canceled) {
      const selected = result.assets.slice(0, availableSlots).map((asset, index) => ({
        uri: asset.uri,
        name: asset.fileName || `review-${Date.now()}-${index}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      }));
      setImages((current) => [...current, ...selected]);
    }
  };

  const submit = async () => {
    if (rating === 0) {
      Alert.alert('Chưa chọn số sao', 'Vui lòng chọn điểm đánh giá tổng quan cho sản phẩm.');
      return;
    }
    const commentError = getReviewCommentError(comment);
    if (commentError) {
      Alert.alert('Nội dung quá ngắn', commentError);
      return;
    }
    const criteria: ReviewCriteria | undefined = productQuality > 0 || descriptionMatch > 0 || sizeFit
      ? {
          ...(productQuality > 0 ? { productQuality } : {}),
          ...(descriptionMatch > 0 ? { descriptionMatch } : {}),
          ...(sizeFit ? { sizeFit } : {}),
        }
      : undefined;
    setLoading(true);
    try {
      if (isEditMode && route.params.editReviewId) {
        const review = await runWithAuth((token) => reviewApi.update(token, route.params.editReviewId!, {
          rating,
          comment: comment.trim(),
          criteria,
          keepImageIds: existingImages.flatMap((image) => image._id ? [image._id] : []),
          images,
        }));
        Alert.alert(
          review.moderationStatus === 'pending' ? 'Đang chờ kiểm duyệt' : 'Đã cập nhật đánh giá',
          review.moderationStatus === 'pending'
            ? 'Nội dung đã sửa sẽ hiển thị sau khi được duyệt.'
            : 'Cảm ơn bạn đã cập nhật đánh giá.',
          [{ text: 'Xong', onPress: () => navigation.goBack() }],
        );
      } else {
        const eligibility = await runWithAuth((token) => reviewApi.getEligibility(
          token,
          route.params.orderId,
          route.params.orderItemId,
        ));
        if (!eligibility.canReview) {
          Alert.alert(
            'Không thể đánh giá',
            getReviewEligibilityMessage(eligibility.reason),
          );
          return;
        }
        const review = await runWithAuth((token) => reviewApi.create(token, {
          orderId: route.params.orderId,
          orderItemId: route.params.orderItemId,
          rating,
          comment: comment.trim(),
          criteria,
          images,
        }));
        Alert.alert(
          review.moderationStatus === 'pending' ? 'Đang chờ kiểm duyệt' : 'Đã gửi đánh giá',
          review.moderationStatus === 'pending'
            ? 'Đánh giá sẽ hiển thị sau khi được duyệt.'
            : 'Cảm ơn bạn đã chia sẻ trải nghiệm.',
          [{ text: 'Xong', onPress: () => navigation.goBack() }],
        );
      }
    } catch (error) {
      Alert.alert(
        isEditMode ? 'Không thể cập nhật đánh giá' : 'Không thể gửi đánh giá',
        error instanceof Error ? error.message : 'Vui lòng thử lại.',
      );
    } finally {
      setLoading(false);
    }
  };

  const isSubmitReady = rating > 0 && comment.trim().length >= 10;
  const footerMessage = rating === 0
    ? 'Chọn điểm tổng quan để tiếp tục'
    : comment.trim().length < 10
      ? 'Viết ít nhất 10 ký tự về trải nghiệm của bạn'
      : 'Nội dung phù hợp sẽ được hiển thị ngay sau khi gửi';

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.headerAction} onPress={() => navigation.goBack()} accessibilityLabel="Quay lại">
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{isEditMode ? 'Sửa đánh giá' : 'Viết đánh giá'}</Text>
        <View style={s.headerAction} />
      </View>
      <KeyboardAvoidingView style={s.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={s.pageContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.product}>
            <Image source={{ uri: route.params.productImage }} style={s.productImage} />
            <View style={s.productCopy}>
              <Text style={s.productName} numberOfLines={2}>{route.params.productName}</Text>
              <Text style={s.meta}>{route.params.variantLabel}</Text>
              <View style={s.purchaseRow}>
                <MaterialCommunityIcons name="check-decagram" size={14} color={colors.success} />
                <Text style={s.purchaseText}>Đã mua hàng · Đơn {route.params.orderCode}</Text>
              </View>
            </View>
          </View>

          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Đánh giá sản phẩm</Text>
              <Text style={s.requiredNote}>* Bắt buộc</Text>
            </View>
            <Text style={s.fieldLabel}>Trải nghiệm tổng thể</Text>
            <View style={s.overallRating}>
              <StarSelector value={rating} size={34} onChange={setRating} />
              <Text style={[s.ratingLabel, rating === 0 && s.ratingLabelInactive]}>
                {rating > 0 ? `${rating}/5 · ${ratingLabels[rating - 1]}` : 'Chạm vào sao để chọn điểm'}
              </Text>
            </View>
            <View style={s.criteriaGroup}>
              <Text style={s.criteriaGroupLabel}>Chi tiết thêm · không bắt buộc</Text>
              <CriteriaScore label="Chất lượng" value={productQuality} onChange={setProductQuality} />
              <CriteriaScore label="Đúng mô tả" value={descriptionMatch} onChange={setDescriptionMatch} />
            </View>
          </View>

          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Độ vừa vặn</Text>
              <Text style={s.optionalNote}>Không bắt buộc</Text>
            </View>
            <Text style={s.sectionHintCompact}>So với size bạn thường mặc</Text>
            <View style={s.fitOptions}>
              {sizeFitOptions.map((option) => {
                const active = sizeFit === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[s.fitOption, active && s.fitOptionActive]}
                    onPress={() => setSizeFit(active ? undefined : option.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                  >
                    <Text style={[s.fitLabel, active && s.fitLabelActive]}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Chia sẻ trải nghiệm</Text>
              <Text style={s.requiredNote}>* Bắt buộc</Text>
            </View>
            <Text style={s.sectionHintCompact}>Chất liệu, màu sắc và phom dáng khi mặc thế nào?</Text>
            <TextInput
              style={s.input}
              multiline
              value={comment}
              onChangeText={setComment}
              maxLength={2000}
            />
            <View style={s.inputMeta}>
              <Text style={s.inputHelp}>Tối thiểu 10 ký tự</Text>
              <Text style={s.characterCount}>{comment.length}/2000</Text>
            </View>

            <TouchableOpacity style={s.photoPicker} onPress={chooseImages} accessibilityLabel="Chọn ảnh thực tế">
              <MaterialCommunityIcons name="camera-plus-outline" size={22} color={colors.brandDark} />
              <View style={s.photoCopy}>
                <Text style={s.photoTitle}>Thêm ảnh thực tế <Text style={s.photoCount}>{existingImages.length + images.length}/5</Text></Text>
                <Text style={s.photoHint}>JPEG, PNG hoặc WebP</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textSubtle} />
            </TouchableOpacity>
            {existingImages.length || images.length ? (
              <View style={s.images}>
                {existingImages.map((image) => (
                  <ImagePreview
                    key={image._id ?? image.url}
                    uri={image.thumbnailUrl || image.url}
                    onRemove={() => setExistingImages((current) => current.filter((item) => item !== image))}
                  />
                ))}
                {images.map((image) => (
                  <ImagePreview
                    key={image.uri}
                    uri={image.uri}
                    onRemove={() => setImages((current) => current.filter((item) => item.uri !== image.uri))}
                  />
                ))}
              </View>
            ) : null}
          </View>
        </ScrollView>
        <View style={s.footer}>
          <Text style={s.footerNote}>{footerMessage}</Text>
          <TouchableOpacity
            style={[s.submit, (!isSubmitReady || loading) && s.submitDisabled]}
            disabled={!isSubmitReady || loading}
            onPress={submit}
          >
            {loading ? <ActivityIndicator size="small" color={colors.white} /> : null}
            <Text style={s.submitText}>{loading ? 'Đang gửi...' : isEditMode ? 'Lưu thay đổi' : 'Gửi đánh giá'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StarSelector({
  value,
  size,
  compact = false,
  allowClear = false,
  onChange,
}: {
  value: number;
  size: number;
  compact?: boolean;
  allowClear?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <View style={s.stars} accessibilityRole="radiogroup">
      {scoreOptions.map((score) => (
        <TouchableOpacity
          key={score}
          style={[s.starTouch, compact && s.starTouchCompact]}
          onPress={() => onChange(allowClear && score === value ? 0 : score)}
          accessibilityRole="radio"
          accessibilityLabel={`${score} sao`}
          accessibilityState={{ checked: score === value }}
        >
          <MaterialCommunityIcons
            name={score <= value ? 'star' : 'star-outline'}
            size={size}
            color={score <= value ? colors.goldDark : colors.borderStrong}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function CriteriaScore({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <View style={s.criteriaBlock}>
      <View style={s.criteriaCopy}>
        <Text style={s.fieldLabel}>{label}</Text>
        <Text style={[s.criteriaValue, value === 0 && s.criteriaValueInactive]}>
          {value > 0 ? scoreLabels[value - 1] : 'Chưa chọn'}
        </Text>
      </View>
      <StarSelector value={value} size={21} compact allowClear onChange={onChange} />
    </View>
  );
}

function ImagePreview({ uri, onRemove }: { uri: string; onRemove: () => void }) {
  return (
    <View style={s.imageWrap}>
      <Image source={{ uri }} style={s.image} />
      <TouchableOpacity style={s.removeImage} onPress={onRemove} accessibilityLabel="Xóa ảnh đánh giá">
        <MaterialCommunityIcons name="close" size={14} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  keyboard: { flex: 1 },
  header: { minHeight: 64, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.brand },
  headerAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: colors.white, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  pageContent: { paddingBottom: spacing.xl },
  product: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surface },
  productCopy: { flex: 1, justifyContent: 'center' },
  productImage: { width: 56, height: 68, borderRadius: radii.xs, backgroundColor: colors.field },
  productName: { color: colors.text, fontWeight: '800', fontSize: 14, lineHeight: 19 },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: spacing.xs },
  purchaseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  purchaseText: { flex: 1, color: colors.success, fontSize: 11, fontWeight: '700' },
  section: { marginTop: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, backgroundColor: colors.surface },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 17, lineHeight: 23, fontWeight: '800' },
  requiredNote: { color: colors.danger, fontSize: 10, fontWeight: '700' },
  optionalNote: { color: colors.textSubtle, fontSize: 10, fontWeight: '600' },
  sectionHintCompact: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: -spacing.xs, marginBottom: spacing.sm },
  fieldLabel: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  overallRating: { marginTop: spacing.sm },
  stars: { flexDirection: 'row', alignItems: 'center' },
  starTouch: { minWidth: 38, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  starTouchCompact: { minWidth: 27, minHeight: 36 },
  ratingLabel: { color: colors.goldText, fontSize: 12, fontWeight: '800', marginTop: spacing.xs },
  ratingLabelInactive: { color: colors.textSubtle, fontWeight: '600' },
  criteriaGroup: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  criteriaGroupLabel: { color: colors.textSubtle, fontSize: 10, fontWeight: '600', marginBottom: 2 },
  criteriaBlock: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  criteriaCopy: { flex: 1, minWidth: 0 },
  criteriaValue: { color: colors.textMuted, fontSize: 10, fontWeight: '600', marginTop: 2 },
  criteriaValueInactive: { color: colors.textSubtle, fontWeight: '500' },
  fitOptions: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  fitOption: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  fitOptionActive: { borderBottomColor: colors.brandDark },
  fitLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  fitLabelActive: { color: colors.brandDark, fontWeight: '800' },
  input: { minHeight: 112, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radii.sm, padding: spacing.md, backgroundColor: colors.surface, color: colors.textBody, fontSize: 14, lineHeight: 21 },
  inputMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  inputHelp: { color: colors.textSubtle, fontSize: 11 },
  characterCount: { color: colors.textSubtle, fontSize: 11 },
  photoPicker: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, paddingVertical: spacing.xs, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  photoCopy: { flex: 1 },
  photoTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  photoCount: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  photoHint: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  images: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  imageWrap: { position: 'relative' },
  image: { width: 64, height: 76, borderRadius: radii.xs, backgroundColor: colors.field },
  removeImage: { position: 'absolute', top: -7, right: -7, width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.white, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  footerNote: { color: colors.textMuted, fontSize: 10, textAlign: 'center', marginBottom: spacing.sm },
  submit: { minHeight: 48, flexDirection: 'row', gap: spacing.sm, borderRadius: radii.xs, backgroundColor: colors.brandDark, alignItems: 'center', justifyContent: 'center' },
  submitDisabled: { opacity: 0.42 },
  submitText: { color: colors.white, fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
});
