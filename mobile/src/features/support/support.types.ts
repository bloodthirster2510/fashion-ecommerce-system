export type SupportTicketType = 'question' | 'issue' | 'complaint' | 'feedback' | 'suggestion';
export type SupportCategory = 'orders' | 'shipping' | 'returns' | 'payments' | 'promotions' | 'loyalty' | 'account' | 'product' | 'app_website' | 'service' | 'other';
export type SupportTicketStatus = 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';

export type FaqArticle = {
  _id: string;
  question: string;
  answer: string;
  category: string;
  helpfulCount: number;
  notHelpfulCount: number;
};

export type SupportTicket = {
  _id: string;
  ticketCode: string;
  type: SupportTicketType;
  category: SupportCategory;
  subject: string;
  status: SupportTicketStatus;
  requiresReply: boolean;
  orderId?: string | null;
  couponCode?: string | null;
  lastMessageAt: string;
  lastMessageSender: 'customer' | 'staff';
  createdAt: string;
};

export type SupportMessage = {
  _id: string;
  senderType: 'customer' | 'staff';
  body: string;
  attachments: Array<{ url: string; publicId: string }>;
  createdAt: string;
};

export type SupportTicketDetail = { ticket: SupportTicket; messages: SupportMessage[] };
export type SupportSummary = { unreadReplies: number; waitingCustomer: number; total: number };
export type SupportImage = { uri: string; name: string; type: string };
