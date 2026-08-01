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
    <section className="admin-order-payment-scope" aria-label="Kênh thanh toán của đơn">
      <span className="admin-order-payment-scope-label">Kênh thanh toán đơn</span>
      <div className="admin-order-payment-sections" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activePaymentSectionKey === 'all'}
          className={`admin-order-payment-section${activePaymentSectionKey === 'all' ? ' is-active' : ''}`}
          onClick={() => navigateToOrderSection('all', activeTabKey)}
        >
          Mọi kênh
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
    </section>
  )
}
