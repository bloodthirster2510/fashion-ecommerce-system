import React from 'react';
import {
  Animated,
  Easing,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, spacing } from '../../theme';

type SectionLayout = {
  title: string;
  y: number;
  height: number;
};

type ScrollHandler = (event: NativeSyntheticEvent<NativeScrollEvent>) => void;

export const useStickySectionHeader = (forwardOnScroll?: ScrollHandler) => {
  const sectionLayoutsRef = React.useRef(new Map<string, SectionLayout>());
  const scrollYRef = React.useRef(0);
  const activeTitleRef = React.useRef<string | null>(null);
  const [activeTitle, setActiveTitle] = React.useState<string | null>(null);

  const updateActiveTitle = React.useCallback(() => {
    const scrollY = scrollYRef.current;
    const activeSection = Array.from(sectionLayoutsRef.current.values())
      .sort((left, right) => left.y - right.y)
      .find((section) => scrollY >= section.y && scrollY < section.y + section.height);
    const nextTitle = activeSection?.title ?? null;

    if (activeTitleRef.current !== nextTitle) {
      activeTitleRef.current = nextTitle;
      setActiveTitle(nextTitle);
    }
  }, []);

  const onSectionLayout = React.useCallback((
    sectionKey: string,
    title: string,
    event: LayoutChangeEvent,
  ) => {
    const { y, height } = event.nativeEvent.layout;
    sectionLayoutsRef.current.set(sectionKey, { title, y, height });
    updateActiveTitle();
  }, [updateActiveTitle]);

  const unregisterSection = React.useCallback((sectionKey: string) => {
    sectionLayoutsRef.current.delete(sectionKey);
    updateActiveTitle();
  }, [updateActiveTitle]);

  const onScroll = React.useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    forwardOnScroll?.(event);
    scrollYRef.current = Math.max(0, event.nativeEvent.contentOffset.y);
    updateActiveTitle();
  }, [forwardOnScroll, updateActiveTitle]);

  return {
    activeTitle,
    onScroll,
    onSectionLayout,
    unregisterSection,
  };
};

type StickySectionBoundaryProps = {
  sectionKey: string;
  title: string;
  onSectionLayout: (sectionKey: string, title: string, event: LayoutChangeEvent) => void;
  children: React.ReactNode;
};

export const StickySectionBoundary = ({
  sectionKey,
  title,
  onSectionLayout,
  children,
}: StickySectionBoundaryProps) => {
  return (
    <View
      collapsable={false}
      onLayout={(event) => onSectionLayout(sectionKey, title, event)}
    >
      {children}
    </View>
  );
};

type StickySectionHeaderProps = {
  title: string | null;
};

const StickySectionHeader = ({ title }: StickySectionHeaderProps) => {
  const opacity = React.useRef(new Animated.Value(title ? 1 : 0)).current;
  const translateY = React.useRef(new Animated.Value(title ? 0 : -8)).current;
  const displayedTitleRef = React.useRef(title);
  const [displayedTitle, setDisplayedTitle] = React.useState(title);
  const animationRef = React.useRef<ReturnType<typeof Animated.parallel> | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    animationRef.current?.stop();
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const startEnterAnimation = () => {
      animationRef.current = Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);
      animationRef.current.start();
    };

    if (!title) {
      animationRef.current = Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 170,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -8,
          duration: 190,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]);
      animationRef.current.start(({ finished }) => {
        if (finished) {
          displayedTitleRef.current = null;
          setDisplayedTitle(null);
        }
      });
    } else if (!displayedTitleRef.current) {
      displayedTitleRef.current = title;
      setDisplayedTitle(title);
      opacity.setValue(0);
      translateY.setValue(-8);
      animationFrameRef.current = requestAnimationFrame(startEnterAnimation);
    } else if (displayedTitleRef.current !== title) {
      animationRef.current = Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 110,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -5,
          duration: 110,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]);
      animationRef.current.start(({ finished }) => {
        if (!finished) return;

        displayedTitleRef.current = title;
        setDisplayedTitle(title);
        opacity.setValue(0);
        translateY.setValue(6);
        animationFrameRef.current = requestAnimationFrame(startEnterAnimation);
      });
    } else {
      startEnterAnimation();
    }

    return () => {
      animationRef.current?.stop();
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [opacity, title, translateY]);

  if (!displayedTitle) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        { opacity, transform: [{ translateY }] },
      ]}
      accessibilityRole="header"
      accessibilityLabel={displayedTitle}
    >
      <View style={styles.accent} />
      <Text style={styles.title} numberOfLines={1}>{displayedTitle}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    minHeight: 46,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.brand,
    borderBottomWidth: 1,
    borderBottomColor: colors.brandLight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  accent: {
    width: 4,
    height: 22,
    borderRadius: 2,
    backgroundColor: colors.brandPale,
  },
  title: {
    flex: 1,
    color: colors.white,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
  },
});

export default StickySectionHeader;
