import type { PaymentSectionKey } from '../orderTypes'
import { paymentSections } from '../orderPresentation'
import { navigateToOrderSection } from '../../../services/adminNavigation'

type OrderPaymentSectionTabsProps = {
  activePaymentSectionKey: PaymentSectionKey
  activeTabKey?: string
}

export function OrderPaymentSectionTabs({
  activePaymentSectionKey,
  activeTabKey,
}: OrderPaymentSectionTabsProps) {
  const operationalSections = paymentSections.filter((section) => section.key !== 'all')
  return (
    <div className="admin-order-payment-sections" role="tablist" aria-label="Phương thức thanh toán">
      <button
        type="button"
        role="tab"
        aria-selected={activePaymentSectionKey === 'all'}
        className={`admin-order-payment-section${activePaymentSectionKey === 'all' ? ' is-active' : ''}`}
        onClick={() => navigateToOrderSection('all', activeTabKey)}
      >
        Tất cả đơn
      </button>
      {operationalSections.map((section) => (
        <button
          key={section.key}
          type="button"
          role="tab"
          aria-selected={activePaymentSectionKey === section.key}
          className={`admin-order-payment-section is-${section.key}${activePaymentSectionKey === section.key ? ' is-active' : ''}`}
          onClick={() => navigateToOrderSection(section.key, activeTabKey)}
        >
          {section.label}
        </button>
      ))}
    </div>
  )
}