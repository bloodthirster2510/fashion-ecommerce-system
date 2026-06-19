export const sendResetPasswordEmail = async (to: string, token: string) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

  if (process.env.NODE_ENV !== 'production') {
    console.info(`Reset password email prepared for ${to}; configure SMTP to deliver it.`);
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to,
        subject: 'Đặt lại mật khẩu - Fashion Shop',
        html: `<p>Bạn đã yêu cầu đặt lại mật khẩu.</p><p>Click <a href="${resetUrl}">vào đây</a> để đặt lại mật khẩu. Token có hiệu lực trong 15 phút.</p>`,
      });
    } catch (err) {
      console.error('Failed to send email:', err);
    }
  }
};
