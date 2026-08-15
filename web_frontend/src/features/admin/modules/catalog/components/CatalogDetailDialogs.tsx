import type { ManagedBrand, ManagedCategory } from '../catalog.types'
import { genderLabels, getSizeTemplateLabel } from '../catalogDisplay.helpers'
import { StatusPill } from './CatalogEditors'

type CategoryDetailDialogProps = {
  category: ManagedCategory
  categoryNameById: Map<string, string>
  onClose: () => void
}

export function CategoryDetailDialog({
  category,
  categoryNameById,
  onClose,
}: CategoryDetailDialogProps) {
  return (
    <div className="admin-catalog-modal-layer" role="dialog" aria-modal="true" aria-labelledby="view-category-title">
      <button className="admin-catalog-modal-backdrop" type="button" aria-label="Đóng" onClick={onClose} />
      <section className="admin-catalog-modal admin-category-view-modal">
        <header>
          <div>
            <p>Chi tiết danh mục</p>
            <h2 id="view-category-title">{category.name}</h2>
          </div>
          <button className="admin-secondary-button" type="button" onClick={onClose}>Đóng</button>
        </header>
        <div className="admin-category-view-content">
          <div className="admin-catalog-image-preview">
            <img src={category.image} alt={category.name} />
          </div>
          <dl>
            <div>
              <dt>Danh mục cha</dt>
              <dd>{category.parent_id ? categoryNameById.get(category.parent_id) ?? '-' : '-'}</dd>
            </div>
            <div><dt>Giới tính</dt><dd>{genderLabels[category.gender]}</dd></div>
            <div>
              <dt>Bộ size</dt>
              <dd>
                {category.isSizeTemplateSource
                  ? `${getSizeTemplateLabel(category)}: ${(category.sizes ?? []).join(', ') || 'Chưa có size'}`
                  : '-'}
              </dd>
            </div>
            <div><dt>Số sản phẩm</dt><dd>{category.productCount}</dd></div>
            <div><dt>Trạng thái</dt><dd><StatusPill isActive={category.isActive} /></dd></div>
            <div className="is-wide"><dt>Mô tả</dt><dd>{category.description || '-'}</dd></div>
          </dl>
        </div>
      </section>
    </div>
  )
}

type BrandDetailDialogProps = {
  brand: ManagedBrand
  onClose: () => void
}

export function BrandDetailDialog({ brand, onClose }: BrandDetailDialogProps) {
  return (
    <div className="admin-catalog-modal-layer" role="dialog" aria-modal="true" aria-labelledby="view-brand-title">
      <button className="admin-catalog-modal-backdrop" type="button" aria-label="Đóng" onClick={onClose} />
      <section className="admin-catalog-modal admin-brand-view-modal">
        <header>
          <div>
            <p>Chi tiết thương hiệu</p>
            <h2 id="view-brand-title">{brand.name}</h2>
          </div>
          <button className="admin-secondary-button" type="button" onClick={onClose}>Đóng</button>
        </header>
        <div className="admin-brand-view-content">
          <div className="admin-catalog-image-preview">
            <img src={brand.image} alt={brand.name} />
          </div>
          <dl>
            <div><dt>Tên thương hiệu</dt><dd>{brand.name}</dd></div>
            <div><dt>Số sản phẩm</dt><dd>{brand.productCount}</dd></div>
            <div><dt>Trạng thái</dt><dd><StatusPill isActive={brand.isActive} /></dd></div>
          </dl>
        </div>
      </section>
    </div>
  )
}
