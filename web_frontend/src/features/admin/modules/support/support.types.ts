export type SupportTicketStatus = 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed' | 'spam'
export type SupportTicketType = 'question' | 'issue' | 'complaint' | 'feedback' | 'suggestion'
export type SupportCategory = 'orders' | 'shipping' | 'returns' | 'payments' | 'promotions' | 'loyalty' | 'account' | 'product' | 'app_website' | 'service' | 'other'
export type SupportPriority = 'low' | 'normal' | 'high' | 'urgent'

export type SupportPerson = {
  _id: string
  name: string
  email: string
  phone?: string
  role?: string
  avatarImage?: string | null
}

export type SupportTicket = {
  _id: string
  ticketCode: string
  userId: string | SupportPerson | null
  guestContact?: { name: string; email: string; verifiedAt?: string | null } | null
  type: SupportTicketType
  category: SupportCategory
  subject: string
  status: SupportTicketStatus
  priority: SupportPriority
  requiresReply: boolean
  orderId?: string | { _id: string; orderCode: string; status: string; totalAmount: number } | null
  couponCode?: string | null
  context?: { source: string; appPlatform?: string; appVersion?: string; screen?: string; errorCode?: string } | null
  assignedTo?: string | SupportPerson | null
  lastMessageAt: string
  lastMessageSender: 'customer' | 'staff'
  createdAt: string
  updatedAt: string
}

export type SupportMessage = {
  _id: string
  senderType: 'customer' | 'staff'
  senderId: string | SupportPerson
  body: string
  attachments: Array<{ url: string; publicId: string; mimeType: string; size: number }>
  isInternal: boolean
  createdAt: string
}

export type SupportTicketList = {
  items: SupportTicket[]
  pagination: { page: number; limit: number; totalItems: number; totalPages: number }
}

export type SupportTicketDetail = { ticket: SupportTicket; messages: SupportMessage[] }

export type SupportSummary = {
  totalOpen: number
  waitingAdmin: number
  waitingCustomer: number
  resolved: number
  unassigned: number
  overdue: number
  generatedAt: string
}

export type FaqCategory = 'orders' | 'shipping' | 'returns' | 'payments' | 'promotions' | 'loyalty' | 'account' | 'other'

export type FaqArticle = {
  _id: string
  question: string
  answer: string
  category: FaqCategory
  keywords: string[]
  sortOrder: number
  isPublished: boolean
  publishedAt?: string | null
  helpfulCount: number
  notHelpfulCount: number
  createdAt: string
  updatedAt: string
}

export type FaqList = {
  items: FaqArticle[]
  pagination: { page: number; limit: number; totalItems: number; totalPages: number }
}

export type FaqPayload = Pick<FaqArticle, 'question' | 'answer' | 'category' | 'keywords' | 'sortOrder' | 'isPublished'>

export type CannedResponse = {
  _id: string
  title: string
  body: string
  category?: SupportCategory | null
  isActive: boolean
  useCount: number
  createdAt: string
  updatedAt: string
}

export type CannedResponsePayload = Pick<CannedResponse, 'title' | 'body' | 'category' | 'isActive'>

export type SupportAnalytics = {
  tickets: {
    total: number
    open: number
    resolved: number
    responded: number
    avgFirstResponseMs: number
    avgResolutionMs: number
  }
  byCategory: Array<{ key: SupportCategory; count: number }>
  byType: Array<{ key: SupportTicketType; count: number }>
  dailyVolume: Array<{ date: string; count: number }>
  faq: { helpful: number; notHelpful: number; totalVotes: number; helpfulRate: number }
  generatedAt: string
}
