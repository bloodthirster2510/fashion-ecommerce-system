import type { AdminOrderStatus } from '../orderAdminApi'
import type { OrderTab } from '../orderTypes'
import {
  emptyOperationalSummary,
  emptyStatusSummary,
  getTabClass,
  orderTabGroups,
  orderTabs,
} from '../orderPresentation'
import { getTabCount } from '../utils/orderQueue'

type OperationalSummary = typeof emptyOperationalSummary

type OrderQueueTabsProps = {
  activeTabKey: string
  statusSummary: Record<AdminOrderStatus | 'all', number>
  operationalSummary: OperationalSummary
  onSelectTab: (tab: OrderTab) => void
}

export function OrderQueueTabs({
  activeTabKey,
  statusSummary,
  operationalSummary,
  onSelectTab,
}: OrderQueueTabsProps) {
  return (
    <div className="admin-order-tab-groups" role="tablist" aria-label="Phân loại đơn hàng">
      {orderTabGroups.map((group) => {
        const tabs = orderTabs.filter((tab) => tab.group === group.key)

        return (
          <section className={`admin-order-tab-group is-${group.key}`} key={group.key}>
            <span className="admin-order-tab-group-label">{group.label}</span>
            <div className="admin-order-tabs">
              {tabs.map((tab) => {
                const tabCount = getTabCount(tab, { ...emptyStatusSummary, ...statusSummary }, { ...emptyOperationalSummary, ...operationalSummary })

                return (
                  <button
                    className={getTabClass(tab, activeTabKey)}
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={tab.key === activeTabKey}
                    onClick={() => onSelectTab(tab)}
                  >
                    <span className="admin-order-tab-label">
                      <span>{tab.label}</span>
                      <span className="admin-order-tab-count" aria-label={`${tabCount} đơn`}>
                        {tabCount}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
