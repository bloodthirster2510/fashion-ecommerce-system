import React from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
import { hasNextPage, mergePageItems, type PageInfo } from '../../utils/pagination';
import { getSupportTicketStatusLabel } from './supportPresentation';

const PAGE_SIZE = 20;
type LoadMode = 'initial' | 'refresh' | 'more';

export default function SupportTicketListScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'SupportTicketList'>>();
  const { runWithAuth } = useAuth();
  const [items, setItems] = React.useState<SupportTicket[]>([]);
  const [pagination, setPagination] = React.useState<PageInfo | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState('');
  const requestSequenceRef = React.useRef(0);

  const loadTickets = React.useCallback(async (mode: LoadMode = 'initial', page = 1) => {
    if (mode === 'refresh') setIsRefreshing(true);
    else if (mode === 'more') setIsLoadingMore(true);
    else setIsLoading(true);
    if (mode !== 'more') setError('');

    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    try {
      const result = await runWithAuth((token) => supportApi.listTickets(token, {
        page,
        limit: PAGE_SIZE,
      }));
      if (requestSequenceRef.current !== requestSequence) return;
      setItems((current) => mode === 'more' ? mergePageItems(current, result.items) : result.items);
      setPagination(result.pagination);
    } catch (caught) {
      if (requestSequenceRef.current !== requestSequence) return;
      const message = caught instanceof Error ? caught.message : 'Vui lòng thử lại.';
      if (mode === 'more') Alert.alert('Không thể tải thêm yêu cầu', message);
      else setError(message);
    } finally {
      if (requestSequenceRef.current !== requestSequence) return;
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, [runWithAuth]);

  useFocusEffect(React.useCallback(() => {
    void loadTickets();
    return () => {
      requestSequenceRef.current += 1;
    };
  }, [loadTickets]));

  const canLoadMore = hasNextPage(pagination);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Yêu cầu của tôi</Text>
      </View>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={(
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadTickets('refresh')}
            tintColor={colors.brand}
          />
        )}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.brand} />
        ) : error ? (
          <View style={s.card}>
            <Text style={s.error}>{error}</Text>
            <TouchableOpacity style={s.button} onPress={() => void loadTickets()}>
              <Text style={s.buttonText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : items.length ? items.map((ticket) => (
          <TouchableOpacity
            style={s.card}
            key={ticket._id}
            onPress={() => navigation.navigate('SupportTicketDetail', { ticketId: ticket._id })}
          >
            <View style={s.row}>
              <Text style={s.cardTitle}>{ticket.ticketCode}</Text>
              <Text style={s.secondaryText}>{getSupportTicketStatusLabel(ticket.status)}</Text>
            </View>
            <Text style={s.muted}>{ticket.subject}</Text>
            <Text style={s.timestamp}>{new Date(ticket.lastMessageAt).toLocaleString('vi-VN')}</Text>
          </TouchableOpacity>
        )) : (
          <Text style={s.muted}>Bạn chưa có yêu cầu hỗ trợ nào.</Text>
        )}
        {canLoadMore ? (
          <TouchableOpacity
            style={s.button}
            disabled={isLoadingMore}
            onPress={() => void loadTickets('more', (pagination?.page ?? 0) + 1)}
          >
            {isLoadingMore ? <ActivityIndicator color={colors.white} /> : <Text style={s.buttonText}>Tải thêm yêu cầu</Text>}
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={s.button} onPress={() => navigation.navigate('SupportTicketCreate')}>
          <Text style={s.buttonText}>Tạo yêu cầu mới</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
