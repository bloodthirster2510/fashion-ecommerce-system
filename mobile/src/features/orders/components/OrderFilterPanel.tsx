import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../../theme';

export type PaymentFilter = 'all' | 'needs-payment' | 'cash' | 'transfer';

type PaymentFilterOption = {
  key: PaymentFilter;
  label: string;
};

type OrderFilterPanelProps = {
  hasActiveFilters: boolean;
  paymentFilter: PaymentFilter;
  paymentFilters: PaymentFilterOption[];
  searchText: string;
  onClearFilters: () => void;
  onPaymentFilterChange: (filter: PaymentFilter) => void;
  onSearchTextChange: (value: string) => void;
  shouldShowPaymentFilterDot: (filter: PaymentFilter) => boolean;
};

export function OrderFilterPanel({
  hasActiveFilters,
  paymentFilter,
  paymentFilters,
  searchText,
  onClearFilters,
  onPaymentFilterChange,
  onSearchTextChange,
  shouldShowPaymentFilterDot,
}: OrderFilterPanelProps) {
  return (
    <View style={styles.filterPanel}>
      <View style={styles.searchBox}>
        <MaterialCommunityIcons name="magnify" size={21} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={onSearchTextChange}
          placeholder="Tìm mã đơn, hóa đơn, sản phẩm"
          placeholderTextColor={colors.textSubtle}
          returnKeyType="search"
        />
        {searchText ? (
          <TouchableOpacity onPress={() => onSearchTextChange('')} style={styles.searchClearButton} activeOpacity={0.8}>
            <MaterialCommunityIcons name="close-circle" size={19} color={colors.textSubtle} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.paymentFilters}>
        {paymentFilters.map((item) => {
          const isActive = paymentFilter === item.key;
          const showDot = shouldShowPaymentFilterDot(item.key);

          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.paymentFilterButton, isActive && styles.paymentFilterButtonActive]}
              onPress={() => onPaymentFilterChange(item.key)}
              activeOpacity={0.84}
            >
              {showDot ? <View style={styles.filterActionDot} /> : null}
              <Text style={[styles.paymentFilterText, isActive && styles.paymentFilterTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {hasActiveFilters ? (
          <TouchableOpacity style={styles.resetFilterButton} onPress={onClearFilters} activeOpacity={0.84}>
            <MaterialCommunityIcons name="filter-remove-outline" size={17} color={colors.danger} />
            <Text style={styles.resetFilterText}>Xóa lọc</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  filterPanel: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBox: {
    minHeight: 44,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.field,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 0,
  },
  searchClearButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentFilters: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  paymentFilterButton: {
    minHeight: 34,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  paymentFilterButtonActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  paymentFilterText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  paymentFilterTextActive: {
    color: colors.brandDark,
  },
  filterActionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.goldDark,
  },
  resetFilterButton: {
    minHeight: 34,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    backgroundColor: '#FFF7F7',
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  resetFilterText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '900',
  },
});
