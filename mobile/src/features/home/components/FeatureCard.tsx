import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii, shadows, spacing } from '../../../theme';

type FeatureIconName = keyof typeof MaterialCommunityIcons.glyphMap;

type FeatureCardProps = {
  title: string;
  description: string;
  icon: FeatureIconName;
  imageSource?: ImageSourcePropType;
  supportingIcons?: FeatureIconName[];
  onPress?: () => void;
};

const FeatureCard = ({ title, description, icon, imageSource, supportingIcons = [], onPress }: FeatureCardProps) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.86}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.visual}>
        {imageSource ? (
          <Image source={imageSource} style={styles.visualImage} resizeMode="cover" />
        ) : (
          <View style={styles.iconCluster}>
            <MaterialCommunityIcons name={icon} size={44} color={colors.brand} />
            {supportingIcons.map((supportingIcon) => (
              <View key={supportingIcon} style={styles.supportingIcon}>
                <MaterialCommunityIcons name={supportingIcon} size={18} color={colors.white} />
              </View>
            ))}
          </View>
        )}
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
    overflow: 'hidden',
  },
  visualImage: {
    width: '100%',
    height: '100%',
  },
  iconCluster: {
    minWidth: 76,
    minHeight: 62,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  supportingIcon: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.surface,
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
