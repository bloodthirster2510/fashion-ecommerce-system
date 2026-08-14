import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { IOrder } from '../../database/models';
import type { StorefrontSettingsView } from '../storefront-settings/storefront-settings.service';

(pdfMake as typeof pdfMake & {
  addVirtualFileSystem: (virtualFileSystem: typeof pdfFonts) => void;
}).addVirtualFileSystem(pdfFonts);

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});
const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const AVATAR_FETCH_TIMEOUT_MS = 5_000;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const supportedAvatarTypes = new Set(['image/jpeg', 'image/png']);

const paymentMethodLabels: Record<string, string> = {
  COD: 'Thanh toán khi nhận hàng',
  VNPAY: 'VNPay',
  MOMO: 'MoMo',
  CARD: 'Thẻ',
  BANK: 'Chuyển khoản',
};

const paymentStatusLabels: Record<string, string> = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  failed: 'Thanh toán thất bại',
  refunded: 'Đã hoàn tiền',
};

const formatCurrency = (value: number) => currencyFormatter.format(value);
const formatDate = (value: Date | string | null | undefined) => {
  if (!value) return 'Chưa có';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa có' : dateFormatter.format(date);
};
const getAddress = (order: IOrder) => [
  order.shippingAddress.streetName,
  order.shippingAddress.ward,
  order.shippingAddress.district,
  order.shippingAddress.province,
].filter(Boolean).join(', ');
const toPdfText = (value: string, options: Partial<TableCell> = {}): TableCell => ({
  text: value,
  ...options,
}) as TableCell;

const buildSellerLines = (settings: StorefrontSettingsView) => [
  settings.identity.legalName || settings.identity.name,
  settings.identity.taxCode ? `Mã số thuế: ${settings.identity.taxCode}` : null,
  settings.contact.address || null,
  [settings.contact.phone, settings.contact.email].filter(Boolean).join(' · ') || null,
].filter((value): value is string => Boolean(value));

const fetchAvatarDataUri = async (avatarUrl: string) => {
  if (!avatarUrl) return null;

  try {
    const response = await fetch(avatarUrl, {
      signal: AbortSignal.timeout(AVATAR_FETCH_TIMEOUT_MS),
    });
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() || '';
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (
      !response.ok
      || !supportedAvatarTypes.has(contentType)
      || (contentLength > 0 && contentLength > MAX_AVATAR_BYTES)
    ) return null;

    const content = Buffer.from(await response.arrayBuffer());
    if (!content.length || content.length > MAX_AVATAR_BYTES) return null;
    return `data:${contentType};base64,${content.toString('base64')}`;
  } catch {
    return null;
  }
};

const buildTotals = (order: IOrder): Array<{
  label: string;
  value: number;
  tone?: 'discount' | 'total';
}> => [
  { label: 'Tiền hàng', value: order.subTotal },
  ...(order.couponDiscountAmount > 0
    ? [{
        label: `Voucher giảm giá${order.couponCode ? ` (${order.couponCode})` : ''}`,
        value: -order.couponDiscountAmount,
        tone: 'discount' as const,
      }]
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
];

export const buildOrderInvoicePdfDefinition = (
  order: IOrder,
  settings: StorefrontSettingsView,
  avatarDataUri?: string | null,
): TDocumentDefinitions => {
  const sellerLines = buildSellerLines(settings);
  const storeInitials = settings.identity.name.trim().slice(0, 2).toLocaleUpperCase('vi-VN') || 'FS';
  const itemRows: TableCell[][] = order.order_list.map((item, index) => [
    toPdfText(String(index + 1), { alignment: 'center' }),
    {
      stack: [
        { text: item.name, bold: true },
        { text: `${item.color} / ${item.size} · SKU ${item.sku}`, color: '#5f5f5f', fontSize: 8 },
      ],
    },
    toPdfText(String(item.quantity), { alignment: 'right' }),
    toPdfText(formatCurrency(item.priceAtPurchased), { alignment: 'right' }),
    toPdfText(formatCurrency(item.quantity * item.priceAtPurchased), { alignment: 'right', bold: true }),
  ]);
  const totalRows: TableCell[][] = buildTotals(order).map((row) => [
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
  ]);
  const noteContent: Content[] = order.orderNote
    ? [
        { text: 'GHI CHÚ ĐƠN HÀNG', style: 'sectionLabel', margin: [0, 0, 0, 5] },
        { text: order.orderNote, color: '#454545' },
      ]
    : [];
  const invoiceCode = order.invoiceCode || order.orderCode;

  return {
    info: {
      title: `Hóa đơn ${invoiceCode}`,
      author: settings.identity.legalName || settings.identity.name,
      subject: `Hóa đơn bán hàng cho đơn ${order.orderCode}`,
    },
    pageSize: 'A4',
    pageMargins: [40, 44, 40, 48],
    defaultStyle: { font: 'Roboto', fontSize: 9, color: '#262626', lineHeight: 1.25 },
    content: [
      {
        columns: [
          {
            width: '*',
            columns: [
              {
                width: 48,
                ...(avatarDataUri
                  ? {
                      table: {
                        widths: [48],
                        heights: [48],
                        body: [[{
                          image: avatarDataUri,
                          cover: { width: 48, height: 48, align: 'center', valign: 'center' },
                          alignment: 'center',
                          borderColor: ['#bdbdbd', '#bdbdbd', '#bdbdbd', '#bdbdbd'],
                        }]],
                      },
                      layout: {
                        hLineWidth: () => 0.8,
                        vLineWidth: () => 0.8,
                        hLineColor: () => '#bdbdbd',
                        vLineColor: () => '#bdbdbd',
                        paddingLeft: () => 0,
                        paddingRight: () => 0,
                        paddingTop: () => 0,
                        paddingBottom: () => 0,
                      },
                    }
                  : {
                      table: { widths: [48], heights: [48], body: [[{
                        text: storeInitials,
                        alignment: 'center',
                        color: '#ffffff',
                        bold: true,
                        fontSize: 14,
                        margin: [0, 14, 0, 0],
                        fillColor: '#262626',
                      }]] },
                      layout: 'noBorders',
                    }),
              },
              {
                width: '*',
                margin: [10, 0, 0, 0],
                stack: [
                  { text: settings.identity.name, style: 'storeName' },
                  ...sellerLines.map((line) => ({ text: line, style: 'mutedLine' })),
                ],
              },
            ],
          },
          {
            width: 210,
            alignment: 'right',
            stack: [
              { text: 'HÓA ĐƠN BÁN HÀNG', style: 'invoiceTitle' },
              { text: invoiceCode, style: 'invoiceCode' },
              { text: `Phát hành: ${formatDate(order.invoiceIssuedAt)}`, style: 'mutedLine' },
            ],
          },
        ],
        columnGap: 24,
      },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#bdbdbd' }],
        margin: [0, 16, 0, 16],
      },
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'NGƯỜI MUA / NGƯỜI NHẬN', style: 'sectionLabel' },
              { text: order.shippingAddress.customerName, bold: true, fontSize: 11, margin: [0, 5, 0, 2] },
              { text: order.shippingAddress.phoneNumber, style: 'mutedLine' },
              { text: getAddress(order), style: 'mutedLine' },
            ],
          },
          {
            width: 210,
            table: {
              widths: [85, '*'],
              body: [
                ['Mã đơn', order.orderCode],
                ['Thanh toán', paymentMethodLabels[order.paymentMethod] || order.paymentMethod],
                ['Trạng thái', paymentStatusLabels[order.paymentStatus] || order.paymentStatus],
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
          { width: '*', stack: noteContent },
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
    ],
    footer: (currentPage, pageCount) => ({
      text: `${invoiceCode} · Trang ${currentPage}/${pageCount}`,
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
  };
};

export const buildOrderInvoicePdf = async (
  order: IOrder,
  settings: StorefrontSettingsView,
) => {
  const avatarDataUri = await fetchAvatarDataUri(settings.identity.avatarUrl);
  return new Promise<Buffer>((resolve, reject) => {
  try {
    pdfMake.createPdf(buildOrderInvoicePdfDefinition(order, settings, avatarDataUri)).getBuffer((buffer) => {
      resolve(Buffer.from(buffer));
    });
  } catch (error) {
    reject(error);
  }
  });
};
