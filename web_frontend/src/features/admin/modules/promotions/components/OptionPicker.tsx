import { useMemo, useState } from 'react'

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

      {options.length > 8 ? (
        <input
          className="admin-option-picker-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
        />
      ) : null}

      <div className="admin-option-list">
        {filteredOptions.length ? (
          filteredOptions.map((option) => (
            <label key={option.value} className="admin-option-item">
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
          ))
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
