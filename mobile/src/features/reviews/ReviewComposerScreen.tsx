import React from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
const sizeFitOptions: Array<{ value: NonNullable<ReviewCriteria['sizeFit']>; label: string }> = [
  { value: 'small', label: 'Hơi chật' },
  { value: 'true_to_size', label: 'Đúng size' },
  { value: 'large', label: 'Hơi rộng' },
];

export default function ReviewComposerScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'ReviewComposer'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ReviewComposer'>>();
  const { runWithAuth } = useAuth();
  const isEditMode = Boolean(route.params.editReviewId);
  const initialCriteria = route.params.editCriteria;
  const [rating, setRating] = React.useState(route.params.editRating ?? 5);
  const [comment, setComment] = React.useState(route.params.editComment ?? '');
  const [productQuality, setProductQuality] = React.useState(initialCriteria?.productQuality ?? 5);
  const [descriptionMatch, setDescriptionMatch] = React.useState(initialCriteria?.descriptionMatch ?? 5);
  const [sizeFit, setSizeFit] = React.useState<NonNullable<ReviewCriteria['sizeFit']>>(
    initialCriteria?.sizeFit ?? 'true_to_size',
  );
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
    const commentError = getReviewCommentError(comment);
    if (commentError) {
      Alert.alert('Nội dung quá ngắn', commentError);
      return;
    }
    const criteria: ReviewCriteria = { productQuality, descriptionMatch, sizeFit };
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

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={26} color={colors.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{isEditMode ? 'Sửa đánh giá' : 'Viết đánh giá'}</Text>
      </View>
      <ScrollView contentContainerStyle={s.pageContent}>
        <View style={s.product}>
          <Image source={{ uri: route.params.productImage }} style={s.productImage} />
          <View style={s.productCopy}>
            <Text style={s.productName}>{route.params.productName}</Text>
            <Text style={s.meta}>{route.params.variantLabel}</Text>
            <Text style={s.meta}>Đơn {route.params.orderCode}</Text>
          </View>
        </View>

        <Text style={s.label}>Đánh giá tổng quan</Text>
        <View style={s.stars}>
          {scoreOptions.map((value) => (
            <TouchableOpacity key={value} onPress={() => setRating(value)}>
              <MaterialCommunityIcons name={value <= rating ? 'star' : 'star-outline'} size={36} color="#e8a528" />
            </TouchableOpacity>
          ))}
        </View>

        <CriteriaScore label="Chất lượng sản phẩm" value={productQuality} onChange={setProductQuality} />
        <CriteriaScore label="Đúng với mô tả" value={descriptionMatch} onChange={setDescriptionMatch} />
        <Text style={s.label}>Độ vừa vặn</Text>
        <View style={s.optionRow}>
          {sizeFitOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[s.option, sizeFit === option.value && s.optionActive]}
              onPress={() => setSizeFit(option.value)}
            >
              <Text style={[s.optionText, sizeFit === option.value && s.optionTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>Trải nghiệm của bạn</Text>
        <TextInput
          style={s.input}
          multiline
          value={comment}
          onChangeText={setComment}
          maxLength={2000}
          placeholder="Chất liệu, kiểu dáng và độ vừa vặn thế nào?"
        />
        <TouchableOpacity style={s.secondary} onPress={chooseImages}>
          <Text style={s.secondaryText}>Chọn ảnh thực tế ({existingImages.length + images.length}/5)</Text>
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
        <TouchableOpacity style={[s.submit, loading && s.submitDisabled]} disabled={loading} onPress={submit}>
          <Text style={s.submitText}>{loading ? 'Đang gửi...' : isEditMode ? 'Lưu thay đổi' : 'Gửi đánh giá'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function CriteriaScore({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <View style={s.criteriaBlock}>
      <Text style={s.label}>{label}</Text>
      <View style={s.scoreRow}>
        {scoreOptions.map((score) => (
          <TouchableOpacity
            key={score}
            style={[s.scoreOption, score === value && s.scoreOptionActive]}
            onPress={() => onChange(score)}
          >
            <Text style={[s.scoreOptionText, score === value && s.scoreOptionTextActive]}>{score}</Text>
          </TouchableOpacity>
        ))}
      </View>
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
  header: { backgroundColor: colors.brand, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerTitle: { color: colors.white, fontSize: 18, fontWeight: '900' },
  pageContent: { padding: spacing.lg, gap: spacing.md },
  product: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.white },
  productCopy: { flex: 1 },
  productImage: { width: 72, height: 72, borderRadius: radii.sm },
  productName: { color: colors.text, fontWeight: '900', fontSize: 16 },
  meta: { color: colors.textMuted, marginTop: 4 },
  label: { color: colors.text, fontWeight: '900' },
  stars: { flexDirection: 'row' },
  criteriaBlock: { gap: spacing.sm },
  scoreRow: { flexDirection: 'row', gap: spacing.sm },
  scoreOption: { width: 42, height: 38, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  scoreOptionActive: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  scoreOptionText: { color: colors.textMuted, fontWeight: '800' },
  scoreOptionTextActive: { color: colors.brand },
  optionRow: { flexDirection: 'row', gap: spacing.sm },
  option: { flex: 1, minHeight: 40, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  optionActive: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  optionText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  optionTextActive: { color: colors.brand },
  input: { minHeight: 140, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.md, backgroundColor: colors.white },
  secondary: { padding: spacing.md, borderWidth: 1, borderColor: colors.brand, borderRadius: radii.md, alignItems: 'center' },
  secondaryText: { color: colors.brand, fontWeight: '800' },
  images: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  imageWrap: { position: 'relative' },
  image: { width: 64, height: 64, borderRadius: radii.sm },
  removeImage: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  submit: { padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.brand, alignItems: 'center' },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: colors.white, fontWeight: '900' },
});
