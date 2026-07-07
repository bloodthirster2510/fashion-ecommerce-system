import { Button, PageHeader } from '../../../components/ui'

type OrdersPageHeaderProps = {
  title: string
  description: string
  isLookupMode: boolean
  canExpirePayments: boolean
  isActionLoading: boolean
  onExpireStalePayments: () => void | Promise<void>
  onRefresh: () => void | Promise<void>
}

export function OrdersPageHeader({
  title,
  description,
  isLookupMode,
  canExpirePayments,
  isActionLoading,
  onExpireStalePayments,
  onRefresh,
}: OrdersPageHeaderProps) {
  return (
    <PageHeader
      title={title}
      description={description}
      breadcrumbs={isLookupMode ? ['Bán hàng', 'Tra cứu đơn hàng'] : ['Bán hàng', 'Vận hành đơn hàng']}
      actions={(
        <>
          {!isLookupMode ? (
            <Button
              variant="secondary"
              disabled={!canExpirePayments || isActionLoading}
              onClick={() => void onExpireStalePayments()}
            >
              Xử lý thanh toán quá hạn
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => void onRefresh()}>
            Tải lại
          </Button>
        </>
      )}
    />
  )
}
