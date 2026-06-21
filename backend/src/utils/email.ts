type EmailInput = {
  to: string;
  subject: string;
  html: string;
  logLabel: string;
};

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const sendEmail = async ({ to, subject, html, logLabel }: EmailInput) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`${logLabel} email prepared for ${to}; configure SMTP to deliver it.`);
    }
    return false;
  }

  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error(`Failed to send ${logLabel} email:`, error);
    return false;
  }
};

export const sendResetPasswordEmail = async (to: string, token: string) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
  return sendEmail({
    to,
    subject: 'Đặt lại mật khẩu - Fashion Shop',
    logLabel: 'reset password',
    html: `<p>Bạn đã yêu cầu đặt lại mật khẩu.</p><p><a href="${resetUrl}">Đặt lại mật khẩu</a>. Liên kết có hiệu lực trong 15 phút.</p>`,
  });
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
  return sendEmail({
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
  return sendEmail({
    to: input.to,
    subject: `[${input.ticketCode}] Xác minh góp ý gửi Fashion Shop`,
    logLabel: 'guest feedback verification',
    html: `<p>Xin chào ${escapeHtml(input.name)},</p><p>Vui lòng <a href="${verificationUrl}">xác minh góp ý</a> trong vòng 30 phút. Nếu bạn không gửi yêu cầu này, hãy bỏ qua email.</p>`,
  });
};
