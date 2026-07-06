import type { ReactNode } from 'react'

export type TabItem<T extends string> = {
  value: T
  label: string
  badge?: ReactNode
}

type TabsProps<T extends string> = {
  items: Array<TabItem<T>>
  value: T
  onChange: (value: T) => void
  ariaLabel: string
}

export function Tabs<T extends string>({ items, value, onChange, ariaLabel }: TabsProps<T>) {
  return (
    <div className="admin-ui-tabs" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          className={item.value === value ? 'is-active' : undefined}
          onClick={() => onChange(item.value)}
        >
          <span>{item.label}</span>
          {item.badge ? <em>{item.badge}</em> : null}
        </button>
      ))}
    </div>
  )
}
