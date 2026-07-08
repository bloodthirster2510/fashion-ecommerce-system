export function FilterSelect({
  value,
  onChange,
  label,
  options,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  options: string[]
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
      <option value="all">{label}</option>
      {options.map((option) => <option value={option} key={option}>{option}</option>)}
    </select>
  )
}

export function EmptyRow({ label }: { label: string }) {
  return <tr><td colSpan={6}><div className="admin-table-loading">{label}</div></td></tr>
}

export function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 20-4.6-4.6a7 7 0 1 0-1.4 1.4l4.6 4.6L21 20ZM5 10.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z" /></svg>
}

export function ViewIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="admin-action-icon"><path d="M12 5C6.5 5 2 9 1 12c1 3 5.5 7 11 7s10-4 11-7c-1-3-5.5-7-11-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z" /></svg>
}

export function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg className={expanded ? 'is-expanded' : ''} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 5 7 7-7 7" />
    </svg>
  )
}

export function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 1.8 21h20.4L12 3Zm-1 6h2v6h-2V9Zm0 8h2v2h-2v-2Z" />
    </svg>
  )
}
