import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../auth/AuthContext';
import { supportApi } from './supportApi';
import type { SupportTicket } from './support.types';
import { supportStyles as s } from './supportStyles';
import { colors } from '../../theme';

const labels: Record<string, string> = { open: 'Đã tiếp nhận', in_progress: 'Đang xử lý', waiting_customer: 'Cần bổ sung', resolved: 'Đã giải quyết', closed: 'Đã đóng' };

export default function SupportTicketListScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'SupportTicketList'>>();
  const { runWithAuth } = useAuth(); const [items, setItems] = React.useState<SupportTicket[]>([]);
  useFocusEffect(React.useCallback(() => { runWithAuth((token) => supportApi.listTickets(token)).then((result) => setItems(result.items)).catch(() => setItems([])); }, [runWithAuth]));
  return <SafeAreaView style={s.safe} edges={['top', 'bottom']}><View style={s.header}><TouchableOpacity style={s.back} onPress={() => navigation.goBack()}><MaterialCommunityIcons name="arrow-left" size={24} color={colors.white} /></TouchableOpacity><Text style={s.headerTitle}>Yêu cầu của tôi</Text></View><ScrollView contentContainerStyle={s.content}>{items.map((ticket) => <TouchableOpacity style={s.card} key={ticket._id} onPress={() => navigation.navigate('SupportTicketDetail', { ticketId: ticket._id })}><View style={s.row}><Text style={s.cardTitle}>{ticket.ticketCode}</Text><Text style={s.secondaryText}>{labels[ticket.status]}</Text></View><Text style={s.muted}>{ticket.subject}</Text><Text style={s.timestamp}>{new Date(ticket.lastMessageAt).toLocaleString('vi-VN')}</Text></TouchableOpacity>)}{!items.length && <Text style={s.muted}>Bạn chưa có yêu cầu hỗ trợ nào.</Text>}<TouchableOpacity style={s.button} onPress={() => navigation.navigate('SupportTicketCreate')}><Text style={s.buttonText}>Tạo yêu cầu mới</Text></TouchableOpacity></ScrollView></SafeAreaView>;
}
