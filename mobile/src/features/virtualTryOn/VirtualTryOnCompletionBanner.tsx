import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RemoteImage } from '../../components/media/RemoteImage';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { colors, radii, shadows, spacing } from '../../theme';
import type { VirtualTryOnRealtimeEvent } from './virtualTryOnRealtime';

type TryOnRouteName = keyof RootStackParamList;
type CompletionKind = 'image' | 'video';

export type VirtualTryOnCompletion = {
  key: string;
  jobId: string;
  kind: CompletionKind;
  imageUrl: string | null;
  imageCount: number;
};

type Props = {
  currentRouteName?: TryOnRouteName;
  event: VirtualTryOnRealtimeEvent | null;
  onOpenResult: (jobId: string) => void;
};

const AUTO_DISMISS_MS = 6_000;
const HIDDEN_OFFSET = -160;
const MAX_HANDLED_EVENTS = 100;

const tryOnRoutes = new Set<TryOnRouteName>([
  'VirtualTryOnHome',
  'VirtualTryOnBuilder',
  'VirtualTryOnProcessing',
  'VirtualTryOnResult',
  'VirtualTryOnHistory',
]);

const normalizedImageUrls = (event: VirtualTryOnRealtimeEvent) => [
  ...(event.generatedImageUrls ?? []),
  event.generatedImageUrl,
]
  .map((url) => url?.trim())
  .filter((url): url is string => Boolean(url));

export const getVirtualTryOnCompletion = (
  event: VirtualTryOnRealtimeEvent,
): VirtualTryOnCompletion | null => {
  const imageUrls = [...new Set(normalizedImageUrls(event))];
  const videoUrl = event.generatedVideoUrl?.trim() || null;

  if (event.videoStatus === 'succeeded' && videoUrl) {
    return {
      key: `${event.jobId}:video`,
      jobId: event.jobId,
      kind: 'video',
      imageUrl: imageUrls[0] ?? null,
      imageCount: imageUrls.length,
    };
  }

  if (imageUrls.length > 0) {
    return {
      key: `${event.jobId}:image`,
      jobId: event.jobId,
      kind: 'image',
      imageUrl: imageUrls[0],
      imageCount: imageUrls.length,
    };
  }

  return null;
};

export const isVirtualTryOnRoute = (routeName?: TryOnRouteName) => (
  routeName ? tryOnRoutes.has(routeName) : false
);

const VirtualTryOnCompletionBanner = ({ currentRouteName, event, onOpenResult }: Props) => {
  const insets = useSafeAreaInsets();
  const [queue, setQueue] = React.useState<VirtualTryOnCompletion[]>([]);
  const handledKeysRef = React.useRef(new Set<string>());
  const dismissingRef = React.useRef(false);
  const translateY = React.useRef(new Animated.Value(HIDDEN_OFFSET)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;
  const active = queue[0] ?? null;

  React.useEffect(() => {
    if (!event || !currentRouteName) return;
    const completion = getVirtualTryOnCompletion(event);
    if (!completion || handledKeysRef.current.has(completion.key)) return;

    handledKeysRef.current.add(completion.key);
    if (handledKeysRef.current.size > MAX_HANDLED_EVENTS) {
      const oldestKey = handledKeysRef.current.values().next().value;
      if (oldestKey) handledKeysRef.current.delete(oldestKey);
    }

    if (isVirtualTryOnRoute(currentRouteName)) return;
    setQueue((current) => [...current, completion]);
  }, [currentRouteName, event]);

  const finishDismiss = React.useCallback((key: string) => {
    setQueue((current) => current[0]?.key === key ? current.slice(1) : current);
    dismissingRef.current = false;
  }, []);

  const dismiss = React.useCallback(() => {
    if (!active || dismissingRef.current) return;
    dismissingRef.current = true;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: HIDDEN_OFFSET,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => finishDismiss(active.key));
  }, [active, finishDismiss, opacity, translateY]);

  React.useEffect(() => {
    if (!active) return;
    dismissingRef.current = false;
    translateY.setValue(HIDDEN_OFFSET);
    opacity.setValue(0);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        damping: 18,
        stiffness: 190,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [active, dismiss, opacity, translateY]);

  React.useEffect(() => {
    if (active && isVirtualTryOnRoute(currentRouteName)) dismiss();
  }, [active, currentRouteName, dismiss]);

  if (!active) return null;

  const title = active.kind === 'video'
    ? 'Video phối đồ đã sẵn sàng'
    : active.imageCount > 1
      ? `${active.imageCount} ảnh phối đồ đã sẵn sàng`
      : 'Ảnh phối đồ đã sẵn sàng';

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.position,
          {
            opacity,
            paddingTop: insets.top + spacing.sm,
            transform: [{ translateY }],
          },
        ]}
      >
        <TouchableOpacity
          accessibilityHint="Mở màn hình kết quả phối đồ"
          accessibilityLabel={`${title}. Xem kết quả ngay`}
          accessibilityRole="button"
          activeOpacity={0.92}
          onPress={() => {
            onOpenResult(active.jobId);
            dismiss();
          }}
          style={styles.banner}
        >
          <View style={styles.preview}>
            {active.imageUrl ? (
              <RemoteImage
                uri={active.imageUrl}
                recyclingKey={`${active.key}:preview`}
                style={styles.previewImage}
              />
            ) : (
              <MaterialCommunityIcons name="hanger" color={colors.brand} size={24} />
            )}
            <View style={styles.readyBadge}>
              <MaterialCommunityIcons name="check" color={colors.white} size={11} />
            </View>
          </View>

          <View style={styles.copy}>
            <Text numberOfLines={1} style={styles.eyebrow}>PHÒNG PHỐI ĐỒ</Text>
            <Text numberOfLines={2} style={styles.title}>{title}</Text>
            <Text numberOfLines={1} style={styles.action}>Chạm để xem kết quả</Text>
          </View>

          <TouchableOpacity
            accessibilityLabel="Đóng thông báo"
            accessibilityRole="button"
            activeOpacity={0.7}
            hitSlop={8}
            onPress={dismiss}
            style={styles.closeButton}
          >
            <MaterialCommunityIcons name="close" color={colors.textMuted} size={20} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  position: {
    left: spacing.md,
    position: 'absolute',
    right: spacing.md,
    top: 0,
    zIndex: 1000,
  },
  banner: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.brandPale,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 88,
    padding: spacing.md,
    ...shadows.card,
    elevation: 10,
  },
  preview: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: radii.sm,
    height: 58,
    justifyContent: 'center',
    marginRight: spacing.md,
    position: 'relative',
    width: 50,
  },
  previewImage: {
    borderRadius: radii.sm,
    height: 58,
    width: 50,
  },
  readyBadge: {
    alignItems: 'center',
    backgroundColor: colors.success,
    borderColor: colors.surface,
    borderRadius: 9,
    borderWidth: 2,
    bottom: -3,
    height: 18,
    justifyContent: 'center',
    position: 'absolute',
    right: -3,
    width: 18,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: colors.brand,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    lineHeight: 14,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
    marginTop: 1,
  },
  action: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  closeButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    marginLeft: spacing.xs,
    width: 32,
  },
});

export default VirtualTryOnCompletionBanner;
