import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii, shadows, spacing } from '../../../theme';

type FeatureCardProps = {
  title: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress?: () => void;
};

const FeatureCard = ({ title, description, icon, onPress }: FeatureCardProps) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.86}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.visual}>
        <MaterialCommunityIcons name={icon} size={44} color={colors.brand} />
      </View>
      <Text style={styles.description}>{description}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.card,
  },
  title: {
    color: colors.black,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  visual: {
    width: '100%',
    aspectRatio: 1.65,
    borderRadius: radii.sm,
    backgroundColor: colors.brandPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});

export default FeatureCard;
