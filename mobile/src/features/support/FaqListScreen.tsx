import React from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { supportApi } from './supportApi';
import type { FaqArticle } from './support.types';
import { supportStyles as s } from './supportStyles';
import { colors } from '../../theme';
import { useAuth } from '../auth/AuthContext';
import { hasNextPage, mergePageItems, type PageInfo } from '../../utils/pagination';

const PAGE_SIZE = 20;
type LoadMode = 'initial' | 'refresh' | 'more';

export default function FaqListScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'FaqList'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'FaqList'>>();
  const { runWithAuth } = useAuth();
  const [search, setSearch] = React.useState('');
  const [items, setItems] = React.useState<FaqArticle[]>([]);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [pagination, setPagination] = React.useState<PageInfo | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState('');
  const requestSequenceRef = React.useRef(0);

  const loadFaqs = React.useCallback(async (mode: LoadMode = 'initial', page = 1) => {
    if (mode === 'refresh') setIsRefreshing(true);
    else if (mode === 'more') setIsLoadingMore(true);
    else setIsLoading(true);
    if (mode !== 'more') setError('');

    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    try {
      const result = await supportApi.listFaqs(search, route.params?.category, {
        page,
        limit: PAGE_SIZE,
      });
      if (requestSequenceRef.current !== requestSequence) return;
      setItems((current) => mode === 'more' ? mergePageItems(current, result.items) : result.items);
      setPagination(result.pagination);
    } catch (caught) {
      if (requestSequenceRef.current !== requestSequence) return;
      const message = caught instanceof Error ? caught.message : 'Vui lòng thử lại.';
      if (mode === 'more') Alert.alert('Không thể tải thêm câu hỏi', message);
      else setError(message);
    } finally {
      if (requestSequenceRef.current !== requestSequence) return;
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, [route.params?.category, search]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setExpanded(null);
      void loadFaqs();
    }, 300);
    return () => {
      clearTimeout(timer);
      requestSequenceRef.current += 1;
    };
  }, [loadFaqs]);
  const vote = async (faq: FaqArticle, value: 'helpful' | 'not_helpful') => {
    try {
      const updated = await runWithAuth((token) => supportApi.voteFaq(token, faq._id, value));
      setItems((current) => current.map((item) => item._id === updated._id ? updated : item));
    } catch (caught) {
      Alert.alert('Không thể đánh giá', caught instanceof Error ? caught.message : 'Bạn thử lại sau.');
    }
  };
  const canLoadMore = hasNextPage(pagination);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Câu hỏi thường gặp</Text>
      </View>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={(
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadFaqs('refresh')}
            tintColor={colors.brand}
          />
        )}
      >
        <TextInput style={s.search} placeholder="Tìm câu hỏi..." value={search} onChangeText={setSearch} />
        {isLoading ? (
          <ActivityIndicator color={colors.brand} />
        ) : error ? (
          <View style={s.card}>
            <Text style={s.error}>{error}</Text>
            <TouchableOpacity style={s.button} onPress={() => void loadFaqs()}>
              <Text style={s.buttonText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : items.length ? items.map((faq) => (
          <View style={s.card} key={faq._id}>
            <TouchableOpacity onPress={() => setExpanded(expanded === faq._id ? null : faq._id)}>
              <Text style={s.cardTitle}>{faq.question}</Text>
            </TouchableOpacity>
            {expanded === faq._id ? (
              <>
                <Text style={s.faqAnswer}>{faq.answer}</Text>
                <View style={s.row}>
                  <Text style={s.muted}>Hữu ích?</Text>
                  <View style={s.chips}>
                    <TouchableOpacity style={s.chip} onPress={() => void vote(faq, 'helpful')}>
                      <Text style={s.chipText}>Có ({faq.helpfulCount})</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.chip} onPress={() => void vote(faq, 'not_helpful')}>
                      <Text style={s.chipText}>Chưa ({faq.notHelpfulCount})</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            ) : null}
          </View>
        )) : (
          <Text style={s.muted}>Không tìm thấy câu trả lời phù hợp.</Text>
        )}
        {canLoadMore ? (
          <TouchableOpacity
            style={s.button}
            disabled={isLoadingMore}
            onPress={() => void loadFaqs('more', (pagination?.page ?? 0) + 1)}
          >
            {isLoadingMore ? <ActivityIndicator color={colors.white} /> : <Text style={s.buttonText}>Tải thêm câu hỏi</Text>}
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={s.button}
          onPress={() => navigation.navigate('SupportTicketCreate', { category: route.params?.category as never })}
        >
          <Text style={s.buttonText}>Gửi yêu cầu cho shop</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
