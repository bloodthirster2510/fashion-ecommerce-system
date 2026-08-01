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
  const activeTab = orderTabs.find((tab) => tab.key === activeTabKey) ?? orderTabs[0]
  const normalizedStatusSummary = { ...emptyStatusSummary, ...statusSummary }
  const normalizedOperationalSummary = { ...emptyOperationalSummary, ...operationalSummary }
  const activeCount = getTabCount(activeTab, normalizedStatusSummary, normalizedOperationalSummary)

  return (
    <section className="admin-order-queue-board" aria-label="Hàng đợi công việc">
      <header className="admin-order-queue-heading">
        <div>
          <span>Hàng đợi đang xem</span>
          <strong>{activeTab.label}</strong>
          {activeTab.helper ? <p>{activeTab.helper}</p> : null}
        </div>
        <span className="admin-order-active-count"><strong>{activeCount}</strong> đơn</span>
      </header>

      <div className="admin-order-tab-groups" role="tablist" aria-label="Phân loại đơn hàng">
        {orderTabGroups.map((group) => {
          const tabs = orderTabs.filter((tab) => tab.group === group.key)

          return (
            <section className={`admin-order-tab-group is-${group.key}`} key={group.key}>
              <span className="admin-order-tab-group-label">{group.label}</span>
              <div className="admin-order-tabs">
                {tabs.map((tab) => {
                  const tabCount = getTabCount(tab, normalizedStatusSummary, normalizedOperationalSummary)

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
    </section>
  )
}
