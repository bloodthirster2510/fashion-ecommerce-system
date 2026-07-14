import React from 'react';
import { Alert, Image, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../auth/AuthContext';
import { supportApi } from './supportApi';
import type { SupportCategory, SupportImage, SupportTicketType } from './support.types';
import { supportStyles as s } from './supportStyles';
import { colors } from '../../theme';

const types: Array<[SupportTicketType, string]> = [['question', 'Câu hỏi'], ['issue', 'Sự cố'], ['complaint', 'Khiếu nại'], ['feedback', 'Góp ý'], ['suggestion', 'Đề xuất']];
const categories: Array<[SupportCategory, string]> = [['orders', 'Đơn hàng'], ['shipping', 'Giao hàng'], ['returns', 'Đổi trả'], ['payments', 'Thanh toán'], ['promotions', 'Voucher'], ['loyalty', 'Thành viên'], ['account', 'Tài khoản'], ['product', 'Sản phẩm'], ['app_website', 'Ứng dụng'], ['service', 'Dịch vụ'], ['other', 'Khác']];
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export default function SupportTicketCreateScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'SupportTicketCreate'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'SupportTicketCreate'>>();
  const { runWithAuth } = useAuth();
  const [type, setType] = React.useState<SupportTicketType>(route.params?.type ?? 'question');
  const [category, setCategory] = React.useState<SupportCategory>(route.params?.category ?? (route.params?.orderId ? 'orders' : 'other'));
  const [subject, setSubject] = React.useState(''); const [body, setBody] = React.useState('');
  const [orderId, setOrderId] = React.useState(route.params?.orderId ?? '');
  const [couponCode, setCouponCode] = React.useState(route.params?.couponCode ?? '');
  const [requiresReply, setRequiresReply] = React.useState(!['feedback', 'suggestion'].includes(type));
  const [images, setImages] = React.useState<SupportImage[]>([]); const [loading, setLoading] = React.useState(false); const [error, setError] = React.useState('');
  const submittingRef = React.useRef(false);

  const chooseImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 3, quality: 0.85 });
    if (!result.canceled) {
      if (result.assets.length > 3) { setError('Chỉ được chọn tối đa 3 ảnh.'); return; }
      if (result.assets.some((asset) => !allowedImageTypes.has(asset.mimeType || ''))) { setError('Chỉ hỗ trợ ảnh JPEG, PNG hoặc WEBP.'); return; }
      if (result.assets.some((asset) => (asset.fileSize ?? 0) > 5 * 1024 * 1024)) { setError('Mỗi ảnh phải có dung lượng không quá 5MB.'); return; }
      setError('');
      setImages(result.assets.map((asset, index) => ({ uri: asset.uri, name: asset.fileName || `support-${Date.now()}-${index}.jpg`, type: asset.mimeType || 'image/jpeg', size: asset.fileSize })));
    }
  };

  const submit = async () => {
    if (submittingRef.current) return;
    if (subject.trim().length < 5 || body.trim().length < 10) { setError('Tiêu đề cần ít nhất 5 ký tự và nội dung ít nhất 10 ký tự.'); return; }
    if (['orders', 'returns', 'payments'].includes(category) && !orderId.trim()) { setError('Vui lòng nhập/chọn đơn hàng liên quan.'); return; }
    submittingRef.current = true; setLoading(true); setError('');
    try {
      const result = await runWithAuth((token) => supportApi.createTicket(token, { type, category, subject: subject.trim(), body: body.trim(), requiresReply, orderId: orderId.trim() || undefined, couponCode: couponCode.trim() || undefined, images, contextSource: route.params?.contextSource, screen: 'SupportTicketCreate', errorCode: route.params?.errorCode }));
      Alert.alert('Đã gửi yêu cầu', `Mã ticket: ${result.ticket.ticketCode}`, [{ text: 'Xem yêu cầu', onPress: () => navigation.replace('SupportTicketDetail', { ticketId: result.ticket._id }) }]);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể gửi yêu cầu.'); } finally { submittingRef.current = false; setLoading(false); }
  };

  return <SafeAreaView style={s.safe} edges={['top', 'bottom']}><View style={s.header}><TouchableOpacity style={s.back} onPress={() => navigation.goBack()}><MaterialCommunityIcons name="arrow-left" size={24} color={colors.white} /></TouchableOpacity><Text style={s.headerTitle}>Gửi yêu cầu</Text></View><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">{error ? <Text style={s.error}>{error}</Text> : null}<Text style={s.label}>Loại yêu cầu</Text><View style={s.chips}>{types.map(([value, label]) => <TouchableOpacity key={value} style={[s.chip, type === value && s.chipActive]} onPress={() => { setType(value); setRequiresReply(!['feedback', 'suggestion'].includes(value)); }}><Text style={[s.chipText, type === value && s.chipTextActive]}>{label}</Text></TouchableOpacity>)}</View><Text style={s.label}>Chủ đề</Text><View style={s.chips}>{categories.map(([value, label]) => <TouchableOpacity key={value} style={[s.chip, category === value && s.chipActive]} onPress={() => setCategory(value)}><Text style={[s.chipText, category === value && s.chipTextActive]}>{label}</Text></TouchableOpacity>)}</View>{['orders', 'returns', 'payments'].includes(category) && <><Text style={s.label}>ID đơn hàng</Text><TextInput style={s.input} value={orderId} onChangeText={setOrderId} placeholder="Chọn từ chi tiết đơn để tự điền" autoCapitalize="none" /></>}{category === 'promotions' && <><Text style={s.label}>Mã voucher</Text><TextInput style={s.input} value={couponCode} onChangeText={setCouponCode} placeholder="VD: WELCOME10" autoCapitalize="characters" /></>}<Text style={s.label}>Tiêu đề</Text><TextInput style={s.input} value={subject} onChangeText={setSubject} maxLength={150} placeholder="Mô tả ngắn vấn đề" /><Text style={s.label}>Nội dung</Text><TextInput style={[s.input, { minHeight: 130, textAlignVertical: 'top' }]} value={body} onChangeText={setBody} maxLength={3000} multiline placeholder="Cho shop biết chi tiết vấn đề của bạn..." /><View style={s.row}><Text style={s.label}>Tôi muốn nhận phản hồi</Text><Switch value={requiresReply} onValueChange={setRequiresReply} trackColor={{ true: colors.brand }} /></View><TouchableOpacity style={[s.button, s.secondaryButton]} onPress={chooseImages}><Text style={s.secondaryText}>Chọn ảnh minh chứng ({images.length}/3)</Text></TouchableOpacity>{images.length > 0 && <View style={s.imageRow}>{images.map((image) => <Image key={image.uri} source={{ uri: image.uri }} style={s.image} />)}</View>}<TouchableOpacity style={s.button} disabled={loading} onPress={submit}><Text style={s.buttonText}>{loading ? 'Đang gửi...' : 'Gửi yêu cầu'}</Text></TouchableOpacity></ScrollView></SafeAreaView>;
}
