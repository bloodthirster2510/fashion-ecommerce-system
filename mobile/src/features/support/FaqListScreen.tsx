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
import type { FaqArticle, FaqVoteValue } from './support.types';
import { supportStyles as s } from './supportStyles';
import { colors } from '../../theme';
import { useAuth } from '../auth/AuthContext';
import { hasNextPage, mergePageItems, type PageInfo } from '../../utils/pagination';

const PAGE_SIZE = 20;
type LoadMode = 'initial' | 'refresh' | 'more';

export default function FaqListScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'FaqList'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'FaqList'>>();
  const { runWithAuth, session } = useAuth();
  const [search, setSearch] = React.useState('');
  const [items, setItems] = React.useState<FaqArticle[]>([]);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [pagination, setPagination] = React.useState<PageInfo | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState('');
  const [votingByFaqId, setVotingByFaqId] = React.useState<Record<string, FaqVoteValue | undefined>>({});
  const requestSequenceRef = React.useRef(0);
  const votingFaqIdsRef = React.useRef(new Set<string>());

  const loadFaqs = React.useCallback(async (mode: LoadMode = 'initial', page = 1) => {
    if (mode === 'refresh') setIsRefreshing(true);
    else if (mode === 'more') setIsLoadingMore(true);
    else setIsLoading(true);
    if (mode !== 'more') setError('');

    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    try {
      const query = { page, limit: PAGE_SIZE };
      const result = session?.user.role === 'user'
        ? await runWithAuth((token) => supportApi.listFaqs(search, route.params?.category, query, token))
        : await supportApi.listFaqs(search, route.params?.category, query);
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
  }, [route.params?.category, runWithAuth, search, session?.user.role]);

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
  const vote = async (faq: FaqArticle, value: FaqVoteValue) => {
    if (faq.userVote || votingFaqIdsRef.current.has(faq._id)) return;
    votingFaqIdsRef.current.add(faq._id);
    setVotingByFaqId((current) => ({ ...current, [faq._id]: value }));
    try {
      const updated = await runWithAuth((token) => supportApi.voteFaq(token, faq._id, value));
      setItems((current) => current.map((item) => item._id === updated._id ? updated : item));
    } catch (caught) {
      Alert.alert('Không thể đánh giá', caught instanceof Error ? caught.message : 'Bạn thử lại sau.');
    } finally {
      votingFaqIdsRef.current.delete(faq._id);
      setVotingByFaqId((current) => {
        const next = { ...current };
        delete next[faq._id];
        return next;
      });
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
                <View style={s.faqVotePanel}>
                  <Text style={s.faqVoteQuestion}>Câu trả lời này có hữu ích với bạn không?</Text>
                  <View style={s.faqVoteActions}>
                    {([
                      { value: 'helpful', label: 'Có', count: faq.helpfulCount, icon: 'thumb-up-outline' },
                      { value: 'not_helpful', label: 'Không', count: faq.notHelpfulCount, icon: 'thumb-down-outline' },
                    ] as const).map((option) => {
                      const selected = faq.userVote === option.value;
                      const pending = votingByFaqId[faq._id] === option.value;
                      const disabled = Boolean(faq.userVote || votingByFaqId[faq._id]);
                      return (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            s.faqVoteButton,
                            selected && s.faqVoteButtonActive,
                            disabled && !selected && !pending && s.faqVoteButtonDisabled,
                          ]}
                          disabled={disabled}
                          accessibilityRole="button"
                          accessibilityLabel={`${option.label}, ${option.count} lượt đánh giá`}
                          accessibilityState={{ selected, disabled, busy: pending }}
                          onPress={() => void vote(faq, option.value)}
                        >
                          {pending ? (
                            <ActivityIndicator size="small" color={colors.brand} />
                          ) : (
                            <MaterialCommunityIcons
                              name={selected ? option.icon.replace('-outline', '') as never : option.icon}
                              size={18}
                              color={selected ? colors.white : colors.brandDark}
                            />
                          )}
                          <Text style={[s.faqVoteButtonText, selected && s.faqVoteButtonTextActive]}>
                            {option.label} ({option.count})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {faq.userVote ? (
                    <View style={s.faqVoteConfirmation} accessibilityLiveRegion="polite">
                      <MaterialCommunityIcons name="check-circle" size={16} color={colors.success} />
                      <Text style={s.faqVoteConfirmationText}>Cảm ơn bạn đã góp ý.</Text>
                    </View>
                  ) : null}
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
