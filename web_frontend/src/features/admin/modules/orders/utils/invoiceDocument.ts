import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces'
import type { StorefrontSettings } from '../../../../storefront-settings/storefrontSettings.types'
import { formatCurrency, paymentMethodLabels, paymentStatusLabels } from '../orderPresentation'

export type InvoiceOrder = {
  _id: string
  orderCode: string
  invoiceCode?: string | null
  invoiceIssuedAt?: string | null
  order_list: Array<{
    _id?: string
    sku: string
    name: string
    fitType: string
    color: string
    size: string
    quantity: number
    priceAtPurchased: number
  }>
  subTotal: number
  shippingFee: number
  couponCode?: string | null
  couponDiscountAmount: number
  shippingDiscountAmount: number
  membershipDiscountAmount: number
  taxAmount: number
  totalAmount: number
  status: 'confirmed' | 'packed' | 'shipping' | 'delivered' | 'completed' | 'cancelled' | 'return_requested' | 'return_approved' | 'returned'
  paymentMethod: 'COD' | 'VNPAY' | 'MOMO' | 'CARD' | 'BANK'
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded'
  deliveredAt?: string | null
  receivedAt?: string | null
  shippingAddress: {
    customerName: string
    district?: string | null
    province: string
    streetName: string
    phoneNumber: string
    ward: string
  }
  orderNote?: string | null
  updatedAt: string
}

const invoiceDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const safeDate = (value?: string | null) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export const getInvoiceIssuedAt = (order: InvoiceOrder) =>
  order.invoiceIssuedAt
  ?? order.deliveredAt
  ?? order.receivedAt
  ?? order.updatedAt

export const formatInvoiceDate = (value?: string | null) => {
  const date = safeDate(value)
  return date ? invoiceDateFormatter.format(date) : 'Chưa có'
}

export const getInvoiceDiscountTotal = (order: InvoiceOrder) =>
  order.couponDiscountAmount
  + order.shippingDiscountAmount
  + order.membershipDiscountAmount

export const getInvoiceDeliveryAddress = (order: InvoiceOrder) => [
  order.shippingAddress.streetName,
  order.shippingAddress.ward,
  order.shippingAddress.district,
  order.shippingAddress.province,
].filter(Boolean).join(', ')

export const getInvoiceFileName = (order: InvoiceOrder) => {
  const reference = order.invoiceCode || order.orderCode || 'invoice'
  return `${reference.replace(/[^A-Za-z0-9_-]+/g, '-')}.pdf`
}

const buildSellerLines = (settings: StorefrontSettings) => [
  settings.identity.legalName || settings.identity.name,
  settings.identity.taxCode ? `Mã số thuế: ${settings.identity.taxCode}` : null,
  settings.contact.address || null,
  [settings.contact.phone, settings.contact.email].filter(Boolean).join(' · ') || null,
].filter((value): value is string => Boolean(value))

const buildInvoiceTotals = (order: InvoiceOrder): Array<{ label: string; value: number; tone?: 'discount' | 'total' }> => [
  { label: 'Tiền hàng', value: order.subTotal },
  ...(order.couponDiscountAmount > 0
    ? [{ label: `Voucher giảm giá${order.couponCode ? ` (${order.couponCode})` : ''}`, value: -order.couponDiscountAmount, tone: 'discount' as const }]
    : []),
  ...(order.membershipDiscountAmount > 0
    ? [{ label: 'Ưu đãi thành viên', value: -order.membershipDiscountAmount, tone: 'discount' as const }]
    : []),
  { label: 'Phí vận chuyển', value: order.shippingFee },
  ...(order.shippingDiscountAmount > 0
    ? [{ label: 'Giảm phí vận chuyển', value: -order.shippingDiscountAmount, tone: 'discount' as const }]
    : []),
  ...(order.taxAmount > 0 ? [{ label: 'Thuế', value: order.taxAmount }] : []),
  { label: 'Tổng thanh toán', value: order.totalAmount, tone: 'total' },
]

const toPdfText = (value: string, options: Partial<TableCell> = {}): TableCell => ({
  text: value,
  ...options,
}) as TableCell

export const buildInvoicePdfDefinition = (
  order: InvoiceOrder,
  settings: StorefrontSettings,
  avatarDataUrl?: string | null,
): TDocumentDefinitions => {
  const sellerLines = buildSellerLines(settings)
  const sellerDetails: Content[] = [
    { text: settings.identity.name, style: 'storeName' },
    ...sellerLines.map((line) => ({ text: line, style: 'mutedLine' })),
  ]
  const sellerHeader: Content = avatarDataUrl
    ? {
        columns: [
          { width: 48, image: avatarDataUrl, fit: [48, 48] },
          { width: '*', stack: sellerDetails },
        ],
        columnGap: 10,
      }
    : { stack: sellerDetails }
  const itemRows: TableCell[][] = order.order_list.map((item, index) => [
    toPdfText(String(index + 1), { alignment: 'center' }),
    {
      stack: [
        { text: item.name, bold: true },
        { text: `${item.color} / ${item.size} / ${item.fitType}`, color: '#5f5f5f', fontSize: 8 },
      ],
    },
    toPdfText(String(item.quantity), { alignment: 'right' }),
    toPdfText(formatCurrency(item.priceAtPurchased), { alignment: 'right' }),
    toPdfText(formatCurrency(item.quantity * item.priceAtPurchased), { alignment: 'right', bold: true }),
  ])
  const totals = buildInvoiceTotals(order)
  const totalRows: TableCell[][] = totals.map((row) => [
    toPdfText(row.label, {
      bold: row.tone === 'total',
      color: row.tone === 'discount' ? '#3f3f3f' : row.tone === 'total' ? '#000000' : '#303030',
    }),
    toPdfText(formatCurrency(row.value), {
      alignment: 'right',
      bold: row.tone === 'total',
      color: row.tone === 'discount' ? '#3f3f3f' : row.tone === 'total' ? '#000000' : '#303030',
      fontSize: row.tone === 'total' ? 12 : 9,
    }),
  ])
  const noteContent: Content[] = order.orderNote
    ? [
        { text: 'GHI CHÚ ĐƠN HÀNG', style: 'sectionLabel', margin: [0, 0, 0, 5] },
        { text: order.orderNote, color: '#454545' },
      ]
    : []

  const content: Content[] = [
    {
      columns: [
        {
          width: '*',
          stack: [sellerHeader],
        },
        {
          width: 210,
          alignment: 'right',
          stack: [
            { text: 'HÓA ĐƠN BÁN HÀNG', style: 'invoiceTitle' },
            { text: order.invoiceCode || 'CHƯA PHÁT HÀNH', style: 'invoiceCode' },
            { text: `Phát hành: ${formatInvoiceDate(getInvoiceIssuedAt(order))}`, style: 'mutedLine' },
          ],
        },
      ],
      columnGap: 24,
    },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#bdbdbd' }], margin: [0, 16, 0, 16] },
    {
      columns: [
        {
          width: '*',
          stack: [
            { text: 'NGƯỜI MUA / NGƯỜI NHẬN', style: 'sectionLabel' },
            { text: order.shippingAddress.customerName, bold: true, fontSize: 11, margin: [0, 5, 0, 2] },
            { text: order.shippingAddress.phoneNumber, style: 'mutedLine' },
            { text: getInvoiceDeliveryAddress(order), style: 'mutedLine' },
          ],
        },
        {
          width: 210,
          table: {
            widths: [85, '*'],
            body: [
              ['Mã đơn', order.orderCode],
              ['Thanh toán', paymentMethodLabels[order.paymentMethod]],
              ['Trạng thái', paymentStatusLabels[order.paymentStatus]],
            ],
          },
          layout: 'noBorders',
        },
      ],
      columnGap: 24,
      margin: [0, 0, 0, 18],
    },
    {
      table: {
        headerRows: 1,
        widths: [24, '*', 40, 78, 84],
        body: [
          [
            toPdfText('#', { style: 'tableHeader', alignment: 'center' }),
            toPdfText('Sản phẩm', { style: 'tableHeader' }),
            toPdfText('SL', { style: 'tableHeader', alignment: 'right' }),
            toPdfText('Đơn giá', { style: 'tableHeader', alignment: 'right' }),
            toPdfText('Thành tiền', { style: 'tableHeader', alignment: 'right' }),
          ],
          ...itemRows,
        ],
      },
      layout: {
        fillColor: (rowIndex) => rowIndex === 0 ? '#f2f2f2' : null,
        hLineColor: () => '#cfcfcf',
        vLineColor: () => '#cfcfcf',
        paddingTop: () => 8,
        paddingBottom: () => 8,
        paddingLeft: () => 7,
        paddingRight: () => 7,
      },
    },
    {
      columns: [
        {
          width: '*',
          stack: noteContent,
        },
        {
          width: 235,
          table: { widths: ['*', 95], body: totalRows },
          layout: {
            hLineColor: (index, node) => index === node.table.body.length - 1 ? '#777777' : '#d8d8d8',
            vLineWidth: () => 0,
            paddingTop: () => 6,
            paddingBottom: () => 6,
          },
        },
      ],
      columnGap: 24,
      margin: [0, 16, 0, 0],
    },
    {
      text: 'Chứng từ bán hàng được phát hành từ hệ thống quản lý cửa hàng. Không thay thế hóa đơn điện tử hoặc hóa đơn VAT theo quy định pháp luật.',
      style: 'disclaimer',
      margin: [0, 22, 0, 0],
    },
  ]

  return {
    info: {
      title: `Hóa đơn ${order.invoiceCode || order.orderCode}`,
      author: settings.identity.legalName || settings.identity.name,
      subject: `Hóa đơn bán hàng cho đơn ${order.orderCode}`,
    },
    pageSize: 'A4',
    pageMargins: [40, 44, 40, 48],
    defaultStyle: { font: 'Roboto', fontSize: 9, color: '#262626', lineHeight: 1.25 },
    content,
    footer: (currentPage, pageCount) => ({
      text: `${order.invoiceCode || order.orderCode} · Trang ${currentPage}/${pageCount}`,
      alignment: 'center',
      color: '#777777',
      fontSize: 8,
      margin: [0, 14, 0, 0],
    }),
    styles: {
      storeName: { fontSize: 16, bold: true, color: '#111111', margin: [0, 0, 0, 5] },
      invoiceTitle: { fontSize: 19, bold: true, color: '#000000', margin: [0, 0, 0, 5] },
      invoiceCode: { fontSize: 11, bold: true, color: '#222222', margin: [0, 0, 0, 3] },
      mutedLine: { color: '#5f5f5f', fontSize: 8.5, margin: [0, 1, 0, 1] },
      sectionLabel: { color: '#444444', bold: true, fontSize: 8, characterSpacing: 0.8 },
      tableHeader: { bold: true, color: '#222222', fontSize: 8 },
      disclaimer: { color: '#777777', italics: true, fontSize: 8, alignment: 'center' },
    },
  }
}

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;')

export const buildInvoicePrintHtml = (order: InvoiceOrder, settings: StorefrontSettings) => {
  const rows = order.order_list.map((item, index) => `
    <tr>
      <td class="center">${index + 1}</td>
      <td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(`${item.color} / ${item.size} / ${item.fitType}`)}</small></td>
      <td class="number">${item.quantity}</td>
      <td class="number">${escapeHtml(formatCurrency(item.priceAtPurchased))}</td>
      <td class="number"><strong>${escapeHtml(formatCurrency(item.quantity * item.priceAtPurchased))}</strong></td>
    </tr>`).join('')
  const totals = buildInvoiceTotals(order).map((row) => `
    <div class="total-row ${row.tone ? `is-${row.tone}` : ''}">
      <span>${escapeHtml(row.label)}</span><strong>${escapeHtml(formatCurrency(row.value))}</strong>
    </div>`).join('')
  const sellerLines = buildSellerLines(settings).map((line) => `<span>${escapeHtml(line)}</span>`).join('')
  const avatarUrl = settings.identity.avatarUrl.trim()
  const storeInitials = settings.identity.name.trim().slice(0, 2).toLocaleUpperCase('vi-VN') || 'FS'
  const storeMark = `<span class="store-mark"><span>${escapeHtml(storeInitials)}</span>${avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="" />` : ''}</span>`

  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(`Hóa đơn ${order.invoiceCode || order.orderCode}`)}</title>
    <style>
      @page { size: A4; margin: 14mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #202020; font: 13px/1.45 Arial, sans-serif; background: #fff; }
      .invoice { max-width: 820px; margin: 0 auto; }
      header, .buyer { display: grid; grid-template-columns: 1fr 280px; gap: 28px; }
      .store-brand { display: flex; align-items: flex-start; gap: 12px; }
      .store-mark { position: relative; display: grid; place-items: center; flex: 0 0 52px; width: 52px; height: 52px; overflow: hidden; border-radius: 12px; color: #fff; background: #262626; font-weight: 800; }
      .store-mark > span { color: #fff; font-size: 15px; }
      .store-mark img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; background: #fff; }
      .store h1 { margin: 0 0 5px; color: #111; font-size: 22px; }
      .store-brand > div span, .muted { display: block; color: #5f5f5f; font-size: 12px; }
      .title { text-align: right; }
      .title h2 { margin: 0 0 5px; color: #000; font-size: 25px; font-weight: 800; }
      .title strong { color: #222; font-weight: 800; }
      hr { margin: 20px 0; border: 0; border-top: 1px solid #bdbdbd; }
      .label { color: #444; font-size: 11px; font-weight: 800; letter-spacing: .08em; }
      .buyer h3 { margin: 6px 0 2px; font-size: 16px; }
      .meta { display: grid; grid-template-columns: 100px 1fr; gap: 5px 10px; }
      .meta span { color: #666; }
      table { width: 100%; margin-top: 22px; border-collapse: collapse; }
      th, td { padding: 9px 8px; border: 1px solid #cfcfcf; vertical-align: top; }
      th { color: #222; background: #f2f2f2; font-size: 11px; font-weight: 800; text-align: left; }
      td small { display: block; margin-top: 3px; color: #5f5f5f; }
      .center { text-align: center; }
      .number { white-space: nowrap; text-align: right; }
      .summary { display: grid; grid-template-columns: 1fr 290px; gap: 28px; margin-top: 18px; }
      .note { color: #454545; }
      .note strong { display: block; margin-bottom: 5px; color: #444; font-size: 11px; letter-spacing: .08em; }
      .total-row { display: flex; justify-content: space-between; gap: 15px; padding: 7px 0; border-bottom: 1px solid #d8d8d8; }
      .total-row.is-discount { color: #3f3f3f; }
      .total-row.is-total { padding-top: 10px; border-top: 1px solid #777; border-bottom: 0; color: #000; font-size: 16px; font-weight: 800; }
      footer { margin-top: 28px; color: #777; font-size: 11px; font-style: italic; text-align: center; }
      @media print { body { color: #000; } .invoice { max-width: none; } }
    </style>
  </head>
  <body>
    <main class="invoice">
      <header>
        <div class="store"><div class="store-brand">${storeMark}<div><h1>${escapeHtml(settings.identity.name)}</h1>${sellerLines}</div></div></div>
        <div class="title"><h2>HÓA ĐƠN BÁN HÀNG</h2><strong>${escapeHtml(order.invoiceCode || 'CHƯA PHÁT HÀNH')}</strong><span class="muted">Phát hành: ${escapeHtml(formatInvoiceDate(getInvoiceIssuedAt(order)))}</span></div>
      </header>
      <hr />
      <section class="buyer">
        <div><span class="label">NGƯỜI MUA / NGƯỜI NHẬN</span><h3>${escapeHtml(order.shippingAddress.customerName)}</h3><span class="muted">${escapeHtml(order.shippingAddress.phoneNumber)}</span><span class="muted">${escapeHtml(getInvoiceDeliveryAddress(order))}</span></div>
        <div class="meta"><span>Mã đơn</span><strong>${escapeHtml(order.orderCode)}</strong><span>Thanh toán</span><strong>${escapeHtml(paymentMethodLabels[order.paymentMethod])}</strong><span>Trạng thái</span><strong>${escapeHtml(paymentStatusLabels[order.paymentStatus])}</strong></div>
      </section>
      <table>
        <thead><tr><th class="center">#</th><th>Sản phẩm</th><th class="number">SL</th><th class="number">Đơn giá</th><th class="number">Thành tiền</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <section class="summary">
        <div class="note">${order.orderNote ? `<strong>GHI CHÚ ĐƠN HÀNG</strong>${escapeHtml(order.orderNote)}` : ''}</div>
        <div>${totals}</div>
      </section>
      <footer>Chứng từ bán hàng được phát hành từ hệ thống quản lý cửa hàng. Không thay thế hóa đơn điện tử hoặc hóa đơn VAT theo quy định pháp luật.</footer>
    </main>
  </body>
</html>`
}

export const printInvoice = (order: InvoiceOrder, settings: StorefrontSettings) => {
  const printWindow = window.open('', '_blank', 'width=960,height=800')
  if (!printWindow) throw new Error('Trình duyệt đang chặn cửa sổ in hóa đơn.')

  printWindow.opener = null
  printWindow.document.open()
  printWindow.document.write(buildInvoicePrintHtml(order, settings))
  printWindow.document.close()
  printWindow.onafterprint = () => printWindow.close()

  const print = () => {
    printWindow.focus()
    printWindow.print()
  }
  const pendingImages = Array.from(printWindow.document.images)
    .filter((image) => !image.complete)
    .map((image) => new Promise<void>((resolve) => {
      image.addEventListener('load', () => resolve(), { once: true })
      image.addEventListener('error', () => resolve(), { once: true })
    }))

  void Promise.race([
    Promise.all(pendingImages),
    new Promise<void>((resolve) => window.setTimeout(resolve, 2_000)),
  ]).then(() => window.setTimeout(print, 150))
}

const loadAvatarDataUrl = (avatarUrl: string) => new Promise<string | null>((resolve) => {
  if (!avatarUrl) {
    resolve(null)
    return
  }

  const image = new Image()
  let settled = false
  const timeout = window.setTimeout(() => finish(null), 5_000)
  const finish = (value: string | null) => {
    if (settled) return
    settled = true
    window.clearTimeout(timeout)
    resolve(value)
  }

  image.crossOrigin = 'anonymous'
  image.referrerPolicy = 'no-referrer'
  image.onload = () => {
    try {
      const canvas = document.createElement('canvas')
      const size = 192
      canvas.width = size
      canvas.height = size
      const context = canvas.getContext('2d')
      if (!context) {
        finish(null)
        return
      }

      const sourceSize = Math.min(image.naturalWidth, image.naturalHeight)
      const sourceX = (image.naturalWidth - sourceSize) / 2
      const sourceY = (image.naturalHeight - sourceSize) / 2
      context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size)
      finish(canvas.toDataURL('image/png'))
    } catch {
      finish(null)
    }
  }
  image.onerror = () => finish(null)
  image.src = avatarUrl
})

export const downloadInvoicePdf = async (order: InvoiceOrder, settings: StorefrontSettings) => {
  const [{ default: pdfMake }, { default: pdfFonts }, avatarDataUrl] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
    loadAvatarDataUrl(settings.identity.avatarUrl.trim()),
  ])

  pdfMake.addVirtualFileSystem(pdfFonts)
  pdfMake.createPdf(buildInvoicePdfDefinition(order, settings, avatarDataUrl)).download(getInvoiceFileName(order))
}
