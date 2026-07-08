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
}

export function ProductFilters({
  keyword,
  categoryFilter,
  brandFilter,
  fitTypeFilter,
  activeFilter,
  stockFilter,
  filterOptions,
  onKeywordChange,
  onCategoryFilterChange,
  onBrandFilterChange,
  onFitTypeFilterChange,
  onActiveFilterChange,
  onStockFilterChange,
}: ProductFiltersProps) {
  const resetFilters = () => {
    onKeywordChange('')
    onCategoryFilterChange('all')
    onBrandFilterChange('all')
    onFitTypeFilterChange('all')
    onActiveFilterChange('all')
    onStockFilterChange('all')
  }

  return (
    <div className="admin-product-toolbar">
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
          label="Fit type"
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
        <select
          value={stockFilter}
          onChange={(event) => onStockFilterChange(event.target.value as ProductStockFilter)}
          aria-label="Trạng thái kho"
        >
          <option value="all">Trạng thái kho</option>
          <option value="available">Còn hàng</option>
          <option value="low">Sắp hết</option>
          <option value="out">Hết hàng</option>
        </select>
        <button className="admin-secondary-button" type="button" onClick={resetFilters}>
          Đặt lại
        </button>
      </div>
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
