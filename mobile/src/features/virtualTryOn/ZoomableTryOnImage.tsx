import React from 'react';
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

type ZoomableTryOnImageProps = {
  uri: string;
  onZoomChange?: (isZoomed: boolean) => void;
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;

const ZoomableTryOnImage = ({ uri, onZoomChange }: ZoomableTryOnImageProps) => {
  const { width, height } = useWindowDimensions();
  const [isZoomed, setIsZoomed] = React.useState(false);
  const [loadState, setLoadState] = React.useState<'loading' | 'loaded' | 'error'>('loading');
  const onZoomChangeRef = React.useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;
  const scale = useSharedValue(MIN_SCALE);
  const savedScale = useSharedValue(MIN_SCALE);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const updateZoomState = React.useCallback((nextIsZoomed: boolean) => {
    setIsZoomed(nextIsZoomed);
    onZoomChangeRef.current?.(nextIsZoomed);
  }, []);

  React.useEffect(() => {
    setLoadState('loading');
    scale.value = MIN_SCALE;
    savedScale.value = MIN_SCALE;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    updateZoomState(false);
  }, [savedScale, savedTranslateX, savedTranslateY, scale, translateX, translateY, updateZoomState, uri]);

  const reset = () => {
    'worklet';
    scale.value = withSpring(MIN_SCALE);
    savedScale.value = MIN_SCALE;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    runOnJS(updateZoomState)(false);
  };

  const clampTranslation = () => {
    'worklet';
    const maxX = (width * (scale.value - MIN_SCALE)) / 2;
    const maxY = (height * (scale.value - MIN_SCALE)) / 2;
    const nextX = Math.min(maxX, Math.max(-maxX, translateX.value));
    const nextY = Math.min(maxY, Math.max(-maxY, translateY.value));
    translateX.value = withSpring(nextX);
    translateY.value = withSpring(nextY);
    savedTranslateX.value = nextX;
    savedTranslateY.value = nextY;
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, savedScale.value * event.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= MIN_SCALE + 0.01) {
        reset();
        return;
      }
      clampTranslation();
      runOnJS(updateZoomState)(true);
    });

  const panGesture = Gesture.Pan()
    .enabled(isZoomed)
    .onUpdate((event) => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(clampTranslation);

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((_event, success) => {
      if (!success) return;
      if (scale.value > MIN_SCALE + 0.01) {
        reset();
        return;
      }
      scale.value = withSpring(2.5);
      savedScale.value = 2.5;
      runOnJS(updateZoomState)(true);
    });

  const gesture = Gesture.Simultaneous(pinchGesture, panGesture, doubleTapGesture);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureHandlerRootView style={styles.root}>
      <GestureDetector gesture={gesture}>
        <View style={styles.canvas}>
          <Animated.Image
            key={uri}
            source={{ uri }}
            style={[styles.image, animatedStyle]}
            resizeMode="contain"
            fadeDuration={0}
            onLoad={() => setLoadState('loaded')}
            onError={() => setLoadState('error')}
          />
          {loadState === 'loading' ? (
            <ActivityIndicator
              pointerEvents="none"
              style={styles.loadOverlay}
              size="large"
              color="#FFFFFF"
            />
          ) : null}
          {loadState === 'error' ? (
            <View pointerEvents="none" style={styles.loadOverlay}>
              <Text style={styles.errorText}>Không tải được ảnh</Text>
            </View>
          ) : null}
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignSelf: 'stretch',
  },
  canvas: {
    flex: 1,
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  loadOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
});

export default ZoomableTryOnImage;
