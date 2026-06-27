import { requestAdmin } from '../../services/adminHttp'
import type {
  AdminVirtualTryOnFilters,
  AdminVirtualTryOnJob,
  AdminVirtualTryOnJobList,
  AdminVirtualTryOnSettings,
  AdminVirtualTryOnSummary,
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

