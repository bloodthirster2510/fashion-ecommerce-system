import {
  deliverEmail,
  EmailDeliveryError,
  getEmailDeliveryCapability,
  type EmailDeliveryInfo,
  type EmailMessageInput,
} from './email-provider';

export type ResetPasswordEmailDeliveryInfo = EmailDeliveryInfo & {
  testToken?: string;
  testUrl?: string;
};

export type LoginUnlockEmailDeliveryInfo = EmailDeliveryInfo & {
  testOtp?: string;
};

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const readEnv = (name: string) => process.env[name]?.trim() || '';

const appendResetParams = (baseUrl: string, to: string, token: string) => {
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}identifier=${encodeURIComponent(to)}&token=${encodeURIComponent(token)}`;
};

const getMockResetToken = () => {
  const token = readEnv('EMAIL_MOCK_RESET_TOKEN') || 'mock-reset-token-0000000000000001';
  if (token.length < 16) {
    throw new EmailDeliveryError('EMAIL_MOCK_RESET_TOKEN phải có ít nhất 16 ký tự', {
      status: 503,
      code: 'EMAIL_MOCK_TOKEN_INVALID',
    });
  }
  return token;
};

const buildResetUrls = (to: string, token: string) => {
  const frontendUrl = readEnv('PASSWORD_RESET_WEB_URL');
  const mobileUrl = readEnv('PASSWORD_RESET_MOBILE_URL')
    || 'fashion-ecommerce://reset-password';
  return {
    webUrl: frontendUrl ? appendResetParams(frontendUrl, to, token) : null,
    mobileUrl: appendResetParams(mobileUrl, to, token),
  };
};

export const getResetPasswordEmailCapability = (to: string): ResetPasswordEmailDeliveryInfo => {
  const capability = getEmailDeliveryCapability();
  if (capability.mode === 'real') {
    return capability;
  }

  const testToken = getMockResetToken();
  return {
    ...capability,
    testToken,
    testUrl: buildResetUrls(to, testToken).mobileUrl,
  };
};

export const sendResetPasswordEmail = async (to: string, token: string) => {
  const urls = buildResetUrls(to, token);
  const delivery = await deliverEmail({
    to,
    subject: 'Đặt lại mật khẩu - Fashion Shop',
    logLabel: 'reset password',
    html: [
      '<p>Bạn đã yêu cầu đặt lại mật khẩu.</p>',
      `<p><a href="${escapeHtml(urls.mobileUrl)}">Mở ứng dụng để đặt lại mật khẩu</a>.</p>`,
      ...(urls.webUrl
        ? [`<p>Nếu không mở được ứng dụng, <a href="${escapeHtml(urls.webUrl)}">tiếp tục trên web</a>.</p>`]
        : []),
      '<p>Liên kết có hiệu lực trong 15 phút.</p>',
    ].join(''),
  });
  return {
    mode: delivery.mode,
    provider: delivery.provider,
    ...(delivery.mode === 'mock'
      ? { testToken: token, testUrl: urls.mobileUrl }
      : {}),
  } satisfies ResetPasswordEmailDeliveryInfo;
};

export const sendLoginUnlockOtpEmail = async (
  to: string,
  otp: string,
  expiresAt: Date,
): Promise<LoginUnlockEmailDeliveryInfo> => {
  const delivery = await deliverEmail({
    to,
    subject: 'Mã mở khóa đăng nhập - Fashion Shop',
    logLabel: 'login unlock OTP',
    html: [
      '<p>Chúng tôi nhận được yêu cầu mở khóa đăng nhập cho tài khoản của bạn.</p>',
      `<p>Mã OTP: <strong>${escapeHtml(otp)}</strong></p>`,
      `<p>Mã có hiệu lực đến ${escapeHtml(expiresAt.toLocaleString('vi-VN'))} và chỉ dùng được một lần.</p>`,
      '<p>Nếu bạn không yêu cầu mã này, hãy bỏ qua email và cân nhắc đổi mật khẩu.</p>',
    ].join(''),
  });

  return {
    mode: delivery.mode,
    provider: delivery.provider,
    ...(delivery.mode === 'mock' ? { testOtp: otp } : {}),
  };
};

const sendBestEffortEmail = async (input: EmailMessageInput) => {
  try {
    await deliverEmail(input);
    return true;
  } catch {
    return false;
  }
};

export const sendSupportReplyEmail = async (input: {
  to: string;
  ticketId: string;
  ticketCode: string;
  subject: string;
  reply: string;
  isGuest?: boolean;
}) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const ticketUrl = input.isGuest
    ? `${frontendUrl}/support`
    : `${frontendUrl}/account/support/tickets/${encodeURIComponent(input.ticketId)}`;
  return sendBestEffortEmail({
    to: input.to,
    subject: `[${input.ticketCode}] Shop đã phản hồi yêu cầu hỗ trợ`,
    logLabel: 'support reply',
    html: [
      `<p>Shop đã phản hồi yêu cầu <strong>${escapeHtml(input.subject)}</strong>.</p>`,
      `<blockquote>${escapeHtml(input.reply).replace(/\n/g, '<br>')}</blockquote>`,
      `<p><a href="${ticketUrl}">${input.isGuest ? 'Mở trang hỗ trợ' : 'Xem và trả lời ticket'}</a></p>`,
    ].join(''),
  });
};

export const sendGuestFeedbackVerificationEmail = async (input: {
  to: string;
  name: string;
  ticketCode: string;
  token: string;
}) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const verificationUrl = `${frontendUrl}/support/verify?token=${encodeURIComponent(input.token)}`;
  return sendBestEffortEmail({
    to: input.to,
    subject: `[${input.ticketCode}] Xác minh góp ý gửi Fashion Shop`,
    logLabel: 'guest feedback verification',
    html: `<p>Xin chào ${escapeHtml(input.name)},</p><p>Vui lòng <a href="${verificationUrl}">xác minh góp ý</a> trong vòng 30 phút. Nếu bạn không gửi yêu cầu này, hãy bỏ qua email.</p>`,
  });
};

export type OrderInvoiceEmailInput = {
  to: string;
  orderId: string;
  orderCode: string;
  invoiceCode: string;
  invoiceIssuedAt: Date;
  customerName: string;
  paymentMethod: string;
  items: Array<{
    name: string;
    sku: string;
    color: string;
    size: string;
    quantity: number;
    unitPrice: number;
  }>;
  subTotal: number;
  discountAmount: number;
  shippingFee: number;
  taxAmount: number;
  totalAmount: number;
  pdf: Buffer;
};

const formatInvoiceCurrency = (value: number) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(value);

export const sendOrderInvoiceEmail = async (input: OrderInvoiceEmailInput) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const orderUrl = `${frontendUrl}/account/orders`;
  const itemRows = input.items.map((item) => [
    '<tr>',
    `<td style="padding:8px;border-bottom:1px solid #ddd"><strong>${escapeHtml(item.name)}</strong><br><small>${escapeHtml(`${item.color} / ${item.size} · SKU ${item.sku}`)}</small></td>`,
    `<td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${item.quantity}</td>`,
    `<td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${escapeHtml(formatInvoiceCurrency(item.unitPrice))}</td>`,
    `<td style="padding:8px;border-bottom:1px solid #ddd;text-align:right"><strong>${escapeHtml(formatInvoiceCurrency(item.unitPrice * item.quantity))}</strong></td>`,
    '</tr>',
  ].join('')).join('');
  const totalRowEntries: Array<[string, number]> = [
    ['Tiền hàng', input.subTotal],
    ...(input.discountAmount > 0 ? [['Giảm giá', -input.discountAmount] as [string, number]] : []),
    ['Phí vận chuyển', input.shippingFee],
    ...(input.taxAmount > 0 ? [['Thuế', input.taxAmount] as [string, number]] : []),
  ];
  const totalRows = totalRowEntries.map(([label, value]) => (
    `<tr><td style="padding:4px 8px">${escapeHtml(label)}</td><td style="padding:4px 8px;text-align:right">${escapeHtml(formatInvoiceCurrency(value))}</td></tr>`
  )).join('');

  return deliverEmail({
    to: input.to,
    subject: `Hóa đơn ${input.invoiceCode} - Fashion Shop`,
    logLabel: 'order invoice',
    attachments: [{
      filename: `${input.invoiceCode.replace(/[^A-Za-z0-9_-]+/g, '-')}.pdf`,
      content: input.pdf,
      contentType: 'application/pdf',
    }],
    html: [
      `<p>Xin chào ${escapeHtml(input.customerName)},</p>`,
      `<p>Thanh toán cho đơn hàng <strong>${escapeHtml(input.orderCode)}</strong> đã thành công. Hóa đơn PDF được đính kèm trong email này.</p>`,
      '<div style="margin:20px 0;padding:16px;border:1px solid #ccc;border-radius:8px">',
      '<div style="display:flex;justify-content:space-between;gap:16px">',
      '<div><strong>FASHION SHOP</strong><br><small>Hóa đơn bán hàng</small></div>',
      `<div style="text-align:right"><strong>${escapeHtml(input.invoiceCode)}</strong><br><small>${escapeHtml(input.invoiceIssuedAt.toLocaleString('vi-VN'))}</small></div>`,
      '</div>',
      `<p><strong>Phương thức thanh toán:</strong> ${escapeHtml(input.paymentMethod)}</p>`,
      '<table style="width:100%;border-collapse:collapse">',
      '<thead><tr><th style="padding:8px;text-align:left;border-bottom:2px solid #999">Sản phẩm</th><th style="padding:8px;text-align:right;border-bottom:2px solid #999">SL</th><th style="padding:8px;text-align:right;border-bottom:2px solid #999">Đơn giá</th><th style="padding:8px;text-align:right;border-bottom:2px solid #999">Thành tiền</th></tr></thead>',
      `<tbody>${itemRows}</tbody>`,
      '</table>',
      `<table style="width:100%;max-width:360px;margin:16px 0 0 auto">${totalRows}<tr><td style="padding:8px;border-top:2px solid #999"><strong>Tổng thanh toán</strong></td><td style="padding:8px;border-top:2px solid #999;text-align:right"><strong>${escapeHtml(formatInvoiceCurrency(input.totalAmount))}</strong></td></tr></table>`,
      '</div>',
      `<p><a href="${escapeHtml(orderUrl)}">Xem đơn hàng của bạn</a></p>`,
      '<p><small>Đây là chứng từ bán hàng từ hệ thống, không thay thế hóa đơn điện tử hoặc hóa đơn VAT theo quy định pháp luật.</small></p>',
    ].join(''),
  });
};
