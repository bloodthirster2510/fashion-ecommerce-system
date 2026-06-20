type Props = { variant: 'voucher' | 'tier' | 'customer' | 'rule' }

const symbols = { voucher: '%', tier: '★', customer: '◎', rule: 'ƒ' } as const

export function AdminEmptyIllustration({ variant }: Props) {
  return (
    <svg className="admin-empty-illustration" viewBox="0 0 120 80" aria-hidden="true">
      <path d="M18 22h84v42H18z" fill="#eef4f7" stroke="#b8cbd5" strokeWidth="2" />
      <path d="M28 34h34M28 44h22M72 52h20" stroke="#b8cbd5" strokeWidth="4" strokeLinecap="round" />
      <circle cx="84" cy="31" r="18" fill="#315f83" />
      <text x="84" y="38" fill="#fff" fontSize="22" fontWeight="800" textAnchor="middle">{symbols[variant]}</text>
    </svg>
  )
}
