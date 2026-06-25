import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii, shadows, spacing } from '../../../theme';
import type { CustomerOrder } from '../orderApi';
import { formatDate, formatShortDate } from '../orderPresentation';

type TimelineStep = {
  key: CustomerOrder['status'];
  label: string;
  helper: string;
};

const timelineSteps: TimelineStep[] = [
  { key: 'confirmed', label: 'Đã đặt đơn', helper: 'Shop tiếp nhận' },
  { key: 'packed', label: 'Chuẩn bị hàng', helper: 'Đóng gói' },
  { key: 'shipping', label: 'Đang giao', helper: 'Theo dõi vận chuyển' },
  { key: 'delivered', label: 'Đã giao', helper: 'Chờ xác nhận' },
  { key: 'completed', label: 'Hoàn tất', helper: 'Đã nhận hàng' },
];

const getTimelineSteps = (order: CustomerOrder): TimelineStep[] => {
  const baseSteps = order.returnRequest?.previousOrderStatus === 'delivered'
    ? timelineSteps.filter((step) => step.key !== 'completed')
    : timelineSteps;

  if (order.status === 'return_requested') {
    return [
      ...baseSteps,
      { key: 'return_requested', label: 'Chờ duyệt trả', helper: 'Shop đang kiểm tra' },
    ];
  }

  if (order.status === 'returned') {
    return [
      ...baseSteps,
      { key: 'returned', label: 'Đã trả hàng', helper: 'Shop đã nhận trả' },
    ];
  }

  return baseSteps;
};

const getProgressIndex = (order: CustomerOrder, steps: TimelineStep[]) => {
  if (order.status === 'cancelled') return -1;

  return steps.findIndex((step) => step.key === order.status);
};

export function OrderTimeline({ order }: { order: CustomerOrder }) {
  const currentTimelineSteps = getTimelineSteps(order);
  const progressIndex = getProgressIndex(order, currentTimelineSteps);
  const progressPercent = progressIndex <= 0 ? 0 : (progressIndex / (currentTimelineSteps.length - 1)) * 100;
  const isCancelled = order.status === 'cancelled';

  if (isCancelled) {
    return (
      <View style={styles.cancelledTimelineCard}>
        <View style={styles.cancelledIcon}>
          <MaterialCommunityIcons name="close-circle-outline" size={26} color={colors.danger} />
        </View>
        <View style={styles.cancelledCopy}>
          <Text style={styles.cancelledTitle}>Đơn hàng đã hủy</Text>
          <Text style={styles.cancelledText}>
            Đơn dừng xử lý vào {formatDate(order.updatedAt)}. Nếu có thanh toán trước, shop sẽ hoàn tiền theo kênh thanh toán ban đầu.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.timelineCard}>
      <View style={styles.timelineTrack}>
        <View style={styles.timelineBaseLine} />
        <View style={[styles.timelineProgressLine, { width: `${progressPercent}%` }]} />
        {currentTimelineSteps.map((step, index) => {
          const isDone = index <= progressIndex;
          const isCurrent = index === progressIndex;

          return (
            <View
              key={step.key}
              style={[styles.timelineStep, { width: `${100 / currentTimelineSteps.length}%` }]}
            >
              <View style={[styles.timelineDot, isDone && styles.timelineDotDone]}>
                {isDone ? (
                  <MaterialCommunityIcons name="check" size={17} color={colors.white} />
                ) : (
                  <View style={styles.timelineDotInner} />
                )}
              </View>
              <Text style={[styles.timelineLabel, isCurrent && styles.timelineLabelActive]} numberOfLines={2}>
                {step.label}
              </Text>
              <Text style={styles.timelineHelper} numberOfLines={2}>
                {index <= progressIndex ? formatShortDate(order.updatedAt) : step.helper}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  timelineCard: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    ...shadows.card,
  },
  timelineTrack: {
    minHeight: 108,
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'relative',
  },
  timelineBaseLine: {
    position: 'absolute',
    left: '12%',
    right: '12%',
    top: 16,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
  },
  timelineProgressLine: {
    position: 'absolute',
    left: '12%',
    top: 16,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.success,
    maxWidth: '76%',
  },
  timelineStep: {
    width: '25%',
    alignItems: 'center',
  },
  timelineDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.borderStrong,
    zIndex: 1,
  },
  timelineDotDone: {
    backgroundColor: colors.success,
  },
  timelineDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surface,
  },
  timelineLabel: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  timelineLabelActive: {
    color: colors.text,
  },
  timelineHelper: {
    color: colors.textSubtle,
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 2,
  },
  cancelledTimelineCard: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  cancelledIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerSoft,
  },
  cancelledCopy: {
    flex: 1,
  },
  cancelledTitle: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '900',
  },
  cancelledText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
});
