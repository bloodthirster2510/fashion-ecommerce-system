import type {
  ProductActiveFilter,
  ProductStockFilter,
} from '../productDisplay.helpers'
import { SearchIcon } from './ProductIcons'

type ProductFiltersProps = {
  keyword: string
  categoryFilter: string
  brandFilter: string
  fitTypeFilter: string
  activeFilter: ProductActiveFilter
  stockFilter: ProductStockFilter
  showAdvancedFilters: boolean
  hasAdvancedFilters: boolean
  filterOptions: {
    categories: string[]
    brands: string[]
    fitTypes: string[]
  }
  onKeywordChange: (value: string) => void
  onCategoryFilterChange: (value: string) => void
  onBrandFilterChange: (value: string) => void
  onFitTypeFilterChange: (value: string) => void
  onActiveFilterChange: (value: ProductActiveFilter) => void
  onStockFilterChange: (value: ProductStockFilter) => void
  onAdvancedFiltersToggle: () => void
  onAdvancedFiltersClose: () => void
}

export function ProductFilters({
  keyword,
  categoryFilter,
  brandFilter,
  fitTypeFilter,
  activeFilter,
  stockFilter,
  showAdvancedFilters,
  hasAdvancedFilters,
  filterOptions,
  onKeywordChange,
  onCategoryFilterChange,
  onBrandFilterChange,
  onFitTypeFilterChange,
  onActiveFilterChange,
  onStockFilterChange,
  onAdvancedFiltersToggle,
  onAdvancedFiltersClose,
}: ProductFiltersProps) {
  const resetFilters = () => {
    onKeywordChange('')
    onCategoryFilterChange('all')
    onBrandFilterChange('all')
    onFitTypeFilterChange('all')
    onActiveFilterChange('all')
    onStockFilterChange('all')
    onAdvancedFiltersClose()
  }

  return (
    <div className="admin-product-toolbar">
      <div className="admin-product-primary-filters">
        <label className="admin-product-search">
          <SearchIcon />
          <input
            type="search"
            value={keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
            placeholder="Tìm kiếm sản phẩm..."
            aria-label="Tìm kiếm sản phẩm"
          />
        </label>
        <select
          value={stockFilter}
          onChange={(event) => onStockFilterChange(event.target.value as ProductStockFilter)}
          aria-label="Cảnh báo tồn kho"
        >
          <option value="all">Tất cả tồn kho</option>
          <option value="warning">Cần xử lý</option>
          <option value="available">Đủ hàng</option>
        </select>
        <button className="admin-secondary-button" type="button" onClick={onAdvancedFiltersToggle}>
          Bộ lọc nâng cao{hasAdvancedFilters ? ' (đang dùng)' : ''}
        </button>
        <button className="admin-secondary-button" type="button" onClick={resetFilters}>
          Đặt lại
        </button>
      </div>
      {showAdvancedFilters ? (
        <div className="admin-product-filter-grid">
          <ProductFilterSelect
            label="Danh mục"
            value={categoryFilter}
            options={filterOptions.categories}
            onChange={onCategoryFilterChange}
          />
          <ProductFilterSelect
            label="Thương hiệu"
            value={brandFilter}
            options={filterOptions.brands}
            onChange={onBrandFilterChange}
          />
          <ProductFilterSelect
            label="Phom dáng"
            value={fitTypeFilter}
            options={filterOptions.fitTypes}
            onChange={onFitTypeFilterChange}
          />
          <select
            value={activeFilter}
            onChange={(event) => onActiveFilterChange(event.target.value as ProductActiveFilter)}
            aria-label="Trạng thái bán"
          >
            <option value="all">Trạng thái bán</option>
            <option value="active">Đang bán</option>
            <option value="inactive">Ngừng bán</option>
          </select>
        </div>
      ) : null}
    </div>
  )
}

function ProductFilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
      <option value="all">{label}</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  )
}
