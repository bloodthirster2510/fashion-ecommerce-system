import React from 'react';
import { Alert, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../auth/AuthContext';
import { supportApi } from './supportApi';
import type { SupportTicketDetail } from './support.types';
import { supportStyles as s } from './supportStyles';
import { colors } from '../../theme';

const labels: Record<string, string> = { open: 'Đã tiếp nhận', in_progress: 'Đang xử lý', waiting_customer: 'Cần bạn bổ sung', resolved: 'Đã giải quyết', closed: 'Đã đóng' };

export default function SupportTicketDetailScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'SupportTicketDetail'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'SupportTicketDetail'>>(); const { runWithAuth } = useAuth();
  const [detail, setDetail] = React.useState<SupportTicketDetail | null>(null); const [reply, setReply] = React.useState(''); const [error, setError] = React.useState(''); const [sending, setSending] = React.useState(false);
  const load = React.useCallback(async () => { try { const value = await runWithAuth((token) => supportApi.getTicket(token, route.params.ticketId)); setDetail(value); if (value.ticket.lastMessageSender === 'staff') await runWithAuth((token) => supportApi.markRead(token, route.params.ticketId)); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể tải ticket.'); } }, [route.params.ticketId, runWithAuth]);
  useFocusEffect(React.useCallback(() => { void load(); }, [load]));
  const send = async () => { if (!reply.trim()) return; setSending(true); try { await runWithAuth((token) => supportApi.addMessage(token, route.params.ticketId, reply.trim(), [])); setReply(''); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể gửi tin nhắn.'); } finally { setSending(false); } };
  const close = () => Alert.alert('Đóng yêu cầu?', 'Bạn vẫn có thể xem lại lịch sử sau khi đóng.', [{ text: 'Hủy' }, { text: 'Đóng yêu cầu', style: 'destructive', onPress: () => void runWithAuth((token) => supportApi.closeTicket(token, route.params.ticketId)).then(load) }]);
  return <SafeAreaView style={s.safe} edges={['top', 'bottom']}><View style={s.header}><TouchableOpacity style={s.back} onPress={() => navigation.goBack()}><MaterialCommunityIcons name="arrow-left" size={24} color={colors.white} /></TouchableOpacity><Text style={s.headerTitle}>Chi tiết hỗ trợ</Text></View><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">{error ? <Text style={s.error}>{error}</Text> : null}{detail ? <><View style={s.card}><View style={s.row}><Text style={s.cardTitle}>{detail.ticket.ticketCode}</Text><Text style={s.secondaryText}>{labels[detail.ticket.status]}</Text></View><Text style={s.muted}>{detail.ticket.subject}</Text></View>{detail.messages.map((message) => <View key={message._id} style={message.senderType === 'staff' ? s.messageStaff : s.messageCustomer}><Text style={s.cardTitle}>{message.senderType === 'staff' ? 'Shop' : 'Bạn'}</Text><Text style={s.messageText}>{message.body}</Text>{message.attachments.length > 0 && <View style={s.imageRow}>{message.attachments.map((file) => <Image key={file.publicId} source={{ uri: file.url }} style={s.image} />)}</View>}<Text style={s.timestamp}>{new Date(message.createdAt).toLocaleString('vi-VN')}</Text></View>)}{!['closed'].includes(detail.ticket.status) && <><TextInput style={[s.input, { minHeight: 100, textAlignVertical: 'top' }]} multiline value={reply} onChangeText={setReply} placeholder="Bổ sung thông tin..." /><TouchableOpacity style={s.button} disabled={sending || !reply.trim()} onPress={send}><Text style={s.buttonText}>{sending ? 'Đang gửi...' : 'Gửi tin nhắn'}</Text></TouchableOpacity><TouchableOpacity style={[s.button, s.secondaryButton]} onPress={close}><Text style={s.secondaryText}>Đóng yêu cầu</Text></TouchableOpacity></>}</> : <Text style={s.muted}>Đang tải...</Text>}</ScrollView></SafeAreaView>;
}
