import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../theme';

export type LocationPickerOption = {
  label: string;
  value: string;
};

type LocationPickerProps = {
  visible: boolean;
  title: string;
  placeholder?: string;
  options: LocationPickerOption[];
  selectedValue?: string;
  loading?: boolean;
  error?: string;
  emptyText?: string;
  retryLabel?: string;
  onRetry?: () => void;
  onClose: () => void;
  onSelect: (value: string) => void | Promise<void>;
  manualEntryAllowed?: boolean;
  manualLabel?: string;
  manualValue?: string;
  manualPlaceholder?: string;
  onManualChange?: (value: string) => void;
  onManualSubmit?: () => void;
};

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi');

export const LocationPicker = ({
  visible,
  title,
  placeholder = 'Tìm nhanh',
  options,
  selectedValue,
  loading = false,
  error = '',
  emptyText = 'Không có dữ liệu',
  retryLabel = 'Thử lại',
  onRetry,
  onClose,
  onSelect,
  manualEntryAllowed = false,
  manualLabel = 'Nhập phường/xã thủ công',
  manualValue = '',
  manualPlaceholder = 'Nhập tên phường/xã',
  onManualChange,
  onManualSubmit,
}: LocationPickerProps) => {
  const [keyword, setKeyword] = React.useState('');

  React.useEffect(() => {
    if (!visible) {
      setKeyword('');
    }
  }, [visible]);

  const normalizedKeyword = normalizeText(keyword.trim());
  const filteredOptions = normalizedKeyword
    ? options.filter((option) => normalizeText(`${option.label} ${option.value}`).includes(normalizedKeyword))
    : options;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={onClose} activeOpacity={0.82}>
            <MaterialCommunityIcons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <View style={styles.iconButton} />
        </View>

        <View style={styles.searchWrap}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={keyword}
            onChangeText={setKeyword}
            placeholder={placeholder}
            placeholderTextColor={colors.textSubtle}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {keyword ? (
            <TouchableOpacity style={styles.clearButton} onPress={() => setKeyword('')} activeOpacity={0.82}>
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {manualEntryAllowed ? (
          <View style={styles.manualPanel}>
            <Text style={styles.manualLabel}>{manualLabel}</Text>
            <View style={styles.manualRow}>
              <TextInput
                style={styles.manualInput}
                value={manualValue}
                onChangeText={onManualChange}
                placeholder={manualPlaceholder}
                placeholderTextColor={colors.textSubtle}
                autoCapitalize="words"
              />
              <TouchableOpacity
                style={[styles.manualButton, !manualValue.trim() && styles.manualButtonDisabled]}
                onPress={onManualSubmit}
                disabled={!manualValue.trim()}
                activeOpacity={0.82}
              >
                <Text style={styles.manualButtonText}>Dùng</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.statePanel}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.stateText}>Đang tải dữ liệu...</Text>
          </View>
        ) : error ? (
          <View style={styles.statePanel}>
            <MaterialCommunityIcons name="alert-circle-outline" size={28} color={colors.danger} />
            <Text style={styles.stateTitle}>Chưa tải được dữ liệu</Text>
            <Text style={styles.stateText}>{error}</Text>
            {onRetry ? (
              <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.82}>
                <Text style={styles.retryText}>{retryLabel}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <FlatList
            data={filteredOptions}
            keyExtractor={(item) => item.value}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={filteredOptions.length ? styles.listContent : styles.emptyListContent}
            renderItem={({ item }) => {
              const selected = item.value === selectedValue;

              return (
                <TouchableOpacity
                  style={[styles.optionRow, selected && styles.optionRowSelected]}
                  onPress={() => {
                    void onSelect(item.value);
                    onClose();
                  }}
                  activeOpacity={0.82}
                >
                  <View style={styles.optionCopy}>
                    <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{item.label}</Text>
                    <Text style={styles.optionCode}>{item.value}</Text>
                  </View>
                  {selected ? (
                    <MaterialCommunityIcons name="check-circle" size={20} color={colors.brand} />
                  ) : null}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={(
              <View style={styles.statePanel}>
                <MaterialCommunityIcons name="map-search-outline" size={30} color={colors.textMuted} />
                <Text style={styles.stateTitle}>{emptyText}</Text>
                <Text style={styles.stateText}>Thử đổi từ khóa hoặc nhập thủ công nếu dữ liệu chưa được nạp.</Text>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    minHeight: 56,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  searchWrap: {
    minHeight: 48,
    margin: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 10,
  },
  clearButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualPanel: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.goldDark,
    backgroundColor: colors.goldSoft,
    padding: spacing.md,
  },
  manualLabel: {
    color: colors.goldText,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  manualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  manualInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    paddingHorizontal: spacing.md,
  },
  manualButton: {
    minWidth: 58,
    height: 42,
    borderRadius: radii.xs,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  manualButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  manualButtonText: {
    color: colors.white,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  emptyListContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
  },
  optionRow: {
    minHeight: 58,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  optionRowSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
  },
  optionLabel: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  optionLabelSelected: {
    color: colors.brandDark,
  },
  optionCode: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  statePanel: {
    flex: 1,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '900',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  stateText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 38,
    borderRadius: radii.xs,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    color: colors.white,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
});
