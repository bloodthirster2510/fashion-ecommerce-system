import { requestAdmin } from '../../services/adminHttp'
import type {
  FaqArticle,
  FaqList,
  FaqPayload,
  SupportCategory,
  SupportPriority,
  SupportSummary,
  SupportMessage,
  SupportTicket,
  SupportTicketDetail,
  SupportTicketList,
  SupportTicketStatus,
  SupportTicketType,
} from './support.types'

export type SupportFilters = {
  page?: number
  search?: string
  status?: SupportTicketStatus | 'all'
  type?: SupportTicketType | 'all'
  category?: SupportCategory | 'all'
  priority?: SupportPriority | 'all'
  requiresReply?: boolean
}

const query = (filters: SupportFilters) => {
  const params = new URLSearchParams({ page: String(filters.page ?? 1), limit: '30' })
  if (filters.search?.trim()) params.set('search', filters.search.trim())
  if (filters.status && filters.status !== 'all') params.set('status', filters.status)
  if (filters.type && filters.type !== 'all') params.set('type', filters.type)
  if (filters.category && filters.category !== 'all') params.set('category', filters.category)
  if (filters.priority && filters.priority !== 'all') params.set('priority', filters.priority)
  if (filters.requiresReply !== undefined) params.set('requiresReply', String(filters.requiresReply))
  return params.toString()
}

export const listSupportTickets = (filters: SupportFilters) =>
  requestAdmin<SupportTicketList>(`/admin/support/tickets?${query(filters)}`)

export const getSupportTicket = (id: string) =>
  requestAdmin<SupportTicketDetail>(`/admin/support/tickets/${id}`)

export const updateSupportTicket = (
  id: string,
  payload: Partial<Pick<SupportTicket, 'status' | 'priority' | 'category'>> & { assignedTo?: string | null },
) => requestAdmin<SupportTicket>(`/admin/support/tickets/${id}`, {
  method: 'PATCH',
  body: JSON.stringify(payload),
})

export const replySupportTicket = (id: string, body: string, isInternal: boolean, files: File[] = []) => {
  const data = new FormData()
  data.set('body', body)
  data.set('isInternal', String(isInternal))
  files.forEach((file) => data.append('attachments', file))
  return requestAdmin<SupportMessage>(`/admin/support/tickets/${id}/messages`, { method: 'POST', body: data })
}

export const markSupportTicketRead = (id: string) =>
  requestAdmin<SupportTicket>(`/admin/support/tickets/${id}/read`, { method: 'PATCH' })

export const getSupportSummary = () => requestAdmin<SupportSummary>('/admin/support/summary')

export const listAdminFaqs = (search = '', category = 'all') => {
  const params = new URLSearchParams({ page: '1', limit: '100' })
  if (search.trim()) params.set('search', search.trim())
  if (category !== 'all') params.set('category', category)
  return requestAdmin<FaqList>(`/admin/support/faqs?${params.toString()}`)
}

export const createAdminFaq = (payload: FaqPayload) => requestAdmin<FaqArticle>('/admin/support/faqs', {
  method: 'POST',
  body: JSON.stringify(payload),
})

export const updateAdminFaq = (id: string, payload: Partial<FaqPayload>) =>
  requestAdmin<FaqArticle>(`/admin/support/faqs/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })

export const deleteAdminFaq = (id: string) =>
  requestAdmin<FaqArticle | { _id: string; deleted: true }>(`/admin/support/faqs/${id}`, { method: 'DELETE' })
