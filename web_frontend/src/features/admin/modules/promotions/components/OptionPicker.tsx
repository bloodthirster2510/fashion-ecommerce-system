import { useEffect, useMemo, useState } from 'react'

export type PickerOption = {
  value: string
  label: string
  meta?: string
}

type OptionPickerProps = {
  title: string
  emptyLabel: string
  searchPlaceholder: string
  options: PickerOption[]
  selectedValues: string[]
  onChange: (values: string[]) => void
  onSearch?: (query: string) => void
  isSearching?: boolean
  totalCount?: number
  hasMore?: boolean
  onLoadMore?: () => void
  warning?: string
  onRetry?: () => void
}

const normalizeSearchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()

const formatPickerCount = (count: number, emptyLabel: string) =>
  count > 0 ? `Đã chọn ${count}` : emptyLabel

export function OptionPicker({
  title,
  emptyLabel,
  searchPlaceholder,
  options,
  selectedValues,
  onChange,
  onSearch,
  isSearching = false,
  totalCount,
  hasMore = false,
  onLoadMore,
  warning,
  onRetry,
}: OptionPickerProps) {
  const [query, setQuery] = useState('')
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues])
  const normalizedQuery = normalizeSearchText(query.trim())
  const filteredOptions = useMemo(
    () =>
      normalizedQuery
        ? options.filter((option) =>
            normalizeSearchText(`${option.label} ${option.meta ?? ''}`).includes(normalizedQuery),
          )
        : options,
    [normalizedQuery, options],
  )
  const selectedOptions = useMemo(
    () => options.filter((option) => selectedSet.has(option.value)),
    [options, selectedSet],
  )

  useEffect(() => {
    if (!onSearch) {
      return
    }

    const handle = window.setTimeout(() => onSearch(query.trim()), 320)
    return () => window.clearTimeout(handle)
  }, [onSearch, query])

  const toggleValue = (value: string) => {
    if (selectedSet.has(value)) {
      onChange(selectedValues.filter((selectedValue) => selectedValue !== value))
      return
    }

    onChange([...selectedValues, value])
  }

  const selectFilteredOptions = () => {
    onChange(Array.from(new Set([...selectedValues, ...filteredOptions.map((option) => option.value)])))
  }

  return (
    <section className="admin-option-picker">
      <header className="admin-option-picker-header">
        <div>
          <strong>{title}</strong>
          <span>
            {formatPickerCount(selectedValues.length, emptyLabel)} · {filteredOptions.length}/{totalCount ?? options.length} mục
          </span>
        </div>
        <div className="admin-option-picker-actions">
          {filteredOptions.length ? (
            <button className="admin-link-button" type="button" onClick={selectFilteredOptions}>Chọn kết quả</button>
          ) : null}
          {selectedValues.length ? (
            <button className="admin-link-button" type="button" onClick={() => onChange([])}>Bỏ chọn</button>
          ) : null}
        </div>
      </header>

      {selectedOptions.length ? (
        <div className="admin-option-chips" aria-label="Mục đã chọn">
          {selectedOptions.map((option) => (
            <button key={option.value} type="button" onClick={() => toggleValue(option.value)} title="Bấm để bỏ chọn">
              {option.label} ×
            </button>
          ))}
        </div>
      ) : null}

      {warning ? <div className="admin-option-warning" role="status"><span>{warning}</span>{onRetry ? <button className="admin-link-button" type="button" onClick={onRetry}>Thử lại</button> : null}</div> : null}

      {onSearch || options.length > 8 ? (
        <input
          className="admin-option-picker-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
        />
      ) : null}

      <div className="admin-option-list">
        {isSearching ? (
          <div className="admin-option-empty">Đang tìm sản phẩm...</div>
        ) : filteredOptions.length ? (
          <div className="admin-option-list-content">
            {filteredOptions.map((option) => (
                <label
                  key={option.value}
                  className="admin-option-item"
                >
                  <input
                    type="checkbox"
                    checked={selectedSet.has(option.value)}
                    onChange={() => toggleValue(option.value)}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    {option.meta ? <small>{option.meta}</small> : null}
                  </span>
                </label>
            ))}
          </div>
        ) : (
          <div className="admin-option-empty">Không có mục phù hợp</div>
        )}
      </div>

      {hasMore && onLoadMore ? (
        <button className="admin-option-load-more" type="button" disabled={isSearching} onClick={onLoadMore}>
          {isSearching ? 'Đang tải...' : 'Tải thêm'}
        </button>
      ) : null}
    </section>
  )
}
