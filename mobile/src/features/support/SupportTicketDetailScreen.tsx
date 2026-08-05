import React from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useIsFocused, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../auth/AuthContext';
import { useStorefrontSettings } from '../storefrontSettings/StorefrontSettingsProvider';
import { supportApi } from './supportApi';
import { useSupportRealtime } from './supportSocket';
import type {
  SupportImage,
  SupportMessage,
  SupportTicket,
  SupportTicketDetail,
  SupportTicketStatus,
} from './support.types';
import { supportStyles as s } from './supportStyles';
import { colors } from '../../theme';
import {
  canReopenSupportTicket,
  getSupportImageMimeType,
  getSupportTicketStatusLabel,
  mergeSupportMessages,
  selectLatestSupportTicket,
  shouldMarkIncomingSupportMessageRead,
  validateSupportImageAssets,
} from './supportPresentation';

type StatusVisual = {
  backgroundColor: string;
  color: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

const statusVisuals: Record<SupportTicketStatus, StatusVisual> = {
  open: { backgroundColor: colors.brandSoft, color: colors.brandDark, icon: 'message-text-outline' },
  in_progress: { backgroundColor: '#EAF3FF', color: '#245C9C', icon: 'progress-clock' },
  waiting_customer: { backgroundColor: colors.goldSoft, color: colors.goldText, icon: 'alert-circle-outline' },
  resolved: { backgroundColor: colors.successSoft, color: colors.success, icon: 'check-circle-outline' },
  closed: { backgroundColor: '#EEF1F3', color: colors.textMuted, icon: 'lock-outline' },
};

const formatMessageTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
};

export default function SupportTicketDetailScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'SupportTicketDetail'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'SupportTicketDetail'>>();
  const { runWithAuth, session } = useAuth();
  const { settings: storefrontSettings } = useStorefrontSettings();
  const shopName = storefrontSettings.identity.name;
  const shopAvatarUrl = storefrontSettings.identity.avatarUrl;
  const isFocused = useIsFocused();
  const ticketId = route.params.ticketId;

  const [detail, setDetail] = React.useState<SupportTicketDetail | null>(null);
  const [liveMessages, setLiveMessages] = React.useState<SupportMessage[]>([]);
  const [liveTicket, setLiveTicket] = React.useState<SupportTicket | null>(null);
  const [reply, setReply] = React.useState('');
  const [images, setImages] = React.useState<SupportImage[]>([]);
  const [error, setError] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [reopening, setReopening] = React.useState(false);
  const [staffTyping, setStaffTyping] = React.useState(false);
  const typingTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendingRef = React.useRef(false);
  const reopeningRef = React.useRef(false);
  const requestSequenceRef = React.useRef(0);
  const messagesScrollRef = React.useRef<ScrollView>(null);

  React.useEffect(() => {
    requestSequenceRef.current += 1;
    setDetail(null);
    setLiveMessages([]);
    setLiveTicket(null);
    setStaffTyping(false);
    setError('');
  }, [ticketId]);

  const load = React.useCallback(async () => {
    const requestSequence = ++requestSequenceRef.current;
    try {
      const value = await runWithAuth((token) => supportApi.getTicket(token, ticketId));
      if (requestSequence !== requestSequenceRef.current) return;
      setDetail(value);
      setLiveMessages((current) => mergeSupportMessages(value.messages, current));
      setLiveTicket((current) => selectLatestSupportTicket(current, value.ticket));
      if (value.ticket.lastMessageSender === 'staff') {
        await runWithAuth((token) => supportApi.markRead(token, ticketId)).catch(() => {});
      }
    } catch (caught) {
      if (requestSequence !== requestSequenceRef.current) return;
      setError(caught instanceof Error ? caught.message : 'Không thể tải ticket.');
    }
  }, [ticketId, runWithAuth]);

  useFocusEffect(React.useCallback(() => {
    void load();
    return () => { requestSequenceRef.current += 1; };
  }, [load]));

  const realtime = useSupportRealtime(session?.accessToken ?? null, {
    onMessage: (id, message) => {
      if (id !== ticketId) return;
      setLiveMessages((current) => mergeSupportMessages(current, [message]));
      setStaffTyping(false);
      if (shouldMarkIncomingSupportMessageRead({
        activeTicketId: ticketId,
        eventTicketId: id,
        isFocused,
        isAppActive: AppState.currentState === 'active',
        senderType: message.senderType,
      })) {
        void runWithAuth((token) => supportApi.markRead(token, ticketId)).catch(() => {});
      }
    },
    onTyping: (id, isTyping) => {
      if (id !== ticketId) return;
      setStaffTyping(isTyping);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (isTyping) typingTimerRef.current = setTimeout(() => setStaffTyping(false), 4000);
    },
    onUpdated: (id, ticket) => {
      if (id !== ticketId) return;
      setLiveTicket((current) => selectLatestSupportTicket(current, ticket));
    },
  });

  React.useEffect(() => {
    realtime.subscribeTicket(ticketId);
    return () => { realtime.unsubscribeTicket(ticketId); };
  }, [realtime.subscribeTicket, realtime.unsubscribeTicket, ticketId]);

  const send = async () => {
    if (!reply.trim() || sendingRef.current) return;
    sendingRef.current = true; setSending(true);
    try {
      await runWithAuth((token) => supportApi.addMessage(token, ticketId, reply.trim(), images));
      setReply('');
      setImages([]);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể gửi tin nhắn.');
    } finally {
      sendingRef.current = false; setSending(false);
    }
  };

  const chooseImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 3, quality: 0.85 });
    if (result.canceled) return;
    const imageError = validateSupportImageAssets(result.assets);
    if (imageError) { setError(imageError); return; }
    setError('');
    setImages(result.assets.map((asset, index) => ({ uri: asset.uri, name: asset.fileName || `support-reply-${Date.now()}-${index}.jpg`, type: getSupportImageMimeType(asset) || 'image/jpeg', size: asset.fileSize })));
  };

  const close = () => Alert.alert(
    'Đóng yêu cầu?',
    'Bạn vẫn có thể xem lại lịch sử sau khi đóng.',
    [{ text: 'Hủy' }, { text: 'Đóng yêu cầu', style: 'destructive', onPress: () => void runWithAuth((token) => supportApi.closeTicket(token, ticketId)).then(load) }],
  );

  const reopen = async () => {
    if (reopeningRef.current) return;
    reopeningRef.current = true; setReopening(true);
    try {
      await runWithAuth((token) => supportApi.reopenTicket(token, ticketId));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể mở lại yêu cầu.');
    } finally {
      reopeningRef.current = false; setReopening(false);
    }
  };

  const ticket = liveTicket ?? detail?.ticket;
  const messages = liveMessages.length ? liveMessages : (detail?.messages ?? []);
  const status = ticket?.status ?? 'open';
  const isClosed = status === 'closed';
  const canReopen = canReopenSupportTicket(status, ticket?.reopenDeadline);
  const statusVisual = statusVisuals[status];

  React.useEffect(() => {
    if (!messages.length) return undefined;
    const timer = setTimeout(() => {
      messagesScrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [messages.length, staffTyping]);

  const removeImage = (uri: string) => {
    setImages((current) => current.filter((image) => image.uri !== uri));
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.white} />
        </TouchableOpacity>
        <View style={s.detailHeaderTitleGroup}>
          <Text style={s.detailHeaderTitle} numberOfLines={1}>{shopName} hỗ trợ</Text>
          <Text style={s.detailHeaderSubtitle}>Phản hồi trực tiếp với cửa hàng</Text>
        </View>
        <View style={s.connectionStatus}>
          <View style={[s.connectionDot, !realtime.connected && s.connectionDotOffline]} />
          <Text style={s.connectionText}>{realtime.connected ? 'Trực tuyến' : 'Kết nối'}</Text>
        </View>
      </View>
      <KeyboardAvoidingView
        style={s.chatLayout}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {error ? <Text style={s.chatError}>{error}</Text> : null}
        {ticket ? (
          <>
            <View style={s.ticketSummary}>
              <View style={s.ticketIcon}>
                <MaterialCommunityIcons name="lifebuoy" size={21} color={colors.brand} />
              </View>
              <View style={s.ticketSummaryCopy}>
                <Text style={s.ticketCode}>{ticket.ticketCode}</Text>
                <Text style={s.ticketSubject} numberOfLines={1}>{ticket.subject}</Text>
              </View>
              <View style={[s.statusPill, { backgroundColor: statusVisual.backgroundColor }]}>
                <MaterialCommunityIcons name={statusVisual.icon} size={14} color={statusVisual.color} />
                <Text style={[s.statusPillText, { color: statusVisual.color }]}>
                  {getSupportTicketStatusLabel(status)}
                </Text>
              </View>
            </View>

            <ScrollView
              ref={messagesScrollRef}
              style={s.messagesScroll}
              contentContainerStyle={s.messagesContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {messages.map((message) => {
                const isCustomer = message.senderType === 'customer';
                return (
                  <View
                    key={message._id}
                    style={[s.messageRow, isCustomer ? s.messageRowCustomer : s.messageRowStaff]}
                  >
                    {!isCustomer ? (
                      <View style={s.shopAvatar}>
                        {shopAvatarUrl ? (
                          <Image source={{ uri: shopAvatarUrl }} style={s.shopAvatarImage} />
                        ) : (
                          <MaterialCommunityIcons name="storefront-outline" size={17} color={colors.brand} />
                        )}
                      </View>
                    ) : null}
                    <View style={isCustomer ? s.messageCustomer : s.messageStaff}>
                      <Text style={[s.messageText, isCustomer && s.messageTextCustomer]}>{message.body}</Text>
                      {message.attachments.length > 0 ? (
                        <View style={s.messageImageRow}>
                          {message.attachments.map((file) => (
                            <Image key={file.publicId} source={{ uri: file.url }} style={s.messageImage} />
                          ))}
                        </View>
                      ) : null}
                      <Text style={[s.timestamp, isCustomer && s.timestampCustomer]}>
                        {formatMessageTime(message.createdAt)}
                      </Text>
                    </View>
                  </View>
                );
              })}

              {staffTyping ? (
                <View style={[s.messageRow, s.messageRowStaff]}>
                  <View style={s.shopAvatar}>
                    {shopAvatarUrl ? (
                      <Image source={{ uri: shopAvatarUrl }} style={s.shopAvatarImage} />
                    ) : (
                      <MaterialCommunityIcons name="storefront-outline" size={17} color={colors.brand} />
                    )}
                  </View>
                  <View style={[s.messageStaff, s.typingBubble]}>
                    <Text style={s.typingText}>{shopName} đang nhập</Text>
                    <Text style={s.typingDots}>•••</Text>
                  </View>
                </View>
              ) : null}

              {canReopen ? (
                <View style={s.conversationNotice}>
                  <MaterialCommunityIcons name="check-circle-outline" size={21} color={colors.success} />
                  <Text style={s.conversationNoticeText}>
                    Vấn đề chưa được xử lý xong? Bạn có thể mở lại để tiếp tục trao đổi.
                  </Text>
                  <TouchableOpacity style={s.noticeAction} disabled={reopening} onPress={reopen}>
                    <Text style={s.noticeActionText}>{reopening ? 'Đang mở...' : 'Mở lại'}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {status === 'resolved' && !canReopen ? (
                <View style={s.conversationNotice}>
                  <MaterialCommunityIcons name="clock-alert-outline" size={21} color={colors.textMuted} />
                  <Text style={s.conversationNoticeText}>
                    Thời hạn mở lại đã hết. Hãy tạo yêu cầu mới nếu bạn vẫn cần hỗ trợ.
                  </Text>
                  <TouchableOpacity style={s.noticeAction} onPress={() => navigation.navigate('SupportTicketCreate')}>
                    <Text style={s.noticeActionText}>Tạo mới</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {isClosed ? (
                <View style={s.closedNotice}>
                  <MaterialCommunityIcons name="lock-outline" size={17} color={colors.textMuted} />
                  <Text style={s.closedNoticeText}>Yêu cầu đã đóng. Lịch sử trao đổi vẫn được lưu lại.</Text>
                </View>
              ) : null}
            </ScrollView>

            {!isClosed && status !== 'resolved' ? (
              <View style={s.composerPanel}>
                {images.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.composerImages}
                  >
                    {images.map((image) => (
                      <View key={image.uri} style={s.composerImageFrame}>
                        <Image source={{ uri: image.uri }} style={s.composerImage} />
                        <TouchableOpacity
                          style={s.removeImageButton}
                          onPress={() => removeImage(image.uri)}
                          accessibilityLabel="Bỏ ảnh đính kèm"
                        >
                          <MaterialCommunityIcons name="close" size={14} color={colors.white} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                ) : null}

                <View style={s.composerRow}>
                  <TouchableOpacity
                    style={s.attachButton}
                    onPress={chooseImages}
                    disabled={sending}
                    accessibilityLabel="Chọn ảnh đính kèm"
                  >
                    <MaterialCommunityIcons name="image-plus-outline" size={23} color={colors.brand} />
                    {images.length > 0 ? (
                      <View style={s.attachmentBadge}>
                        <Text style={s.attachmentBadgeText}>{images.length}</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                  <TextInput
                    style={s.chatInput}
                    multiline
                    value={reply}
                    onChangeText={(value) => {
                      setReply(value);
                      realtime.emitTyping(ticketId, value.trim().length > 0);
                    }}
                    placeholder="Nhập tin nhắn..."
                    placeholderTextColor={colors.textSubtle}
                    maxLength={1000}
                  />
                  <TouchableOpacity
                    style={[s.sendButton, (sending || !reply.trim()) && s.sendButtonDisabled]}
                    disabled={sending || !reply.trim()}
                    onPress={send}
                    accessibilityLabel="Gửi tin nhắn"
                  >
                    {sending ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <MaterialCommunityIcons name="send" size={21} color={colors.white} />
                    )}
                  </TouchableOpacity>
                </View>

                <View style={s.composerFooter}>
                  <Text style={s.composerHint}>Tối đa 3 ảnh</Text>
                  <TouchableOpacity style={s.closeTicketAction} onPress={close}>
                    <MaterialCommunityIcons name="check-circle-outline" size={16} color={colors.danger} />
                    <Text style={s.closeTicketText}>Đóng yêu cầu</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <View style={s.chatLoading}>
            <ActivityIndicator color={colors.brand} />
            <Text style={s.muted}>Đang tải cuộc trò chuyện...</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
