export type VirtualTryOnJobStatus = 'queued' | 'processing' | 'succeeded' | 'failed' | 'canceled'

export type AdminVirtualTryOnJob = {
  _id: string
  user: {
    _id: string
    name: string
    email: string
  } | null
  status: VirtualTryOnJobStatus
  progress: number
  outfitMode: 'single' | 'top_bottom' | 'full_set'
  contextPreset: string
  contextPrompt?: string
  outputMode: 'image' | 'image_and_video'
  provider: string
  providerJobId?: string | null
  sourceImageUrl?: string | null
  selectedItemCount: number
  selectedItems: Array<{
    productId: string
    nameSnapshot: string
    role: string
    colorSnapshot?: string
    imageSnapshot: string
    finalPriceSnapshot: number
  }>
  generatedImageUrl?: string | null
  generatedImageUrls?: string[]
  generatedVideoUrl?: string | null
  errorCode?: string | null
  errorMessage?: string | null
  totalFinalPrice: number
  createdAt: string
  updatedAt: string
  startedAt?: string | null
  completedAt?: string | null
  deletedAt?: string | null
}

export type AdminVirtualTryOnJobList = {
  items: AdminVirtualTryOnJob[]
  pagination: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
  }
}

export type AdminVirtualTryOnFilters = {
  page: number
  keyword: string
  status: '' | VirtualTryOnJobStatus
  provider: string
  dateFrom: string
  dateTo: string
}

export type AdminVirtualTryOnSummary = {
  total: number
  today: number
  queued: number
  processing: number
  succeeded: number
  failed: number
  canceled: number
  successRate: number
  provider: string
  videoEnabled: boolean
  promptViolationsToday: number
  promptBlocksToday: number
  latestFailedJobs: AdminVirtualTryOnJob[]
  generatedAt: string
}

export type AdminVirtualTryOnSettings = {
  provider: string
  enabled: boolean
  videoEnabled: boolean
  maxSelectedItems: number
  maxConcurrentJobsPerUser: number
  sourceImageMaxMb: number
  promptMaxLength: number
  promptViolationLimitPerDay: number
}

export type AdminVirtualTryOnPromptTestResult = {
  allowed: boolean
  normalizedPrompt: string | null
  reasonCode: string | null
  message: string | null
  maxLength: number
  matchedCategory?: string
  matchedRule?: string
}

export type PromptPolicyCategory =
  | 'sexual_content'
  | 'violence'
  | 'prompt_injection'
  | 'personal_data'
  | 'hate_or_harassment'
  | 'unsafe_request'

export type AdminVirtualTryOnPromptRule = {
  _id: string
  term: string
  category: PromptPolicyCategory
  reasonCode: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export type AdminVirtualTryOnPromptRuleList = {
  items: AdminVirtualTryOnPromptRule[]
  pagination: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
  }
}

export type AdminVirtualTryOnPromptRuleFilters = {
  page: number
  keyword: string
  category: PromptPolicyCategory | ''
  enabled: '' | 'true' | 'false'
}

export type AdminVirtualTryOnAccountLock = {
  user: {
    _id: string
    name: string
    email: string
    isActive: boolean
  }
  isLocked: boolean
  reason: string | null
  lockedBy: { _id: string; name: string; email: string } | null
  unlockedBy: { _id: string; name: string; email: string } | null
  lockedAt: string | null
  unlockedAt: string | null
  updatedAt: string
}

export type AdminVirtualTryOnAccountLockList = {
  items: AdminVirtualTryOnAccountLock[]
  pagination: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
  }
}

export type AdminVirtualTryOnAccountLockFilters = {
  page: number
  keyword: string
  locked: '' | 'true' | 'false'
}
