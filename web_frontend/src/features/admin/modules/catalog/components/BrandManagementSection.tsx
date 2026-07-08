import type { ManagedBrand } from '../catalog.types'
import {
  CatalogSection,
  EmptyRow,
  LoadingRow,
  RowActions,
  StatusPill,
} from './CatalogEditors'
import type { CatalogStatusFilter } from '../catalogDisplay.helpers'

type BrandManagementSectionProps = {
  brands: ManagedBrand[]
  keyword: string
  statusFilter: CatalogStatusFilter
  isLoading: boolean
  canWrite: boolean
  onKeywordChange: (value: string) => void
  onStatusFilterChange: (value: CatalogStatusFilter) => void
  onAdd: () => void
  onView: (brand: ManagedBrand) => void
  onEdit: (brand: ManagedBrand) => void
  onDelete: (brand: ManagedBrand) => void
}

export function BrandManagementSection({
  brands,
  keyword,
  statusFilter,
  isLoading,
  canWrite,
  onKeywordChange,
  onStatusFilterChange,
  onAdd,
  onView,
  onEdit,
  onDelete,
}: BrandManagementSectionProps) {
  const resetFilters = () => {
    onKeywordChange('')
    onStatusFilterChange('all')
  }

  return (
    <CatalogSection
      title="Thương hiệu"
      actionLabel="+ Thêm thương hiệu"
      canWrite={canWrite}
      onAdd={onAdd}
    >
      <div className="admin-catalog-filters is-brand">
        <input
          type="search"
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder="Tìm kiếm thương hiệu..."
          aria-label="Tìm kiếm thương hiệu"
        />
        <select
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value as CatalogStatusFilter)}
          aria-label="Lọc trạng thái thương hiệu"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Hoạt động</option>
          <option value="inactive">Tạm ngừng</option>
        </select>
        <button className="admin-secondary-button" type="button" onClick={resetFilters}>
          Đặt lại
        </button>
      </div>

      <div className="admin-table-shell">
        <table className="admin-table admin-catalog-table is-brand">
          <thead>
            <tr>
              <th>Logo</th>
              <th>Tên thương hiệu</th>
              <th>Số sản phẩm</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <LoadingRow colSpan={5} /> : null}
            {!isLoading && brands.length === 0 ? (
              <EmptyRow colSpan={5} label="Không có thương hiệu phù hợp." />
            ) : null}
            {!isLoading
              ? brands.map((brand) => (
                  <tr key={brand._id}>
                    <td>
                      <span className="admin-brand-logo">
                        <img src={brand.image} alt="" />
                      </span>
                    </td>
                    <td><strong>{brand.name}</strong></td>
                    <td>{brand.productCount}</td>
                    <td><StatusPill isActive={brand.isActive} /></td>
                    <td>
                      <RowActions
                        disabled={!canWrite}
                        onView={() => onView(brand)}
                        onEdit={() => onEdit(brand)}
                        onDelete={() => onDelete(brand)}
                      />
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
    </CatalogSection>
  )
}
