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
