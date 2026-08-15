declare module 'nodemailer' {
  type MailOptions = {
    from?: string;
    to?: string;
    subject?: string;
    html?: string;
    attachments?: Array<{
      filename: string;
      content: Buffer;
      contentType: string;
    }>;
  };

  type Transporter = {
    sendMail: (options: MailOptions) => Promise<unknown>;
  };

  export const createTransport: (options: Record<string, unknown>) => Transporter;
}
