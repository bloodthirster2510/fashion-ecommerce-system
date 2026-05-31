import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../../theme';

export type CategoryRailItem = {
  id: string;
  label: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  isPrimary?: boolean;
  onPress: () => void;
};

type CategoryRailProps = {
  visible: boolean;
  items: CategoryRailItem[];
  isLoading?: boolean;
};

const CategoryRail = ({ visible, items, isLoading }: CategoryRailProps) => {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.rail}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {items.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.chip, item.isPrimary && styles.primaryChip]}
            onPress={item.onPress}
            activeOpacity={0.82}
          >
            {'icon' in item && item.icon ? (
              <MaterialCommunityIcons
                name={item.icon}
                size={16}
                color={item.isPrimary ? colors.white : colors.brand}
              />
            ) : null}
            <Text style={[styles.chipText, item.isPrimary && styles.primaryChipText]} numberOfLines={1}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}

        {isLoading ? (
          <View style={styles.loadingChip}>
            <Text style={styles.loadingText}>Đang tải...</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  rail: {
    backgroundColor: colors.brand,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    gap: spacing.sm,
  },
  chip: {
    height: 31,
    maxWidth: 132,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
  },
  primaryChip: {
    backgroundColor: colors.brandDark,
  },
  chipText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  primaryChipText: {
    color: colors.white,
  },
  loadingChip: {
    height: 31,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.white,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
});

export default CategoryRail;
