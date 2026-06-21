import { axiosClient } from '../../services/axiosClient'
import { requestCustomer } from '../../services/customerHttp'
import type { FaqArticle, Paginated, SupportMessage, SupportSummary, SupportTicket, SupportTicketType, SupportCategory, TicketDetail } from './support.types'

const parsePublic = async <T>(response: Response) => {
  const payload = await response.json().catch(() => ({})) as { data?: T; message?: string }
  if (!response.ok || payload.data === undefined) throw new Error(payload.message || 'Không thể tải dữ liệu hỗ trợ.')
  return payload.data
}

export const listFaqs = async (search = '', category = '') => {
  const params = new URLSearchParams({ page: '1', limit: '50' })
  if (search.trim()) params.set('search', search.trim())
  if (category) params.set('category', category)
  return parsePublic<Paginated<FaqArticle>>(await axiosClient.fetch(`/support/faqs?${params.toString()}`))
}

export const createGuestFeedback = async (payload: {
  name: string; email: string; type: 'feedback' | 'suggestion'; category: SupportCategory;
  subject: string; body: string; website: string;
}) => parsePublic<{ pendingVerification: true; ticketCode?: string }>(await axiosClient.fetch('/support/guest-feedback', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
}))

export const verifyGuestFeedback = async (token: string) =>
  parsePublic<{ verified: true; ticketCode: string }>(await axiosClient.fetch(`/support/guest-feedback/verify?token=${encodeURIComponent(token)}`))

export const listMyTickets = () => requestCustomer<Paginated<SupportTicket>>('/support/tickets?page=1&limit=50')
export const getMyTicket = (id: string) => requestCustomer<TicketDetail>(`/support/tickets/${id}`)
export const getMySupportSummary = () => requestCustomer<SupportSummary>('/support/summary')
export const voteFaq = (id: string, value: 'helpful' | 'not_helpful') =>
  requestCustomer<FaqArticle>(`/support/faqs/${id}/vote`, { method: 'POST', body: JSON.stringify({ value }) })
export const markMyTicketRead = (id: string) => requestCustomer<SupportTicket>(`/support/tickets/${id}/read`, { method: 'PATCH' })
export const closeMyTicket = (id: string) => requestCustomer<SupportTicket>(`/support/tickets/${id}/close`, { method: 'PATCH' })

const addFiles = (data: FormData, files: File[]) => files.slice(0, 3).forEach((file) => data.append('attachments', file))

export const createMyTicket = (payload: {
  type: SupportTicketType; category: SupportCategory; subject: string; body: string; requiresReply: boolean;
  orderId?: string; couponCode?: string; files: File[];
}) => {
  const data = new FormData()
  data.set('type', payload.type); data.set('category', payload.category); data.set('subject', payload.subject)
  data.set('body', payload.body); data.set('requiresReply', String(payload.requiresReply))
  data.set('context', JSON.stringify({ source: 'support_home', appPlatform: 'web' }))
  if (payload.orderId) data.set('orderId', payload.orderId)
  if (payload.couponCode) data.set('couponCode', payload.couponCode)
  addFiles(data, payload.files)
  return requestCustomer<TicketDetail>('/support/tickets', { method: 'POST', body: data })
}

export const addMyMessage = (id: string, body: string, files: File[]) => {
  const data = new FormData(); data.set('body', body); addFiles(data, files)
  return requestCustomer<SupportMessage>(`/support/tickets/${id}/messages`, { method: 'POST', body: data })
}
