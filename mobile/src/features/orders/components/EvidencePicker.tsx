import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../../theme';
import type { OrderEvidenceImageAttachment } from '../orderApi';

export type EvidenceDraft = OrderEvidenceImageAttachment & {
  uri: string;
};

type EvidencePickerProps = {
  images: EvidenceDraft[];
  onPick: () => void;
  onRemove: (index: number) => void;
  disabled: boolean;
};

export function EvidencePicker({ images, onPick, onRemove, disabled }: EvidencePickerProps) {
  return (
    <View style={styles.evidencePicker}>
      <View style={styles.evidenceHeader}>
        <Text style={styles.evidenceTitle}>Ảnh minh chứng</Text>
        <Text style={styles.evidenceHint}>Không bắt buộc, tối đa 3 ảnh</Text>
      </View>
      <View style={styles.evidenceImageRow}>
        {images.map((image, index) => (
          <View style={styles.evidenceImageFrame} key={`${image.uri}-${index}`}>
            <Image source={{ uri: image.uri }} style={styles.evidenceImage} resizeMode="cover" />
            <TouchableOpacity
              style={styles.evidenceRemoveButton}
              onPress={() => onRemove(index)}
              disabled={disabled}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="close" size={14} color={colors.white} />
            </TouchableOpacity>
          </View>
        ))}
        {images.length < 3 ? (
          <TouchableOpacity
            style={styles.evidenceAddButton}
            onPress={onPick}
            disabled={disabled}
            activeOpacity={0.84}
          >
            <MaterialCommunityIcons name="image-plus" size={22} color={colors.brand} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  evidencePicker: {
    gap: spacing.sm,
  },
  evidenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  evidenceTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  evidenceHint: {
    color: colors.textSubtle,
    fontSize: 12,
    fontWeight: '700',
  },
  evidenceImageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  evidenceImageFrame: {
    position: 'relative',
    width: 64,
    height: 64,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: colors.brandSoft,
  },
  evidenceImage: {
    width: '100%',
    height: '100%',
  },
  evidenceRemoveButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  evidenceAddButton: {
    width: 64,
    height: 64,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandSoft,
  },
});
