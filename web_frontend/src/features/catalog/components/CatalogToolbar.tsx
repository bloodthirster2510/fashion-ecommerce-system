import { Button, Checkbox, InputNumber, Select } from 'antd'
import { FilterOutlined, ReloadOutlined, SortAscendingOutlined } from '@ant-design/icons'
import type { ProductListQuery, ProductListResponse, ProductSortOption } from '../catalog.types'

type SortOption = {
  value: ProductSortOption
  label: string
}

type CatalogToolbarProps = {
  query: ProductListQuery
  filters?: ProductListResponse['filters']
  fitTypeLabelById: Map<string, string>
  sortOptions: SortOption[]
  selectedSort: SortOption
  onQueryValueChange: <K extends keyof ProductListQuery>(key: K, value: ProductListQuery[K]) => void
  onClearFilters: () => void
}

const getSingleValue = (values?: string[]) => values?.[0]

export function CatalogToolbar({
  query,
  filters,
  fitTypeLabelById,
  sortOptions,
  selectedSort,
  onQueryValueChange,
  onClearFilters,
}: CatalogToolbarProps) {
  return (
    <div className="catalog-toolbar">
      <section className="catalog-filter-panel" aria-labelledby="catalog-filter-title">
        <div className="catalog-section-title" id="catalog-filter-title">
          <FilterOutlined aria-hidden="true" />
          <span>Bộ lọc sản phẩm</span>
        </div>

        <div className="catalog-controls">
          <label>
            <span>Kiểu sản phẩm</span>
            <Select
              value={query.categoryId}
              placeholder="Tất cả"
              allowClear
              options={filters?.categories.map((category) => ({ value: category._id, label: category.name })) ?? []}
              onChange={(value) => onQueryValueChange('categoryId', value)}
            />
          </label>

          <label>
            <span>Nhãn hiệu</span>
            <Select
              value={query.brandId}
              placeholder="Tất cả"
              allowClear
              options={filters?.brands.map((brand) => ({ value: brand._id, label: brand.name })) ?? []}
              onChange={(value) => onQueryValueChange('brandId', value)}
            />
          </label>

          <label>
            <span>Màu sắc</span>
            <Select
              value={getSingleValue(query.color)}
              placeholder="Tất cả"
              allowClear
              options={filters?.colors.map((color) => ({ value: color, label: color })) ?? []}
              onChange={(value) => onQueryValueChange('color', value ? [value] : undefined)}
            />
          </label>

          <label>
            <span>Form dáng</span>
            <Select
              value={getSingleValue(query.fitType)}
              placeholder="Tất cả"
              allowClear
              options={
                filters?.fitTypes.map((fitTypeId) => ({
                  value: fitTypeId,
                  label: fitTypeLabelById.get(fitTypeId) ?? fitTypeId.slice(-6),
                })) ?? []
              }
              onChange={(value) => onQueryValueChange('fitType', value ? [value] : undefined)}
            />
          </label>
        </div>

        <div className="catalog-secondary-controls">
          <InputNumber
            min={0}
            value={query.minPrice}
            placeholder="Giá từ"
            controls={false}
            onChange={(value) => onQueryValueChange('minPrice', value ?? undefined)}
          />
          <InputNumber
            min={0}
            value={query.maxPrice}
            placeholder="Giá đến"
            controls={false}
            onChange={(value) => onQueryValueChange('maxPrice', value ?? undefined)}
          />
          <Checkbox checked={Boolean(query.isNew)} onChange={(event) => onQueryValueChange('isNew', event.target.checked)}>
            Hàng mới
          </Checkbox>
          <Checkbox checked={Boolean(query.isSale)} onChange={(event) => onQueryValueChange('isSale', event.target.checked)}>
            Sale
          </Checkbox>
          <Button icon={<ReloadOutlined />} onClick={onClearFilters}>
            Xóa lọc
          </Button>
        </div>
      </section>

      <section className="catalog-sort-panel" aria-label="Sắp xếp sản phẩm">
        <div className="catalog-section-title catalog-sort-title">
          <SortAscendingOutlined aria-hidden="true" />
          <span>Sắp xếp</span>
        </div>

        <label className="sort-field">
          <span>Sắp xếp theo</span>
          <Select
            value={selectedSort.value}
            options={sortOptions}
            onChange={(value) => onQueryValueChange('sort', value)}
          />
        </label>
      </section>
    </div>
  )
}
