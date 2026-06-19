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

const virtualizeThreshold = 40
const optionRowHeight = 48
const optionViewportHeight = 196
const optionOverscan = 3

export function OptionPicker({
  title,
  emptyLabel,
  searchPlaceholder,
  options,
  selectedValues,
  onChange,
  onSearch,
  isSearching = false,
}: OptionPickerProps) {
  const [query, setQuery] = useState('')
  const [scrollTop, setScrollTop] = useState(0)
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
  const shouldVirtualize = filteredOptions.length > virtualizeThreshold
  const virtualStartIndex = shouldVirtualize
    ? Math.max(0, Math.floor(scrollTop / optionRowHeight) - optionOverscan)
    : 0
  const virtualEndIndex = shouldVirtualize
    ? Math.min(
        filteredOptions.length,
        virtualStartIndex + Math.ceil(optionViewportHeight / optionRowHeight) + optionOverscan * 2,
      )
    : filteredOptions.length
  const visibleOptions = filteredOptions.slice(virtualStartIndex, virtualEndIndex)

  useEffect(() => {
    if (!onSearch) {
      return
    }

    const handle = window.setTimeout(() => onSearch(query.trim()), 320)
    return () => window.clearTimeout(handle)
  }, [onSearch, query])

  useEffect(() => {
    setScrollTop(0)
  }, [normalizedQuery, options])

  const toggleValue = (value: string) => {
    if (selectedSet.has(value)) {
      onChange(selectedValues.filter((selectedValue) => selectedValue !== value))
      return
    }

    onChange([...selectedValues, value])
  }

  return (
    <section className="admin-option-picker">
      <header className="admin-option-picker-header">
        <div>
          <strong>{title}</strong>
          <span>{formatPickerCount(selectedValues.length, emptyLabel)}</span>
        </div>
        {selectedValues.length ? (
          <button className="admin-link-button" type="button" onClick={() => onChange([])}>
            Bỏ chọn
          </button>
        ) : null}
      </header>

      {onSearch || options.length > 8 ? (
        <input
          className="admin-option-picker-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
        />
      ) : null}

      <div
        className={`admin-option-list${shouldVirtualize ? ' is-virtualized' : ''}`}
        onScroll={shouldVirtualize ? (event) => setScrollTop(event.currentTarget.scrollTop) : undefined}
      >
        {isSearching ? (
          <div className="admin-option-empty">Đang tìm sản phẩm...</div>
        ) : filteredOptions.length ? (
          <div
            className="admin-option-list-content"
            style={shouldVirtualize ? { height: filteredOptions.length * optionRowHeight } : undefined}
          >
            {visibleOptions.map((option, visibleIndex) => {
              const optionIndex = virtualStartIndex + visibleIndex
              return (
                <label
                  key={option.value}
                  className="admin-option-item"
                  style={shouldVirtualize ? { transform: `translateY(${optionIndex * optionRowHeight}px)` } : undefined}
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
              )
            })}
          </div>
        ) : (
          <div className="admin-option-empty">Không có mục phù hợp</div>
        )}
      </div>

      {selectedOptions.length ? (
        <div className="admin-option-chips">
          {selectedOptions.map((option) => (
            <button key={option.value} type="button" onClick={() => toggleValue(option.value)}>
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}
