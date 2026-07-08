export function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg className={expanded ? 'is-expanded' : ''} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 5 7 7-7 7" />
    </svg>
  )
}

export function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m21 20-4.6-4.6a7 7 0 1 0-1.4 1.4l4.6 4.6L21 20ZM5 10.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z" />
    </svg>
  )
}

export function StockDetailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5h16v14H4V5Zm2 2v3h5V7H6Zm7 0v3h5V7h-5Zm-7 5v5h5v-5H6Zm7 0v5h5v-5h-5Z" />
    </svg>
  )
}

export function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="admin-action-icon">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z" />
    </svg>
  )
}

export function ViewIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="admin-action-icon">
      <path d="M12 5C6.5 5 2 9 1 12c1 3 5.5 7 11 7s10-4 11-7c-1-3-5.5-7-11-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
    </svg>
  )
}

export function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="admin-action-icon">
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12Zm3-9h6v8H9v-8Zm6.5-6-1-1h-5l-1 1H5v2h14V4h-3.5Z" />
    </svg>
  )
}
