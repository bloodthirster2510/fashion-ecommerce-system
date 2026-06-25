import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

type ShopNameLogoProps = {
  compact?: boolean;
};

const shopNameImage = require('../../../assets/ShopName.png');

export default function ShopNameLogo({ compact = false }: ShopNameLogoProps) {
  return (
    <View style={compact ? styles.compactFrame : styles.frame}>
      <Image
        accessibilityLabel="CDSHOP"
        resizeMode="cover"
        source={shopNameImage}
        style={styles.image}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: 132,
    height: 48,
    overflow: 'hidden',
  },
  compactFrame: {
    width: 120,
    height: 40,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
