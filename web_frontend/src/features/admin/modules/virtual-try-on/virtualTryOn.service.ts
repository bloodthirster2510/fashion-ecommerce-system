import { requestAdmin } from '../../services/adminHttp'
import type {
  AdminVirtualTryOnAccountLock,
  AdminVirtualTryOnAccountLockFilters,
  AdminVirtualTryOnAccountLockList,
  AdminVirtualTryOnFilters,
  AdminVirtualTryOnJob,
  AdminVirtualTryOnJobList,
  AdminVirtualTryOnPromptRule,
  AdminVirtualTryOnPromptRuleFilters,
  AdminVirtualTryOnPromptRuleList,
  AdminVirtualTryOnPromptTestResult,
  AdminVirtualTryOnSettings,
  AdminVirtualTryOnSummary,
  PromptPolicyCategory,
} from './virtualTryOn.types'

const appendIfPresent = (params: URLSearchParams, key: string, value?: string | number) => {
  if (value === undefined || value === null || value === '') return
  params.set(key, String(value))
}

export const listVirtualTryOnJobs = (filters: AdminVirtualTryOnFilters) => {
  const params = new URLSearchParams({ page: String(filters.page), limit: '12' })
  appendIfPresent(params, 'keyword', filters.keyword.trim())
  appendIfPresent(params, 'status', filters.status)
  appendIfPresent(params, 'provider', filters.provider.trim())
  appendIfPresent(params, 'dateFrom', filters.dateFrom)
  appendIfPresent(params, 'dateTo', filters.dateTo)
  return requestAdmin<AdminVirtualTryOnJobList>(`/admin/virtual-try-on/jobs?${params.toString()}`)
}

export const getVirtualTryOnSummary = () =>
  requestAdmin<AdminVirtualTryOnSummary>('/admin/virtual-try-on/summary')

export const getVirtualTryOnSettings = () =>
  requestAdmin<AdminVirtualTryOnSettings>('/admin/virtual-try-on/settings')

export const testVirtualTryOnPrompt = (contextPrompt: string) =>
  requestAdmin<AdminVirtualTryOnPromptTestResult>('/admin/virtual-try-on/prompt/test', {
    method: 'POST',
    body: JSON.stringify({ contextPrompt }),
  })

export const retryVirtualTryOnJob = (jobId: string) =>
  requestAdmin<AdminVirtualTryOnJob>(`/admin/virtual-try-on/jobs/${jobId}/retry`, {
    method: 'POST',
  })

export const cancelVirtualTryOnJob = (jobId: string) =>
  requestAdmin<AdminVirtualTryOnJob>(`/admin/virtual-try-on/jobs/${jobId}/cancel`, {
    method: 'POST',
  })

export const hideVirtualTryOnJob = (jobId: string) =>
  requestAdmin<AdminVirtualTryOnJob>(`/admin/virtual-try-on/jobs/${jobId}`, {
    method: 'DELETE',
  })

export const listVirtualTryOnPromptRules = (filters: AdminVirtualTryOnPromptRuleFilters) => {
  const params = new URLSearchParams({ page: String(filters.page), limit: '20' })
  appendIfPresent(params, 'keyword', filters.keyword.trim())
  appendIfPresent(params, 'category', filters.category)
  appendIfPresent(params, 'enabled', filters.enabled)
  return requestAdmin<AdminVirtualTryOnPromptRuleList>(`/admin/virtual-try-on/prompt-rules?${params.toString()}`)
}

export const createVirtualTryOnPromptRule = (input: {
  term: string
  category: PromptPolicyCategory
  reasonCode?: string
  enabled?: boolean
}) =>
  requestAdmin<AdminVirtualTryOnPromptRule>('/admin/virtual-try-on/prompt-rules', {
    method: 'POST',
    body: JSON.stringify(input),
  })

export const updateVirtualTryOnPromptRule = (
  ruleId: string,
  input: { term?: string; category?: PromptPolicyCategory; reasonCode?: string; enabled?: boolean },
) =>
  requestAdmin<AdminVirtualTryOnPromptRule>(`/admin/virtual-try-on/prompt-rules/${ruleId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })

export const deleteVirtualTryOnPromptRule = (ruleId: string) =>
  requestAdmin<{ _id: string; deleted: boolean }>(`/admin/virtual-try-on/prompt-rules/${ruleId}`, {
    method: 'DELETE',
  })

export const listVirtualTryOnAccountLocks = (filters: AdminVirtualTryOnAccountLockFilters) => {
  const params = new URLSearchParams({ page: String(filters.page), limit: '20' })
  appendIfPresent(params, 'keyword', filters.keyword.trim())
  appendIfPresent(params, 'locked', filters.locked)
  return requestAdmin<AdminVirtualTryOnAccountLockList>(`/admin/virtual-try-on/account-locks?${params.toString()}`)
}

export const lockVirtualTryOnAccount = (input: { userId: string; reason?: string }) =>
  requestAdmin<AdminVirtualTryOnAccountLock>('/admin/virtual-try-on/account-locks', {
    method: 'POST',
    body: JSON.stringify(input),
  })

export const unlockVirtualTryOnAccount = (userId: string) =>
  requestAdmin<AdminVirtualTryOnAccountLock>(`/admin/virtual-try-on/account-locks/${userId}`, {
    method: 'DELETE',
  })
