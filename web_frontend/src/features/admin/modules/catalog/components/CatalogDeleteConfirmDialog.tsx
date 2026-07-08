import type { ManagedBrand, ManagedCategory } from '../catalog.types'
import type { CatalogDeleteMode } from '../catalogDisplay.helpers'

type DeleteTarget =
  | { type: 'category'; item: ManagedCategory }
  | { type: 'brand'; item: ManagedBrand }

type CatalogDeleteConfirmDialogProps = {
  target: DeleteTarget
  mode: CatalogDeleteMode | null
  isSaving: boolean
  onCancel: () => void
  onModeChange: (mode: CatalogDeleteMode | null) => void
  onConfirm: (mode: CatalogDeleteMode) => void
}

export function CatalogDeleteConfirmDialog({
  target,
  mode,
  isSaving,
  onCancel,
  onModeChange,
  onConfirm,
}: CatalogDeleteConfirmDialogProps) {
  return (
    <>
      <div className="admin-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="catalog-delete-title">
        <div className="admin-confirm-box">
          <h2 id="catalog-delete-title">Xóa hoặc tạm ngừng?</h2>
          <p>
            Nếu chỉ muốn ẩn “{target.item.name}” khỏi quy trình bán hàng, hãy chọn tạm
            ngừng. Dữ liệu cũ vẫn được giữ lại để tra cứu.
          </p>
          <p className="admin-delete-warning">
            Chỉ xóa vĩnh viễn khi đây là dữ liệu tạo nhầm hoặc chưa từng được sử dụng. Với
            danh mục, hệ thống sẽ chặn nếu còn danh mục con, sản phẩm, mẫu size/form hoặc
            khuyến mãi liên quan.
          </p>
          {target.type === 'category' && target.item.activeProductCount > 0 ? (
            <p className="admin-delete-blocked">
              Danh mục này còn {target.item.activeProductCount.toLocaleString('vi-VN')} sản
              phẩm đang bán. Nếu tạm ngừng danh mục, các sản phẩm liên quan cũng sẽ được ngừng bán.
            </p>
          ) : null}
          <div>
            <button
              className="admin-secondary-button"
              type="button"
              disabled={isSaving}
              onClick={onCancel}
            >
              Hủy
            </button>
            <button
              className="admin-danger-button"
              type="button"
              disabled={isSaving}
              onClick={() => onModeChange('soft')}
            >
              {isSaving ? 'Đang xử lý...' : 'Tạm ngừng'}
            </button>
            <button
              className="admin-danger-button is-permanent"
              type="button"
              disabled={isSaving || target.item.productCount > 0}
              onClick={() => onModeChange('permanent')}
            >
              Xóa vĩnh viễn
            </button>
          </div>
        </div>
      </div>

      {mode ? (
        <div className="admin-confirm-layer is-top" role="dialog" aria-modal="true" aria-labelledby="catalog-delete-final-title">
          <div className="admin-confirm-box">
            <h2 id="catalog-delete-final-title">
              Bạn có thật sự muốn {mode === 'permanent' ? 'xóa vĩnh viễn' : 'tạm ngừng'}?
            </h2>
            <p>Xác nhận thao tác với “{target.item.name}”.</p>
            {mode === 'permanent' ? (
              <p className="admin-delete-blocked">
                Sau khi xóa vĩnh viễn, dữ liệu này sẽ không thể khôi phục.
              </p>
            ) : target.type === 'category' && target.item.activeProductCount > 0 ? (
              <p className="admin-delete-warning">
                Xác nhận tạm ngừng danh mục và ngừng bán{' '}
                {target.item.activeProductCount.toLocaleString('vi-VN')} sản phẩm liên quan.
              </p>
            ) : null}
            <div>
              <button
                className="admin-secondary-button"
                type="button"
                disabled={isSaving}
                onClick={() => onModeChange(null)}
              >
                Không
              </button>
              <button
                className="admin-danger-button"
                type="button"
                disabled={isSaving}
                onClick={() => onConfirm(mode)}
              >
                {isSaving ? 'Đang xử lý...' : 'Có, xác nhận'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
