type PromotionBulkToolbarProps = {
  selectedCount: number
  isLoading: boolean
  onEnable: () => void
  onDisable: () => void
  onDelete: () => void
  onClear: () => void
}

export function PromotionBulkToolbar({
  selectedCount,
  isLoading,
  onEnable,
  onDisable,
  onDelete,
  onClear,
}: PromotionBulkToolbarProps) {
  if (!selectedCount) {
    return null
  }

  return (
    <div className="admin-bulk-toolbar" role="toolbar" aria-label="Thao tác hàng loạt">
      <strong>{selectedCount} voucher đã chọn</strong>
      <button type="button" disabled={isLoading} onClick={onEnable}>Bật</button>
      <button type="button" disabled={isLoading} onClick={onDisable}>Tắt</button>
      <button className="is-danger" type="button" disabled={isLoading} onClick={onDelete}>Xóa</button>
      <button type="button" disabled={isLoading} onClick={onClear}>Bỏ chọn</button>
    </div>
  )
}
