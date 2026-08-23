import type { CatalogGender, ManagedCategory } from '../catalog.types'
import {
  CatalogSection,
  EmptyRow,
  LoadingRow,
  RowActions,
  StatusPill,
} from './CatalogEditors'
import {
  type CatalogStatusFilter,
  genderLabels,
  getFitTypeTemplateLabel,
  getSizeTemplateLabel,
} from '../catalogDisplay.helpers'
import { getPaginationItems } from '../../../utils/pagination'

type CategoryPagination = {
  categories: ManagedCategory[]
  totalRoots: number
  totalPages: number
  safePage: number
  startRoot: number
  endRoot: number
}

type CategoryManagementSectionProps = {
  categories: ManagedCategory[]
  pagination: CategoryPagination
  keyword: string
  genderFilter: 'all' | CatalogGender
  levelFilter: 'all' | string
  statusFilter: CatalogStatusFilter
  isLoading: boolean
  canWrite: boolean
  onKeywordChange: (value: string) => void
  onGenderFilterChange: (value: 'all' | CatalogGender) => void
  onLevelFilterChange: (value: 'all' | string) => void
  onStatusFilterChange: (value: CatalogStatusFilter) => void
  onPageChange: (page: number | ((page: number) => number)) => void
  onAdd: () => void
  onManageSizes: () => void
  onManageFitTypes: () => void
  onView: (category: ManagedCategory) => void
  onEdit: (category: ManagedCategory) => void
  onDelete: (category: ManagedCategory) => void
}

export function CategoryManagementSection({
  categories,
  pagination,
  keyword,
  genderFilter,
  levelFilter,
  statusFilter,
  isLoading,
  canWrite,
  onKeywordChange,
  onGenderFilterChange,
  onLevelFilterChange,
  onStatusFilterChange,
  onPageChange,
  onAdd,
  onManageSizes,
  onManageFitTypes,
  onView,
  onEdit,
  onDelete,
}: CategoryManagementSectionProps) {
  const categoryLevels = [...new Set(categories.map((category) => category.level))]
    .sort((left, right) => left - right)

  const resetFilters = () => {
    onKeywordChange('')
    onGenderFilterChange('all')
    onLevelFilterChange('all')
    onStatusFilterChange('all')
  }

  return (
    <CatalogSection
      title="Danh mục sản phẩm"
      actionLabel="+ Thêm danh mục"
      secondaryActions={[
        {
          label: 'Quản lý size',
          className: 'admin-catalog-size-action',
          onClick: onManageSizes,
        },
        {
          label: 'Quản lý phom dáng',
          className: 'admin-catalog-fit-action',
          onClick: onManageFitTypes,
        },
      ]}
      canWrite={canWrite}
      onAdd={onAdd}
    >
      <div className="admin-catalog-filters">
        <input
          type="search"
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder="Tìm kiếm danh mục..."
          aria-label="Tìm kiếm danh mục"
        />
        <select
          value={genderFilter}
          onChange={(event) => onGenderFilterChange(event.target.value as 'all' | CatalogGender)}
          aria-label="Lọc giới tính"
        >
          <option value="all">Tất cả giới tính</option>
          <option value="male">Nam</option>
          <option value="female">Nữ</option>
          <option value="unisex">Unisex</option>
        </select>
        <select
          value={levelFilter}
          onChange={(event) => onLevelFilterChange(event.target.value)}
          aria-label="Lọc cấp danh mục"
        >
          <option value="all">Tất cả cấp</option>
          {categoryLevels.map((level) => (
            <option value={level} key={level}>Cấp {level}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value as CatalogStatusFilter)}
          aria-label="Lọc trạng thái danh mục"
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
        <table className="admin-table admin-catalog-table">
          <thead>
            <tr>
              <th>Ảnh</th>
              <th>Tên danh mục</th>
              <th>Giới tính</th>
              <th>Bộ size</th>
              <th>Bộ phom dáng</th>
              <th>Số sản phẩm</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <LoadingRow colSpan={8} /> : null}
            {!isLoading && pagination.categories.length === 0 ? (
              <EmptyRow colSpan={8} label="Không có danh mục phù hợp." />
            ) : null}
            {!isLoading
              ? pagination.categories.map((category) => (
                  <tr
                    key={category._id}
                    className={`admin-category-level-${Math.min(category.level, 4)}`}
                  >
                    <td>
                      <span className="admin-category-image">
                        {category.image ? (
                          <img src={category.image} alt={category.name} />
                        ) : (
                          <span className="admin-image-placeholder">-</span>
                        )}
                      </span>
                    </td>
                    <td>
                      <strong className="admin-category-level-name">{category.name}</strong>
                    </td>
                    <td>{genderLabels[category.gender]}</td>
                    <td>
                      {category.isSizeTemplateSource ? (
                        <span className="admin-size-badge is-source">
                          {getSizeTemplateLabel(category)}
                        </span>
                      ) : (
                        <span className="admin-size-badge is-empty">-</span>
                      )}
                    </td>
                    <td>
                      {category.isFitTypeTemplateSource ? (
                        <span className="admin-size-badge is-source">
                          {getFitTypeTemplateLabel(category)}
                        </span>
                      ) : category.fitTypes?.length ? (
                        <span className="admin-size-badge is-source">
                          {getFitTypeTemplateLabel(category)}
                        </span>
                      ) : (
                        <span className="admin-size-badge is-empty">-</span>
                      )}
                    </td>
                    <td>{category.productCount}</td>
                    <td><StatusPill isActive={category.isActive} /></td>
                    <td>
                      <RowActions
                        disabled={!canWrite}
                        onView={() => onView(category)}
                        onEdit={() => onEdit(category)}
                        onDelete={() => onDelete(category)}
                      />
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
      <footer className="admin-table-footer admin-catalog-pagination">
        <span>
          Danh mục gốc {pagination.startRoot} / {pagination.totalRoots} nhóm danh mục
        </span>
        <div>
          <button
            className="admin-secondary-button"
            type="button"
            disabled={pagination.safePage <= 1 || isLoading}
            onClick={() => onPageChange((page) => Math.max(1, page - 1))}
          >
            Trước
          </button>
          <div className="admin-catalog-page-numbers" aria-label="Phân trang danh mục">
            {getPaginationItems(pagination.totalPages, pagination.safePage).map((item) =>
              typeof item === 'number' ? (
                <button
                  className={`admin-catalog-page-button${item === pagination.safePage ? ' is-active' : ''}`}
                  type="button"
                  key={item}
                  aria-current={item === pagination.safePage ? 'page' : undefined}
                  disabled={isLoading}
                  onClick={() => onPageChange(item)}
                >
                  {item}
                </button>
              ) : (
                <span className="admin-page-ellipsis" key={item} aria-hidden="true">
                  ...
                </span>
              ),
            )}
          </div>
          <button
            className="admin-secondary-button"
            type="button"
            disabled={pagination.safePage >= pagination.totalPages || isLoading}
            onClick={() =>
              onPageChange((page) => Math.min(pagination.totalPages, page + 1))
            }
          >
            Sau
          </button>
        </div>
      </footer>
    </CatalogSection>
  )
}
