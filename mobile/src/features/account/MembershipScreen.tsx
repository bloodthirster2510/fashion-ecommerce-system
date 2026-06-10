import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, radii, spacing } from '../../theme';
import { useAuth } from '../auth/AuthContext';
import { accountApi, MembershipResponse, MembershipTier } from './accountApi';
import { getMembershipTierVisualConfig } from './membershipVisual';

const MembershipScreen = () => {
  const navigation = useNavigation();
  const { session, runWithAuth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MembershipResponse | null>(null);
  const membershipCardCarouselRef = useRef<ScrollView>(null);
  const currentIndexRef = useRef(0);
  const scrollX = useRef(new Animated.Value(0)).current;



  useEffect(() => {
    const fetchMembership = async () => {
      if (!session?.accessToken) {
        setData(null);
        setLoading(false);
        return;
      }
      try {
        const response = await runWithAuth((accessToken) => accountApi.getMembership(accessToken));
        setData(response);
      } catch (error) {
        console.error('Lỗi khi tải thông tin hạng thẻ', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMembership();
  }, [runWithAuth, session?.accessToken]);

  if (loading || !data) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Hạng thẻ thành viên</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  const { currentTier, nextTier, loyaltyPoint, pointToNextTier, progressPercent, tiers } = data;
  const tierConfig = getMembershipTierVisualConfig(currentTier);

  const formatPoints = (points: number) => {
    return points.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const getConditionText = (tier: MembershipTier) => {
    if (tier.maxPoint === null) {
      return `${formatPoints(tier.minPoint)}+`;
    }
    return `${formatPoints(tier.minPoint)} - ${formatPoints(tier.maxPoint)}`;
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hạng thẻ thành viên</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Hạng thẻ của bạn</Text>
        <View style={[styles.cardContainer, { backgroundColor: tierConfig.bgColor }]}>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardTierName, { color: tierConfig.textColor }]}>{currentTier.name.toUpperCase()}</Text>
            <MaterialCommunityIcons 
              name={tierConfig.icon} 
              size={52} 
              color="rgba(255,255,255,0.3)" 
              style={styles.cardIcon} 
            />
          </View>
          
          <Text style={[styles.cardPoints, { color: tierConfig.textColor }]}>
            Điểm tích lũy: <Text style={{ fontWeight: '800', fontSize: 18 }}>{formatPoints(loyaltyPoint)}</Text> điểm
          </Text>
          
          {nextTier ? (
            <Text style={[styles.cardNextTierInfo, { color: tierConfig.textColor, opacity: 0.9 }]}>
              Còn <Text style={{ fontWeight: '700' }}>{formatPoints(pointToNextTier)}</Text> điểm để lên hạng {nextTier.name}
            </Text>
          ) : (
            <Text style={[styles.cardNextTierInfo, { color: tierConfig.textColor, opacity: 0.9 }]}>
              Bạn đã đạt hạng cao nhất
            </Text>
          )}

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: tierConfig.textColor }]} />
          </View>
        </View>

        {/* Membership Card Carousel */}
        <Text style={styles.sectionTitle}>Các hạng thẻ khác</Text>
        <View style={styles.membershipCardCarousel}>
          <Animated.FlatList
            ref={membershipCardCarouselRef as any}
            data={data.tiers}
            horizontal
            snapToInterval={296}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.membershipCardCarouselContent}
            keyExtractor={(item: any) => item._id || item.name}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: false }
            )}
            scrollEventThrottle={16}
            renderItem={({ item: tier }) => {
              const tierConfig = getMembershipTierVisualConfig(tier);
              const isCurrent = data.currentTier._id === tier._id;
              const hasPassed = data.loyaltyPoint >= tier.minPoint && !isCurrent;
              const pointsNeeded = tier.minPoint - data.loyaltyPoint;

              return (
                <View style={styles.membershipCard}>
                  <View style={[styles.membershipCardBg, { backgroundColor: tierConfig.bgColor }]}>
                    <View style={styles.membershipCardHeader}>
                      <Text style={[styles.membershipCardTierName, { color: tierConfig.textColor }]}>
                        {tier.name.toUpperCase()}
                      </Text>
                      <MaterialCommunityIcons 
                        name={tierConfig.icon} 
                        size={42} 
                        color="rgba(255,255,255,0.3)" 
                      />
                    </View>
                    
                    <Text style={[styles.membershipCardPoints, { color: tierConfig.textColor }]}>
                      Điểm: <Text style={{ fontWeight: '800' }}>{formatPoints(data.loyaltyPoint)}</Text>
                    </Text>
                    
                    {isCurrent ? (
                      <View style={styles.membershipCardCurrentBadge}>
                        <Text style={styles.membershipCardCurrentBadgeText}>ĐANG SỞ HỮU</Text>
                      </View>
                    ) : hasPassed ? (
                      <View style={[styles.membershipCardCurrentBadge, { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' }]}>
                        <Text style={[styles.membershipCardCurrentBadgeText, { color: 'rgba(255,255,255,0.8)' }]}>ĐÃ VƯỢT QUA</Text>
                      </View>
                    ) : (
                      <Text style={[styles.membershipCardRequirement, { color: tierConfig.textColor, opacity: 0.9 }]}>
                        Còn thiếu {formatPoints(pointsNeeded)} điểm
                      </Text>
                    )}
                  </View>
                </View>
              );
            }}
          />
          
          <View style={styles.membershipCardCarouselIndicator}>
            {data.tiers.map((_, index) => {
              const inputRange = [(index - 1) * 296, index * 296, (index + 1) * 296];
              const opacity = scrollX.interpolate({
                inputRange,
                outputRange: [0.3, 1, 0.3],
                extrapolate: 'clamp',
              });
              const width = scrollX.interpolate({
                inputRange,
                outputRange: [8, 24, 8],
                extrapolate: 'clamp',
              });
              return (
                <Animated.View 
                  key={index} 
                  style={[
                    styles.membershipCardIndicatorDot,
                    { opacity, width, backgroundColor: '#8fa3ad' }
                  ]} 
                />
              );
            })}
          </View>
        </View>

        <View style={styles.tableContainer}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, { flex: 1.4, textAlign: 'left' }]}>Hạng thẻ</Text>
            <Text style={[styles.tableHeaderText, { flex: 1.2, textAlign: 'center' }]}>Điều kiện</Text>
            <Text style={[styles.tableHeaderText, { flex: 1.4, textAlign: 'right' }]}>Ưu đãi</Text>
          </View>

          {tiers.map((tier) => {
            const isCurrent = currentTier._id === tier._id;
            const rowConfig = getMembershipTierVisualConfig(tier);
            return (
              <View key={tier._id || tier.name} style={[styles.tableRow, isCurrent && styles.tableRowCurrent]}>
                <View style={[styles.tableCell, { flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }]}>
                  <MaterialCommunityIcons name={rowConfig.icon} size={18} color={rowConfig.bgColor} style={{ marginRight: 6 }} />
                  <View style={{ flexShrink: 1, alignItems: 'flex-start' }}>
                    <Text style={[styles.tableCellText, isCurrent && styles.tableCellTextBold]} numberOfLines={1}>{tier.name}</Text>
                    {isCurrent && (
                      <View style={[styles.currentBadge, { backgroundColor: rowConfig.badgeColor }]}>
                        <Text style={styles.currentBadgeText}>Hiện tại</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={[styles.tableCell, { flex: 1.2 }]}>
                  <Text style={[styles.tableCellText, { textAlign: 'center' }]}>{getConditionText(tier)}</Text>
                </View>
                <View style={[styles.tableCell, { flex: 1.4 }]}>
                  <Text style={[styles.tableCellText, { textAlign: 'right' }]}>{tier.benefitDescription}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.noteContainer}>
          <Text style={styles.noteText}>
            Điểm tích lũy được tính từ tất cả các đơn hàng đã hoàn thành. Hạng thẻ sẽ được cập nhật tự động khi đạt điều kiện.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#6b899e',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    backgroundColor: '#6b899e',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  scrollContent: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#222',
    marginBottom: 12,
  },
  cardContainer: {
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  cardInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  cardTierName: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  cardIcon: {
    opacity: 0.9,
  },
  cardPoints: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  cardNextTierInfo: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginBottom: spacing.md,
  },
  progressTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.white,
    borderRadius: 4,
  },
  membershipCardCarousel: {
    marginVertical: 16,
  },
  membershipCardCarouselContent: {
    paddingHorizontal: spacing.lg,
  },
  membershipCard: {
    width: 280,
    marginRight: spacing.md,
  },
  membershipCardBg: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    minHeight: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  membershipCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  membershipCardTierName: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
  },
  membershipCardPoints: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  membershipCardRequirement: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
  },
  membershipCardCurrentBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: 4,
  },
  membershipCardCurrentBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  membershipCardCarouselIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  membershipCardIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  membershipCardIndicatorDotActive: {
    backgroundColor: colors.white,
  },
  membershipCardIndicatorDotInactive: {
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  tableContainer: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  tableHeaderText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
  },
  tableRowCurrent: {
    backgroundColor: '#fffcf2',
  },
  tableCell: {
    justifyContent: 'center',
  },
  tableCellText: {
    color: colors.text,
    fontSize: 13,
  },
  tableCellTextBold: {
    fontWeight: '600',
  },
  currentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  currentBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '600',
  },
  noteContainer: {
    backgroundColor: '#eff5fc',
    padding: spacing.md,
    borderRadius: radii.md,
  },
  noteText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
});

export default MembershipScreen;
