import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../theme';
import { reviewApi } from './reviewApi';
import type { PublicReview } from './review.types';

const formatDate = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric',
}).format(new Date(value));

export default function ProductReviewsSection({ productId }: { productId: string }) {
  const [reviews, setReviews] = React.useState<PublicReview[]>([]);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let active = true;
    reviewApi.listProductReviews(productId)
      .then((result) => { if (active) setReviews(result.items); })
      .catch(() => { if (active) setError('Chưa thể tải đánh giá chi tiết.'); });
    return () => { active = false; };
  }, [productId]);

  if (error) return <Text style={s.empty}>{error}</Text>;
  if (!reviews.length) return <Text style={s.empty}>Chưa có đánh giá chi tiết cho sản phẩm này.</Text>;

  return <View style={s.list}>{reviews.map((review) => <View key={review._id} style={s.card}><View style={s.authorRow}>{review.user.avatarImage ? <Image source={{ uri: review.user.avatarImage }} style={s.avatar} /> : <View style={s.avatarFallback}><Text style={s.avatarText}>{review.user.name?.charAt(0).toUpperCase() || 'K'}</Text></View>}<View style={{ flex: 1 }}><View style={s.nameRow}><Text style={s.name}>{review.user.name || 'Khách hàng'}</Text>{review.verifiedPurchase ? <Text style={s.verified}>✓ Đã mua hàng</Text> : null}</View><View style={s.stars}>{[1,2,3,4,5].map((value) => <MaterialCommunityIcons key={value} name={value <= review.rating ? 'star' : 'star-outline'} size={14} color="#e8a528" />)}</View></View></View>{review.purchasedVariant ? <Text style={s.variant}>{review.purchasedVariant.color} • Size {review.purchasedVariant.size} • {review.purchasedVariant.fitType}</Text> : null}<Text style={s.comment}>{review.comment}</Text>{review.images.length ? <View style={s.images}>{review.images.map((image) => <Image key={image._id ?? image.url} source={{ uri: image.thumbnailUrl || image.url }} style={s.image} />)}</View> : null}{review.adminReply ? <View style={s.reply}><Text style={s.replyTitle}>Phản hồi từ Fashionista</Text><Text style={s.replyText}>{review.adminReply.content}</Text></View> : null}<View style={s.footer}><Text style={s.date}>{formatDate(review.createdAt)}</Text><Text style={s.helpful}>Hữu ích ({review.helpfulCount})</Text></View></View>)}</View>;
}

const s = StyleSheet.create({
  list:{marginTop:spacing.md,gap:spacing.sm}, card:{padding:spacing.md,borderRadius:radii.md,backgroundColor:colors.white,borderWidth:1,borderColor:colors.border,gap:spacing.sm}, authorRow:{flexDirection:'row',gap:spacing.sm,alignItems:'center'}, avatar:{width:38,height:38,borderRadius:19}, avatarFallback:{width:38,height:38,borderRadius:19,backgroundColor:colors.brandSoft,alignItems:'center',justifyContent:'center'}, avatarText:{color:colors.brand,fontWeight:'900'}, nameRow:{flexDirection:'row',alignItems:'center',gap:spacing.sm}, name:{color:colors.text,fontWeight:'900'}, verified:{color:colors.success,fontSize:11,fontWeight:'800'}, stars:{flexDirection:'row'}, variant:{color:colors.textMuted,fontSize:12}, comment:{color:colors.textBody,lineHeight:20}, images:{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs}, image:{width:62,height:62,borderRadius:radii.sm}, reply:{padding:spacing.sm,borderLeftWidth:3,borderLeftColor:colors.brand,backgroundColor:colors.brandSoft,borderRadius:radii.sm}, replyTitle:{color:colors.brand,fontWeight:'900',fontSize:12}, replyText:{color:colors.textBody,marginTop:3}, footer:{flexDirection:'row',justifyContent:'space-between'}, date:{color:colors.textSubtle,fontSize:11}, helpful:{color:colors.brand,fontSize:11,fontWeight:'800'}, empty:{color:colors.textMuted,textAlign:'center',padding:spacing.md},
});
