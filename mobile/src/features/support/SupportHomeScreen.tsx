import React from 'react';
import { Linking, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useStaleFocusEffect } from '../../hooks/useStaleFocusEffect';
import { useAuth } from '../auth/AuthContext';
import { supportApi } from './supportApi';
import type { FaqArticle, SupportSummary } from './support.types';
import { supportStyles as s } from './supportStyles';
import { colors } from '../../theme';
import { requestSupportPushToken } from './supportNotifications';
import { useStorefrontSettings } from '../storefrontSettings/StorefrontSettingsProvider';

type Nav = StackNavigationProp<RootStackParamList, 'SupportHome'>;

const topics = [
  ['orders', 'Đơn hàng'], ['shipping', 'Giao hàng'], ['returns', 'Đổi trả'], ['payments', 'Thanh toán'],
  ['promotions', 'Voucher'], ['loyalty', 'Thành viên'], ['account', 'Tài khoản'], ['other', 'Khác'],
] as const;

export default function SupportHomeScreen() {
  const navigation = useNavigation<Nav>();
  const { runWithAuth } = useAuth();
  const { settings } = useStorefrontSettings();
  const { contact } = settings;
  const [search, setSearch] = React.useState('');
  const [faqs, setFaqs] = React.useState<FaqArticle[]>([]);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<SupportSummary | null>(null);
  const [error, setError] = React.useState('');
  const [notificationMessage, setNotificationMessage] = React.useState('');

  const load = React.useCallback(() => {
    supportApi.listFaqs(search).then((result) => setFaqs(result.items.slice(0, 6))).catch(() => setError('Không thể tải câu hỏi thường gặp.'));
    runWithAuth((token) => supportApi.getSummary(token)).then(setSummary).catch(() => setSummary(null));
  }, [runWithAuth, search]);

  useStaleFocusEffect(() => { load(); }, [load], { staleMs: 60 * 1000 });

  const enableNotifications = async () => {
    setError('');
    setNotificationMessage('');
    try {
      const push = await requestSupportPushToken();
      await runWithAuth((token) => supportApi.registerPushToken(token, push.token, push.platform));
      setNotificationMessage('Đã bật thông báo khi shop phản hồi.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể bật thông báo.');
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => navigation.goBack()} accessibilityLabel="Trở về"><MaterialCommunityIcons name="arrow-left" size={24} color={colors.white} /></TouchableOpacity>
        <Text style={s.headerTitle}>Hỗ trợ</Text>
        <View style={s.back} />
      </View>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.hero}><Text style={s.heroTitle}>Xin chào, chúng tôi có thể giúp gì?</Text><Text style={s.heroText}>Tìm câu trả lời nhanh hoặc gửi yêu cầu để đội ngũ CSKH hỗ trợ bạn.</Text></View>
        <TextInput style={s.search} value={search} onChangeText={setSearch} placeholder="Bạn cần hỗ trợ vấn đề gì?" onSubmitEditing={load} />
        {error ? <Text style={s.error}>{error}</Text> : null}
        <Text style={s.sectionTitle}>Chủ đề phổ biến</Text>
        <View style={s.chips}>{topics.map(([category, label]) => <TouchableOpacity key={category} style={s.chip} onPress={() => navigation.navigate('FaqList', { category })}><Text style={s.chipText}>{label}</Text></TouchableOpacity>)}</View>
        <View style={s.row}><Text style={s.sectionTitle}>Câu hỏi thường gặp</Text><TouchableOpacity onPress={() => navigation.navigate('FaqList')}><Text style={s.secondaryText}>Xem tất cả</Text></TouchableOpacity></View>
        {faqs.map((faq) => <TouchableOpacity key={faq._id} style={s.card} onPress={() => setExpanded((old) => old === faq._id ? null : faq._id)}><View style={s.row}><Text style={[s.cardTitle, { flex: 1 }]}>{faq.question}</Text><MaterialCommunityIcons name={expanded === faq._id ? 'chevron-up' : 'chevron-down'} size={22} color={colors.brand} /></View>{expanded === faq._id ? <Text style={s.faqAnswer}>{faq.answer}</Text> : null}</TouchableOpacity>)}
        <TouchableOpacity style={s.card} onPress={() => navigation.navigate('SupportTicketList')}>
          <View style={s.row}><View><Text style={s.cardTitle}>Yêu cầu của tôi</Text><Text style={s.muted}>Theo dõi phản hồi từ shop</Text></View>{summary?.total ? <View style={s.badge}><Text style={s.badgeText}>{summary.total}</Text></View> : <MaterialCommunityIcons name="chevron-right" size={24} color={colors.brand} />}</View>
        </TouchableOpacity>
        <TouchableOpacity style={s.button} onPress={() => navigation.navigate('SupportTicketCreate')}><Text style={s.buttonText}>Gửi yêu cầu hỗ trợ</Text></TouchableOpacity>
        <TouchableOpacity style={[s.button, s.secondaryButton]} onPress={() => void enableNotifications()}>
          <Text style={s.secondaryText}>Bật thông báo phản hồi</Text>
        </TouchableOpacity>
        {notificationMessage ? <Text style={s.success}>{notificationMessage}</Text> : null}
        {contact.phone || contact.email || contact.hours || contact.address ? <View style={s.card}>
            <Text style={s.cardTitle}>Liên hệ trực tiếp</Text>
            {contact.phone ? <TouchableOpacity onPress={() => void Linking.openURL(`tel:${contact.phone.replace(/[^0-9+]/g, '')}`)}><Text style={s.muted}>Hotline: {contact.phone}</Text></TouchableOpacity> : null}
            {contact.email ? <TouchableOpacity onPress={() => void Linking.openURL(`mailto:${contact.email}`)}><Text style={s.muted}>Email: {contact.email}</Text></TouchableOpacity> : null}
            {contact.hours ? <Text style={s.muted}>Giờ hỗ trợ: {contact.hours}</Text> : null}
            {contact.address ? <TouchableOpacity disabled={!contact.mapUrl} onPress={() => contact.mapUrl ? void Linking.openURL(contact.mapUrl) : undefined}><Text style={s.muted}>Địa chỉ: {contact.address}</Text></TouchableOpacity> : null}
        </View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
