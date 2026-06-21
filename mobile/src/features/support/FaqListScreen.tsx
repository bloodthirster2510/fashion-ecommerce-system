import React from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

export default function FaqListScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'FaqList'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'FaqList'>>();
  const { runWithAuth } = useAuth();
  const [search, setSearch] = React.useState('');
  const [items, setItems] = React.useState<FaqArticle[]>([]);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  React.useEffect(() => { const timer = setTimeout(() => { supportApi.listFaqs(search, route.params?.category).then((result) => setItems(result.items)).catch(() => setItems([])); }, 300); return () => clearTimeout(timer); }, [route.params?.category, search]);
  const vote = async (faq: FaqArticle, value: 'helpful' | 'not_helpful') => {
    try {
      const updated = await runWithAuth((token) => supportApi.voteFaq(token, faq._id, value));
      setItems((current) => current.map((item) => item._id === updated._id ? updated : item));
    } catch (caught) {
      Alert.alert('Không thể đánh giá', caught instanceof Error ? caught.message : 'Bạn thử lại sau.');
    }
  };
  return <SafeAreaView style={s.safe} edges={['top', 'bottom']}><View style={s.header}><TouchableOpacity style={s.back} onPress={() => navigation.goBack()}><MaterialCommunityIcons name="arrow-left" size={24} color={colors.white} /></TouchableOpacity><Text style={s.headerTitle}>Câu hỏi thường gặp</Text></View><ScrollView contentContainerStyle={s.content}><TextInput style={s.search} placeholder="Tìm câu hỏi..." value={search} onChangeText={setSearch} />{items.map((faq) => <View style={s.card} key={faq._id}><TouchableOpacity onPress={() => setExpanded(expanded === faq._id ? null : faq._id)}><Text style={s.cardTitle}>{faq.question}</Text></TouchableOpacity>{expanded === faq._id && <><Text style={s.faqAnswer}>{faq.answer}</Text><View style={s.row}><Text style={s.muted}>Hữu ích?</Text><View style={s.chips}><TouchableOpacity style={s.chip} onPress={() => void vote(faq, 'helpful')}><Text style={s.chipText}>Có ({faq.helpfulCount})</Text></TouchableOpacity><TouchableOpacity style={s.chip} onPress={() => void vote(faq, 'not_helpful')}><Text style={s.chipText}>Chưa ({faq.notHelpfulCount})</Text></TouchableOpacity></View></View></>}</View>)}{!items.length && <Text style={s.muted}>Không tìm thấy câu trả lời phù hợp.</Text>}<TouchableOpacity style={s.button} onPress={() => navigation.navigate('SupportTicketCreate', { category: route.params?.category as never })}><Text style={s.buttonText}>Gửi yêu cầu cho shop</Text></TouchableOpacity></ScrollView></SafeAreaView>;
}
