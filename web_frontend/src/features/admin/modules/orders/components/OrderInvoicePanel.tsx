import { useEffect, useState } from 'react'
import { Copy, Download, Printer, ReceiptText } from 'lucide-react'
import { useToast } from '../../../notifications/notification-context'
import {
  fallbackStorefrontSettings,
  fetchStorefrontSettings,
  readCachedStorefrontSettings,
} from '../../../../storefront-settings/storefrontSettings.service'
import type { StorefrontSettings } from '../../../../storefront-settings/storefrontSettings.types'
import type { AdminOrder } from '../orderAdminApi'
import { formatCurrency, paymentMethodLabels, paymentStatusLabels } from '../orderPresentation'
import {
  downloadInvoicePdf,
  formatInvoiceDate,
  getInvoiceDeliveryAddress,
  getInvoiceDiscountTotal,
  getInvoiceIssuedAt,
  printInvoice,
} from '../utils/invoiceDocument'

export function OrderInvoicePanel({
  order,
  onCopyReference,
}: {
  order: AdminOrder
  onCopyReference: (value: string, label: string) => void
}) {
  const { showBottomToast } = useToast()
  const [settings, setSettings] = useState<StorefrontSettings>(() =>
    readCachedStorefrontSettings() ?? fallbackStorefrontSettings)
  const [downloading, setDownloading] = useState(false)
  const [failedAvatarUrl, setFailedAvatarUrl] = useState('')

  useEffect(() => {
    let active = true
    void fetchStorefrontSettings()
      .then((nextSettings) => {
        if (active) setSettings(nextSettings)
      })
      .catch(() => {
        if (active) showBottomToast('Không tải được cấu hình mới nhất; hóa đơn đang dùng thông tin cửa hàng dự phòng.', 'warning')
      })

    return () => { active = false }
  }, [showBottomToast])

  const totalDiscount = getInvoiceDiscountTotal(order)
  const issuedAt = getInvoiceIssuedAt(order)
  const avatarUrl = settings.identity.avatarUrl.trim()
  const showAvatar = Boolean(avatarUrl) && failedAvatarUrl !== avatarUrl

  const handlePrint = () => {
    try {
      printInvoice(order, settings)
      showBottomToast('Đã mở bản in hóa đơn.', 'success')
    } catch (error) {
      showBottomToast(error instanceof Error ? error.message : 'Không thể mở bản in hóa đơn.', 'error')
    }
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await downloadInvoicePdf(order, settings)
      showBottomToast('Đã tải tệp PDF hóa đơn.', 'success')
    } catch (error) {
      showBottomToast(error instanceof Error ? error.message : 'Không thể tạo tệp PDF hóa đơn.', 'error')
    } finally {
      setDownloading(false)
    }
  }

  if (!order.invoiceCode) {
    return (
      <section className="admin-drawer-section admin-order-section-summary admin-order-invoice-empty">
        <ReceiptText aria-hidden="true" />
        <div>
          <h3>Hóa đơn chưa được phát hành</h3>
          <p>Hệ thống phát hành mã và chứng từ hóa đơn khi thanh toán thành công (COD được ghi nhận khi giao hàng).</p>
        </div>
      </section>
    )
  }

  return (
    <section className="admin-order-invoice-panel admin-order-section-summary">
      <header className="admin-order-invoice-actions">
        <div>
          <span>Chứng từ bán hàng</span>
          <strong>{order.invoiceCode}</strong>
        </div>
        <div>
          <button className="admin-secondary-button" type="button" onClick={handlePrint}>
            <Printer size={16} aria-hidden="true" />
            In hóa đơn
          </button>
          <button className="admin-primary-button" type="button" disabled={downloading} onClick={() => void handleDownload()}>
            <Download size={16} aria-hidden="true" />
            {downloading ? 'Đang tạo PDF...' : 'Tải PDF'}
          </button>
        </div>
      </header>

      <article className="admin-order-invoice-sheet">
        <header className="admin-order-invoice-heading">
          <div className="admin-order-invoice-seller">
            <span className="admin-order-invoice-logo" aria-hidden="true">
              {showAvatar ? (
                <img
                  src={avatarUrl}
                  alt=""
                  onError={() => setFailedAvatarUrl(avatarUrl)}
                />
              ) : settings.identity.name.trim().slice(0, 2).toLocaleUpperCase('vi-VN') || 'FS'}
            </span>
            <div>
              <h3>{settings.identity.name}</h3>
              <strong>{settings.identity.legalName || settings.identity.name}</strong>
              {settings.identity.taxCode ? <span>Mã số thuế: {settings.identity.taxCode}</span> : null}
              {settings.contact.address ? <span>{settings.contact.address}</span> : null}
              <span>{[settings.contact.phone, settings.contact.email].filter(Boolean).join(' · ')}</span>
            </div>
          </div>
          <div className="admin-order-invoice-title">
            <span>HÓA ĐƠN BÁN HÀNG</span>
            <strong className="admin-code-with-copy">
              {order.invoiceCode}
              <button
                className="admin-copy-button"
                type="button"
                onClick={() => onCopyReference(order.invoiceCode ?? '', 'mã hóa đơn')}
                aria-label="Sao chép mã hóa đơn"
              >
                <Copy size={14} aria-hidden="true" />
              </button>
            </strong>
            <small>Phát hành {formatInvoiceDate(issuedAt)}</small>
          </div>
        </header>

        <div className="admin-order-invoice-parties">
          <section>
            <span>NGƯỜI MUA / NGƯỜI NHẬN</span>
            <strong>{order.shippingAddress.customerName}</strong>
            <p>{order.shippingAddress.phoneNumber}</p>
            <p>{getInvoiceDeliveryAddress(order)}</p>
          </section>
          <dl>
            <div><dt>Mã đơn</dt><dd>{order.orderCode}</dd></div>
            <div><dt>Thanh toán</dt><dd>{paymentMethodLabels[order.paymentMethod]}</dd></div>
            <div><dt>Trạng thái</dt><dd>{paymentStatusLabels[order.paymentStatus]}</dd></div>
          </dl>
        </div>

        <div className="admin-order-invoice-table-wrap">
          <table className="admin-order-invoice-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Sản phẩm</th>
                <th>SL</th>
                <th>Đơn giá</th>
                <th>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {order.order_list.map((item, index) => (
                <tr key={item._id ?? item.sku}>
                  <td>{index + 1}</td>
                  <td>
                    <strong>{item.name}</strong>
                    <span>{item.color} / {item.size} / {item.fitType}</span>
                  </td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(item.priceAtPurchased)}</td>
                  <td><strong>{formatCurrency(item.quantity * item.priceAtPurchased)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="admin-order-invoice-summary">
          <div className="admin-order-invoice-note">
            {order.orderNote ? <><strong>GHI CHÚ ĐƠN HÀNG</strong><p>{order.orderNote}</p></> : null}
          </div>
          <dl>
            <div><dt>Tiền hàng</dt><dd>{formatCurrency(order.subTotal)}</dd></div>
            {totalDiscount > 0 ? <div className="is-discount"><dt>Tổng ưu đãi</dt><dd>-{formatCurrency(totalDiscount)}</dd></div> : null}
            <div><dt>Phí vận chuyển</dt><dd>{formatCurrency(order.shippingFee)}</dd></div>
            {order.taxAmount > 0 ? <div><dt>Thuế</dt><dd>{formatCurrency(order.taxAmount)}</dd></div> : null}
            <div className="is-total"><dt>Tổng thanh toán</dt><dd>{formatCurrency(order.totalAmount)}</dd></div>
          </dl>
        </div>

        <footer>
          Chứng từ bán hàng nội bộ, không thay thế hóa đơn điện tử hoặc hóa đơn VAT theo quy định pháp luật.
        </footer>
      </article>
    </section>
  )
}
