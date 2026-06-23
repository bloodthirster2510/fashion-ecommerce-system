import React from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { colors, radii, spacing } from '../../theme';
import { useAuth } from '../auth/AuthContext';
import { reviewApi } from './reviewApi';
import type { MyReview } from './review.types';

export default function MyReviewsScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'MyReviews'>>();
  const { runWithAuth } = useAuth();
  const [reviews, setReviews] = React.useState<MyReview[]>([]);
  const load = React.useCallback(() => runWithAuth((token) => reviewApi.listMine(token)).then((result) => setReviews(result.items)).catch((error) => Alert.alert('Không thể tải đánh giá', error instanceof Error ? error.message : 'Vui lòng thử lại.')), [runWithAuth]);
  useFocusEffect(React.useCallback(() => { void load(); }, [load]));
  const remove = (review: MyReview) => Alert.alert('Xóa đánh giá?', 'Điểm sản phẩm sẽ được tính lại.', [{ text:'Hủy',style:'cancel' }, { text:'Xóa',style:'destructive',onPress:() => void runWithAuth((token) => reviewApi.deleteMine(token, review._id)).then(load) }]);
  const edit = (review: MyReview) => navigation.navigate('ReviewComposer', {
    orderId: review.orderId,
    orderItemId: review.purchasedVariant ? review.purchasedVariant.sku : '',
    orderCode: '—',
    productName: review.product.name,
    productImage: review.product.image,
    variantLabel: review.purchasedVariant ? `${review.purchasedVariant.color} • Size ${review.purchasedVariant.size}` : '',
    editReviewId: review._id,
    editRating: review.rating,
    editComment: review.comment,
  });
  return <SafeAreaView style={s.safe}><View style={s.header}><TouchableOpacity onPress={() => navigation.goBack()}><MaterialCommunityIcons name="arrow-left" size={26} color={colors.white} /></TouchableOpacity><Text style={s.title}>Đánh giá của tôi</Text></View><ScrollView contentContainerStyle={s.content}>{reviews.length ? reviews.map((review) => <View key={review._id} style={s.card}><Image source={{ uri: review.product.image }} style={s.image} /><View style={s.copy}><Text style={s.name}>{review.product.name}</Text><View style={s.stars}>{[1,2,3,4,5].map((value) => <MaterialCommunityIcons key={value} name={value <= review.rating ? 'star' : 'star-outline'} size={14} color="#e8a528" />)}</View><Text style={s.comment}>{review.comment}</Text><Text style={s.status}>Trạng thái: {review.moderationStatus}</Text></View><View style={s.actions}><TouchableOpacity onPress={() => edit(review)}><MaterialCommunityIcons name="pencil-outline" size={22} color={colors.brand} /></TouchableOpacity><TouchableOpacity onPress={() => remove(review)}><MaterialCommunityIcons name="trash-can-outline" size={22} color={colors.danger} /></TouchableOpacity></View></View>) : <Text style={s.empty}>Bạn chưa có đánh giá nào.</Text>}</ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:colors.background},header:{backgroundColor:colors.brand,padding:spacing.md,flexDirection:'row',alignItems:'center',gap:spacing.md},title:{color:colors.white,fontWeight:'900',fontSize:18},content:{padding:spacing.md,gap:spacing.sm},card:{flexDirection:'row',gap:spacing.sm,padding:spacing.md,backgroundColor:colors.white,borderRadius:radii.md,borderWidth:1,borderColor:colors.border},image:{width:64,height:64,borderRadius:radii.sm},copy:{flex:1,gap:4},name:{color:colors.text,fontWeight:'900'},stars:{flexDirection:'row'},comment:{color:colors.textBody},status:{color:colors.textMuted,fontSize:12},actions:{flexDirection:'row',gap:spacing.sm,alignItems:'center'},empty:{color:colors.textMuted,textAlign:'center',padding:spacing.xl}});
