import React from 'react';
import { Alert, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../auth/AuthContext';
import { supportApi } from './supportApi';
import { useSupportRealtime } from './supportSocket';
import type { SupportMessage, SupportTicket, SupportTicketDetail } from './support.types';
import { supportStyles as s } from './supportStyles';
import { colors } from '../../theme';

const labels: Record<string, string> = { open: 'Đã tiếp nhận', in_progress: 'Đang xử lý', waiting_customer: 'Cần bạn bổ sung', resolved: 'Đã giải quyết', closed: 'Đã đóng' };

export default function SupportTicketDetailScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'SupportTicketDetail'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'SupportTicketDetail'>>();
  const { runWithAuth, session } = useAuth();
  const ticketId = route.params.ticketId;

  const [detail, setDetail] = React.useState<SupportTicketDetail | null>(null);
  const [liveMessages, setLiveMessages] = React.useState<SupportMessage[]>([]);
  const [liveTicket, setLiveTicket] = React.useState<SupportTicket | null>(null);
  const [reply, setReply] = React.useState('');
  const [error, setError] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [reopening, setReopening] = React.useState(false);
  const [staffTyping, setStaffTyping] = React.useState(false);
  const typingTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = React.useCallback(async () => {
    try {
      const value = await runWithAuth((token) => supportApi.getTicket(token, ticketId));
      setDetail(value);
      setLiveMessages(value.messages);
      setLiveTicket(value.ticket);
      if (value.ticket.lastMessageSender === 'staff') {
        await runWithAuth((token) => supportApi.markRead(token, ticketId)).catch(() => {});
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể tải ticket.');
    }
  }, [ticketId, runWithAuth]);

  useFocusEffect(React.useCallback(() => { void load(); }, [load]));

  const realtime = useSupportRealtime(session?.accessToken ?? null, {
    onMessage: (id, message) => {
      if (id !== ticketId) return;
      setLiveMessages((prev) => (prev.some((m) => m._id === message._id) ? prev : [...prev, message]));
      setStaffTyping(false);
      void runWithAuth((token) => supportApi.markRead(token, ticketId)).catch(() => {});
    },
    onTyping: (id, isTyping) => {
      if (id !== ticketId) return;
      setStaffTyping(isTyping);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (isTyping) typingTimerRef.current = setTimeout(() => setStaffTyping(false), 4000);
    },
    onUpdated: (id, ticket) => {
      if (id !== ticketId) return;
      setLiveTicket(ticket);
    },
  });

  React.useEffect(() => {
    realtime.subscribeTicket(ticketId);
    return () => { realtime.unsubscribeTicket(ticketId); };
  }, [ticketId, realtime]);

  const send = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await runWithAuth((token) => supportApi.addMessage(token, ticketId, reply.trim(), []));
      setReply('');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể gửi tin nhắn.');
    } finally {
      setSending(false);
    }
  };

  const close = () => Alert.alert(
    'Đóng yêu cầu?',
    'Bạn vẫn có thể xem lại lịch sử sau khi đóng.',
    [{ text: 'Hủy' }, { text: 'Đóng yêu cầu', style: 'destructive', onPress: () => void runWithAuth((token) => supportApi.closeTicket(token, ticketId)).then(load) }],
  );

  const reopen = async () => {
    setReopening(true);
    try {
      await runWithAuth((token) => supportApi.reopenTicket(token, ticketId));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể mở lại yêu cầu.');
    } finally {
      setReopening(false);
    }
  };

  const ticket = liveTicket ?? detail?.ticket;
  const messages = liveMessages.length ? liveMessages : (detail?.messages ?? []);
  const status = ticket?.status ?? 'open';
  const isClosed = status === 'closed';
  const canReopen = status === 'resolved';

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Chi tiết hỗ trợ</Text>
        {realtime.connected && <MaterialCommunityIcons name="circle-medium" size={14} color="#4ade80" style={{ marginRight: 4 }} />}
      </View>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {error ? <Text style={s.error}>{error}</Text> : null}
        {ticket ? (
          <>
            <View style={s.card}>
              <View style={s.row}>
                <Text style={s.cardTitle}>{ticket.ticketCode}</Text>
                <Text style={s.secondaryText}>{labels[status] ?? status}</Text>
              </View>
              <Text style={s.muted}>{ticket.subject}</Text>
            </View>

            {messages.map((message) => (
              <View key={message._id} style={message.senderType === 'staff' ? s.messageStaff : s.messageCustomer}>
                <Text style={s.cardTitle}>{message.senderType === 'staff' ? 'Shop' : 'Bạn'}</Text>
                <Text style={s.messageText}>{message.body}</Text>
                {message.attachments.length > 0 && (
                  <View style={s.imageRow}>
                    {message.attachments.map((file) => <Image key={file.publicId} source={{ uri: file.url }} style={s.image} />)}
                  </View>
                )}
                <Text style={s.timestamp}>{new Date(message.createdAt).toLocaleString('vi-VN')}</Text>
              </View>
            ))}

            {staffTyping && (
              <View style={s.messageStaff}>
                <Text style={s.cardTitle}>Shop</Text>
                <Text style={[s.messageText, { fontStyle: 'italic', color: colors.textSubtle }]}>Đang gõ...</Text>
              </View>
            )}

            {!isClosed && !canReopen && (
              <>
                <TextInput
                  style={[s.input, { minHeight: 100, textAlignVertical: 'top' }]}
                  multiline
                  value={reply}
                  onChangeText={(value) => {
                    setReply(value);
                    realtime.emitTyping(ticketId, value.trim().length > 0);
                  }}
                  placeholder="Bổ sung thông tin..."
                />
                <TouchableOpacity style={s.button} disabled={sending || !reply.trim()} onPress={send}>
                  <Text style={s.buttonText}>{sending ? 'Đang gửi...' : 'Gửi tin nhắn'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.button, s.secondaryButton]} onPress={close}>
                  <Text style={s.secondaryText}>Đóng yêu cầu</Text>
                </TouchableOpacity>
              </>
            )}

            {canReopen && (
              <View style={[s.card, { backgroundColor: '#fff7e8', borderColor: '#f3d9a0' }]}>
                <Text style={[s.muted, { color: '#8a6d2b' }]}>Yêu cầu đã được đánh dấu giải quyết. Vấn đề chưa hết? Mở lại để tiếp tục trao đổi.</Text>
                <TouchableOpacity style={s.button} disabled={reopening} onPress={reopen}>
                  <Text style={s.buttonText}>{reopening ? 'Đang mở lại...' : 'Mở lại yêu cầu'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {isClosed && (
              <View style={s.card}>
                <Text style={s.muted}>Yêu cầu đã đóng. Bạn vẫn có thể xem lại lịch sử trao đổi.</Text>
              </View>
            )}
          </>
        ) : (
          <Text style={s.muted}>Đang tải...</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}