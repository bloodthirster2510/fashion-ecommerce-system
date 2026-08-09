import { Button, Checkbox, InputNumber, Select } from 'antd'
import { FilterOutlined, ReloadOutlined, SortAscendingOutlined } from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import type { ProductListFilters, ProductListQuery, ProductSortOption } from '../catalog.types'

type SortOption = {
  value: ProductSortOption
  label: string
}

type FitTypeOption = {
  value: string
  label: string
  ids: string[]
}

type CatalogToolbarProps = {
  query: ProductListQuery
  filters?: ProductListFilters
  fitTypeLabelById: Map<string, string>
  sortOptions: SortOption[]
  selectedSort: SortOption
  onQueryValueChange: <K extends keyof ProductListQuery>(key: K, value: ProductListQuery[K]) => void
  onQueryChange: (updates: Partial<ProductListQuery>) => void
  onClearFilters: () => void
}

type PriceDraft = {
  minPrice?: number
  maxPrice?: number
}

const PRICE_FILTER_DEBOUNCE_MS = 400

// Toolbar chỉ chọn một giá trị cho các filter đang hiển thị dạng Select đơn.
const getSingleValue = (values?: string[]) => values?.[0]

const getFitTypeOptionKey = (label: string) => label.trim().toLowerCase()

const buildFitTypeOptions = (fitTypeIds: string[] = [], fitTypeLabelById: Map<string, string>): FitTypeOption[] => {
  const optionsByLabel = new Map<string, FitTypeOption>()

  fitTypeIds.forEach((fitTypeId) => {
    const label = fitTypeLabelById.get(fitTypeId)?.trim() || fitTypeId.slice(-6)
    const value = getFitTypeOptionKey(label)
    const option = optionsByLabel.get(value)

    if (option) {
      option.ids.push(fitTypeId)
      return
    }

    optionsByLabel.set(value, { value, label, ids: [fitTypeId] })
  })

  return Array.from(optionsByLabel.values())
}

const getSelectedFitTypeValue = (selectedIds: string[] | undefined, options: FitTypeOption[]) => {
  const selectedId = getSingleValue(selectedIds)
  if (!selectedId) return undefined
  return options.find((option) => option.ids.includes(selectedId))?.value
}

// Thanh lọc/sắp xếp sản phẩm, đồng thời chứa nút tìm kiếm bằng hình ảnh.
export function CatalogToolbar({
  query,
  filters,
  fitTypeLabelById,
  sortOptions,
  selectedSort,
  onQueryValueChange,
  onQueryChange,
  onClearFilters,
}: CatalogToolbarProps) {
  const fitTypeOptions = useMemo(
    () => buildFitTypeOptions(filters?.fitTypes, fitTypeLabelById),
    [filters?.fitTypes, fitTypeLabelById],
  )
  const [priceDraft, setPriceDraft] = useState<PriceDraft>({
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
  })

  useEffect(() => {
    setPriceDraft({ minPrice: query.minPrice, maxPrice: query.maxPrice })
  }, [query.minPrice, query.maxPrice])

  useEffect(() => {
    if (priceDraft.minPrice === query.minPrice && priceDraft.maxPrice === query.maxPrice) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      onQueryChange({
        minPrice: priceDraft.minPrice,
        maxPrice: priceDraft.maxPrice,
      })
    }, PRICE_FILTER_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [onQueryChange, priceDraft.maxPrice, priceDraft.minPrice, query.maxPrice, query.minPrice])

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
              value={getSelectedFitTypeValue(query.fitType, fitTypeOptions)}
              placeholder="Tất cả"
              allowClear
              options={fitTypeOptions.map((option) => ({ value: option.value, label: option.label }))}
              onChange={(value) => {
                const option = fitTypeOptions.find((item) => item.value === value)
                onQueryValueChange('fitType', option?.ids)
              }}
            />
          </label>
        </div>

        <div className="catalog-secondary-controls">
          <InputNumber
            min={0}
            value={priceDraft.minPrice}
            placeholder="Giá từ"
            controls={false}
            onChange={(value) => setPriceDraft((current) => ({ ...current, minPrice: value ?? undefined }))}
          />
          <InputNumber
            min={0}
            value={priceDraft.maxPrice}
            placeholder="Giá đến"
            controls={false}
            onChange={(value) => setPriceDraft((current) => ({ ...current, maxPrice: value ?? undefined }))}
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
