export type VirtualTryOnJobStatus = 'queued' | 'processing' | 'succeeded' | 'failed' | 'canceled'
export type VirtualTryOnVideoStatus = 'not_requested' | 'queued' | 'processing' | 'succeeded' | 'failed' | 'canceled'
export type VirtualTryOnProcessingStage = 'queued' | 'image_generation' | 'image_persisting' | 'video_generation' | 'video_persisting' | 'completed'

export type AdminVirtualTryOnJob = {
  _id: string
  user: {
    _id: string
    name: string
    email: string
  } | null
  status: VirtualTryOnJobStatus
  progress: number
  processingStage: VirtualTryOnProcessingStage
  outfitMode: 'single' | 'top_bottom' | 'full_set'
  contextPreset: string
  contextPrompt?: string
  outputMode: 'image' | 'image_and_video'
  videoDurationSeconds?: number | null
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
  videoStatus: VirtualTryOnVideoStatus
  videoProgress: number
  videoSourceImageUrl?: string | null
  videoProvider?: string | null
  videoProviderJobId?: string | null
  videoErrorCode?: string | null
  videoErrorMessage?: string | null
  videoStartedAt?: string | null
  videoCompletedAt?: string | null
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
  videoRequested: number
  videoProcessing: number
  videoSucceeded: number
  videoFailed: number
  promptViolationsToday: number
  promptBlocksToday: number
  latestFailedJobs: AdminVirtualTryOnJob[]
  generatedAt: string
}

export type AdminVirtualTryOnSettings = {
  provider: string
  enabled: boolean
  runtimeEnabled: boolean
  version: number
  persisted: boolean
  updatedAt: string | null
  historyVersions: number[]
  secretStatus: {
    providerApiKeyConfigured: boolean
    imageEndpointConfigured: boolean
    videoWorkflowConfigured: boolean
  }
  imageValidation: {
    requestedProvider: string
    provider: string
    configured: boolean
    fallback: boolean
    failOpen: boolean
    available: boolean
    reasonCode: string | null
    latencyMs: number | null
    checkedAt: string
  }
  image: {
    enabled: boolean
    provider: string
    model: string
    aspectRatio: string
    resolution: string
    outputCount: number
  }
  videoEnabled: boolean
  video: {
    enabled: boolean
    available: boolean
    reasonCode: string | null
    provider: string
    model: string
    durationSeconds: number
    minDurationSeconds: number
    maxDurationSeconds: number
    resolution: string
    generateAudio: boolean
  }
  maxSelectedItems: number
  maxConcurrentJobsPerUser: number
  maxVideoJobsPerUserPerDay: number
  maxConcurrentVideoJobsPerUser: number
  sourceImageMaxMb: number
  promptMaxLength: number
  promptViolationLimitPerDay: number
}

export type AdminVirtualTryOnSettingsConfiguration = Pick<
  AdminVirtualTryOnSettings,
  | 'runtimeEnabled'
  | 'maxConcurrentJobsPerUser'
  | 'maxVideoJobsPerUserPerDay'
  | 'maxConcurrentVideoJobsPerUser'
  | 'promptMaxLength'
  | 'promptViolationLimitPerDay'
>

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
