import type {
  FaqCategory,
  FaqVoteValue,
  ISupportAttachment,
  ISupportContext,
  SupportCategory,
  SupportPriority,
  SupportTicketStatus,
  SupportTicketType,
} from '../../database/models';

export type PaginationQuery = { page?: number; limit?: number };

export type CreateSupportTicketInput = {
  type: SupportTicketType;
  category: SupportCategory;
  subject: string;
  body: string;
  requiresReply?: boolean;
  orderId?: string | null;
  couponCode?: string | null;
  context?: Partial<ISupportContext> | null;
  attachments?: ISupportAttachment[];
};

export type AddSupportMessageInput = {
  body: string;
  attachments?: ISupportAttachment[];
};

export type ListFaqInput = PaginationQuery & {
  category?: FaqCategory;
  search?: string;
  publishedOnly?: boolean;
  viewerUserId?: string;
};

export type VoteFaqInput = { value: FaqVoteValue };

export type CreateGuestFeedbackInput = {
  name: string;
  email: string;
  type: 'feedback' | 'suggestion';
  category: SupportCategory;
  subject: string;
  body: string;
  website?: string;
};

export type AdminTicketQuery = PaginationQuery & {
  search?: string;
  status?: SupportTicketStatus;
  type?: SupportTicketType;
  category?: SupportCategory;
  priority?: SupportPriority;
  assignedTo?: string;
  requiresReply?: boolean;
  hasOrder?: boolean;
  dateFrom?: string;
  dateTo?: string;
};

export type UpdateSupportTicketInput = {
  status?: SupportTicketStatus;
  priority?: SupportPriority;
  category?: SupportCategory;
  assignedTo?: string | null;
};

export type AdminSupportMessageInput = AddSupportMessageInput & {
  isInternal?: boolean;
  cannedResponseId?: string;
};

export type CannedResponsePayload = {
  title: string;
  body: string;
  category?: SupportCategory | null;
  isActive?: boolean;
};

export type FaqPayload = {
  question: string;
  answer: string;
  category: FaqCategory;
  keywords?: string[];
  sortOrder?: number;
  isPublished?: boolean;
};
