import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

export type CommandMenuItem = {
  key: string
  label: string
  description?: string
  group?: string
  disabled?: boolean
  onSelect: () => void
}

type CommandMenuProps = {
  isOpen: boolean
  items: CommandMenuItem[]
  onClose: () => void
}

const normalizeSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

export function CommandMenu({ isOpen, items, onClose }: CommandMenuProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const visibleItems = useMemo(() => {
    const normalizedQuery = normalizeSearch(query.trim())

    return items.filter((item) => {
      if (!normalizedQuery) return true

      return normalizeSearch(`${item.label} ${item.description ?? ''} ${item.group ?? ''}`)
        .includes(normalizedQuery)
    })
  }, [items, query])

  const selectItem = (item?: CommandMenuItem) => {
    if (!item || item.disabled) return
    item.onSelect()
    onClose()
  }

  const moveActiveIndex = (step: number) => {
    if (!visibleItems.length) return
    setActiveIndex((current) => {
      let next = current
      for (let attempt = 0; attempt < visibleItems.length; attempt += 1) {
        next = (next + step + visibleItems.length) % visibleItems.length
        if (!visibleItems[next]?.disabled) return next
      }
      return current
    })
  }

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveActiveIndex(1)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveActiveIndex(-1)
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(Math.max(0, visibleItems.length - 1))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      selectItem(visibleItems[activeIndex])
    }
  }

  useEffect(() => {
    if (!isOpen) return

    setQuery('')
    setActiveIndex(0)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }, [isOpen])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    if (!visibleItems.length) {
      setActiveIndex(0)
      return
    }

    setActiveIndex((index) => Math.min(index, visibleItems.length - 1))
  }, [visibleItems.length])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="admin-ui-command-layer"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section className="admin-ui-command-menu" role="dialog" aria-modal="true" aria-label="Tìm kiếm nhanh">
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder="Tìm trang hoặc thao tác nhanh"
          aria-controls="admin-command-list"
          aria-activedescendant={visibleItems[activeIndex] ? `admin-command-${visibleItems[activeIndex].key}` : undefined}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleInputKeyDown}
        />

        <div id="admin-command-list" className="admin-ui-command-list" role="listbox">
          {visibleItems.length ? visibleItems.map((item, index) => (
            <button
              id={`admin-command-${item.key}`}
              key={item.key}
              type="button"
              disabled={item.disabled}
              role="option"
              aria-selected={index === activeIndex}
              className={index === activeIndex ? 'is-active' : undefined}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectItem(item)}
            >
              <span>
                <strong>{item.label}</strong>
                {item.description ? <small>{item.description}</small> : null}
              </span>
              {item.group ? <em>{item.group}</em> : null}
            </button>
          )) : (
            <p>Không có kết quả phù hợp.</p>
          )}
        </div>
      </section>
    </div>
  )
}
