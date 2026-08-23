export type ProductVisualImageSource = 'product_image' | 'color_variant_image'
export type VisualEmbeddingProvider = 'mock' | 'http'

export type VisualIndexStatusItem = {
  galleryImageId: string
  productId: string
  imageUrl: string
  source: ProductVisualImageSource
  isActive?: boolean
  lastSyncedAt?: string
}

export type VisualIndexModelBreakdown = {
  model: string
  modelVersion: string
  activeCount: number
  inactiveCount: number
  lastSyncedAt?: string
}

export type VisualIndexStatus = {
  generatedAt: string
  provider: VisualEmbeddingProvider
  model: string
  modelVersion: string
  productCount: number
  activeProductCount: number
  imageCount: number
  activeImageCount: number
  indexedImageCount: number
  missingImageCount: number
  staleActiveIndexCount: number
  inactiveIndexCount: number
  coverageRate: number
  lastIndexedAt?: string
  lastSyncedAt?: string
  sourceBreakdown: Array<{
    source: ProductVisualImageSource
    currentImageCount: number
    indexedImageCount: number
  }>
  modelBreakdown: VisualIndexModelBreakdown[]
  samples: {
    missing: VisualIndexStatusItem[]
    stale: VisualIndexStatusItem[]
  }
}

export type VisualIndexBackfillInput = {
  activeOnly?: boolean
  dryRun?: boolean
  limit?: number
}

export type VisualIndexBackfillResult = {
  dryRun: boolean
  activeOnly: boolean
  productCount: number
  imageCount: number
  indexed: number
  staleDeactivated: number
  invalidMetadataDeactivated: number
  failed: number
  model: string
  modelVersion: string
  provider: VisualEmbeddingProvider
  failures: Array<{
    galleryImageId: string
    imageUrl: string
    message: string
  }>
}
