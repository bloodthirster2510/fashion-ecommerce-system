import type { ManagedProduct } from '../product.types'
import type { ProductDeleteMode } from '../productDisplay.helpers'

export function ProductDeleteConfirmationDialog({
  product,
  isSaving,
  onClose,
  onConfirm,
}: {
  product: ManagedProduct
  isSaving: boolean
  onClose: () => void
  onConfirm: (mode: ProductDeleteMode) => void
}) {
  return (
    <div className="admin-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="delete-product-title">
      <div className="admin-confirm-box">
        <h2 id="delete-product-title">Xóa sản phẩm?</h2>
        <p>
          Nếu chỉ muốn ẩn “{product.name}” khỏi cửa hàng, hãy chọn ngừng bán. Dữ
          liệu cũ vẫn được giữ lại để tra cứu.
        </p>
        <p className="admin-delete-warning">
          Chỉ xóa vĩnh viễn khi đây là sản phẩm tạo nhầm hoặc chưa từng phát sinh đơn hàng,
          tồn kho, phiếu nhập, giỏ hàng, khuyến mãi, yêu thích hay đánh giá.
        </p>
        {!product.canDeletePermanently ? (
          <p className="admin-delete-blocked">
            {product.permanentDeleteBlockReason ??
              'Chưa thể xóa vĩnh viễn sản phẩm này vì đã có dữ liệu liên quan.'}
          </p>
        ) : null}
        <div>
          <button className="admin-secondary-button" type="button" disabled={isSaving} onClick={onClose}>Hủy</button>
          <button
            className="admin-secondary-button"
            type="button"
            disabled={isSaving || !product.isActive}
            onClick={() => onConfirm('pause')}
          >
            {isSaving ? 'Đang xử lý...' : 'Ngừng bán'}
          </button>
          <button
            className="admin-danger-button"
            type="button"
            disabled={isSaving || !product.canDeletePermanently}
            onClick={() => onConfirm('permanent')}
          >
            {isSaving ? 'Đang xử lý...' : 'Xóa vĩnh viễn'}
          </button>
        </div>
      </div>
    </div>
  )
}
