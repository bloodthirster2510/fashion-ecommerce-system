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
import type { ReviewImageDraft } from './review.types';

export default function ReviewComposerScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'ReviewComposer'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ReviewComposer'>>();
  const { runWithAuth } = useAuth();
  const isEditMode = Boolean(route.params.editReviewId);
  const [rating, setRating] = React.useState(route.params.editRating ?? 5);
  const [comment, setComment] = React.useState(route.params.editComment ?? '');
  const [images, setImages] = React.useState<ReviewImageDraft[]>([]);
  const [loading, setLoading] = React.useState(false);

  const chooseImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Cần quyền truy cập ảnh', 'Vui lòng cho phép ứng dụng truy cập thư viện ảnh.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 5, quality: 0.85,
    });
    if (!result.canceled) {
      setImages(result.assets.slice(0, 5).map((asset, index) => ({
        uri: asset.uri,
        name: asset.fileName || `review-${Date.now()}-${index}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      })));
    }
  };

  const submit = async () => {
    if (comment.trim().length < 10) { Alert.alert('Nội dung quá ngắn', 'Đánh giá cần ít nhất 10 ký tự.'); return; }
    setLoading(true);
    try {
      if (isEditMode && route.params.editReviewId) {
        // Khi sửa, giữ nguyên ảnh cũ (không gửi keepImageIds ở phiên bản mobile đơn giản này).
        // Ảnh mới sẽ thay thế ảnh cũ nếu có; không có thì backend hiểu không đổi ảnh.
        const review = await runWithAuth((token) => reviewApi.update(token, route.params.editReviewId!, {
          rating,
          comment: comment.trim(),
          images,
        }));
        Alert.alert(
          review.moderationStatus === 'pending' ? 'Đang chờ kiểm duyệt' : 'Đã cập nhật đánh giá',
          review.moderationStatus === 'pending' ? 'Nội dung đã sửa sẽ hiển thị sau khi được duyệt.' : 'Cảm ơn bạn đã cập nhật đánh giá.',
          [{ text: 'Xong', onPress: () => navigation.goBack() }],
        );
      } else {
        const eligibility = await runWithAuth((token) => reviewApi.getEligibility(token, route.params.orderId, route.params.orderItemId));
        if (!eligibility.canReview) {
          Alert.alert('Không thể đánh giá', eligibility.reason === 'ALREADY_REVIEWED' ? 'Bạn đã đánh giá sản phẩm trong lần mua này.' : 'Đơn hàng chưa đủ điều kiện đánh giá.');
          return;
        }
        const review = await runWithAuth((token) => reviewApi.create(token, {
          orderId: route.params.orderId,
          orderItemId: route.params.orderItemId,
          rating,
          comment: comment.trim(),
          images,
        }));
        Alert.alert(
          review.moderationStatus === 'pending' ? 'Đang chờ kiểm duyệt' : 'Đã gửi đánh giá',
          review.moderationStatus === 'pending' ? 'Đánh giá sẽ hiển thị sau khi được duyệt.' : 'Cảm ơn bạn đã chia sẻ trải nghiệm.',
          [{ text: 'Xong', onPress: () => navigation.goBack() }],
        );
      }
    } catch (error) {
      Alert.alert(isEditMode ? 'Không thể cập nhật đánh giá' : 'Không thể gửi đánh giá', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally { setLoading(false); }
  };

  return <SafeAreaView style={s.safe}><View style={s.header}><TouchableOpacity onPress={() => navigation.goBack()}><MaterialCommunityIcons name="arrow-left" size={26} color={colors.white} /></TouchableOpacity><Text style={s.headerTitle}>{isEditMode ? 'Sửa đánh giá' : 'Viết đánh giá'}</Text></View><ScrollView contentContainerStyle={s.content}><View style={s.product}><Image source={{ uri: route.params.productImage }} style={s.productImage} /><View style={{ flex: 1 }}><Text style={s.productName}>{route.params.productName}</Text><Text style={s.meta}>{route.params.variantLabel}</Text><Text style={s.meta}>Đơn {route.params.orderCode}</Text></View></View><Text style={s.label}>Đánh giá tổng quan</Text><View style={s.stars}>{[1,2,3,4,5].map((value) => <TouchableOpacity key={value} onPress={() => setRating(value)}><MaterialCommunityIcons name={value <= rating ? 'star' : 'star-outline'} size={36} color="#e8a528" /></TouchableOpacity>)}</View><Text style={s.label}>Trải nghiệm của bạn</Text><TextInput style={s.input} multiline value={comment} onChangeText={setComment} maxLength={2000} placeholder="Chất liệu, kiểu dáng và độ vừa vặn thế nào?" /><TouchableOpacity style={s.secondary} onPress={chooseImages}><Text style={s.secondaryText}>Chọn ảnh thực tế ({images.length}/5)</Text></TouchableOpacity>{images.length ? <View style={s.images}>{images.map((image) => <Image key={image.uri} source={{ uri: image.uri }} style={s.image} />)}</View> : null}<TouchableOpacity style={[s.submit, loading && { opacity: .6 }]} disabled={loading} onPress={submit}><Text style={s.submitText}>{loading ? 'Đang gửi...' : (isEditMode ? 'Lưu thay đổi' : 'Gửi đánh giá')}</Text></TouchableOpacity></ScrollView></SafeAreaView>;
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background}, header:{backgroundColor:colors.brand,padding:spacing.md,flexDirection:'row',alignItems:'center',gap:spacing.md}, headerTitle:{color:colors.white,fontSize:18,fontWeight:'900'}, content:{padding:spacing.lg,gap:spacing.md}, product:{flexDirection:'row',gap:spacing.md,padding:spacing.md,borderRadius:radii.md,backgroundColor:colors.white}, productImage:{width:72,height:72,borderRadius:radii.sm}, productName:{color:colors.text,fontWeight:'900',fontSize:16}, meta:{color:colors.textMuted,marginTop:4}, label:{color:colors.text,fontWeight:'900'}, stars:{flexDirection:'row'}, input:{minHeight:140,textAlignVertical:'top',borderWidth:1,borderColor:colors.border,borderRadius:radii.md,padding:spacing.md,backgroundColor:colors.white}, secondary:{padding:spacing.md,borderWidth:1,borderColor:colors.brand,borderRadius:radii.md,alignItems:'center'}, secondaryText:{color:colors.brand,fontWeight:'800'}, images:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm}, image:{width:64,height:64,borderRadius:radii.sm}, submit:{padding:spacing.md,borderRadius:radii.md,backgroundColor:colors.brand,alignItems:'center'}, submitText:{color:colors.white,fontWeight:'900'},
});