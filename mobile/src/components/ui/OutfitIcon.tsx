import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme';

type OutfitIconProps = {
  color: string;
  size?: number;
  muted?: boolean;
};

const OutfitIcon = ({ color, size = 24, muted = false }: OutfitIconProps) => {
  const swatchSize = Math.max(5, Math.round(size * 0.22));
  const swatchBorderWidth = Math.max(1, size / 24);
  const accentColors = muted
    ? [colors.textSubtle, colors.borderStrong]
    : [colors.coral, colors.gold];

  return (
    <View style={[styles.canvas, { width: size, height: size }]} pointerEvents="none">
      <MaterialCommunityIcons name="hanger" size={size} color={color} />
      <View style={[styles.swatches, { right: -1, bottom: 0 }]}>
        {accentColors.map((accentColor, index) => (
          <View
            key={accentColor}
            style={[
              styles.swatch,
              index > 0 && { marginLeft: -swatchBorderWidth },
              {
                width: swatchSize,
                height: swatchSize,
                borderRadius: swatchSize / 2,
                borderWidth: swatchBorderWidth,
                backgroundColor: accentColor,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  canvas: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatches: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
  },
  swatch: {
    borderColor: colors.white,
  },
});

export default OutfitIcon;
