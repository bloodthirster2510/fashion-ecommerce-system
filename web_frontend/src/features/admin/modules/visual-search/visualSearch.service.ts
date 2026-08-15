import { requestAdmin } from '../../services/adminHttp'
import type {
  ProductVisualImageSource,
  VisualEmbeddingProvider,
  VisualIndexBackfillInput,
  VisualIndexBackfillResult,
  VisualIndexModelBreakdown,
  VisualIndexStatus,
  VisualIndexStatusItem,
} from './visualSearch.types'

const visualSources: ProductVisualImageSource[] = ['product_image', 'color_variant_image']
const visualProviders: VisualEmbeddingProvider[] = ['mock', 'http']

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const isFiniteNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
)

const isDateString = (value: unknown) => (
  typeof value === 'string' && value.trim() !== '' && !Number.isNaN(new Date(value).getTime())
)

const isOptionalDateString = (value: unknown) => value === undefined || isDateString(value)

const isVisualSource = (value: unknown): value is ProductVisualImageSource => (
  typeof value === 'string' && visualSources.includes(value as ProductVisualImageSource)
)

const isVisualProvider = (value: unknown): value is VisualEmbeddingProvider => (
  typeof value === 'string' && visualProviders.includes(value as VisualEmbeddingProvider)
)

const isStatusItem = (value: unknown): value is VisualIndexStatusItem => (
  isRecord(value) &&
  typeof value.galleryImageId === 'string' &&
  typeof value.productId === 'string' &&
  typeof value.imageUrl === 'string' &&
  isVisualSource(value.source) &&
  (value.isActive === undefined || typeof value.isActive === 'boolean') &&
  isOptionalDateString(value.lastSyncedAt)
)

const isModelBreakdown = (value: unknown): value is VisualIndexModelBreakdown => (
  isRecord(value) &&
  typeof value.model === 'string' &&
  typeof value.modelVersion === 'string' &&
  isFiniteNumber(value.activeCount) &&
  isFiniteNumber(value.inactiveCount) &&
  isOptionalDateString(value.lastSyncedAt)
)

const isSourceBreakdown = (value: unknown) => (
  isRecord(value) &&
  isVisualSource(value.source) &&
  isFiniteNumber(value.currentImageCount) &&
  isFiniteNumber(value.indexedImageCount)
)

const parseVisualIndexStatus = (value: unknown): VisualIndexStatus => {
  if (!isRecord(value)) {
    throw new Error('Dữ liệu visual search index không hợp lệ.')
  }

  const valid = (
    isDateString(value.generatedAt) &&
    isVisualProvider(value.provider) &&
    typeof value.model === 'string' &&
    typeof value.modelVersion === 'string' &&
    [
      'productCount',
      'activeProductCount',
      'imageCount',
      'activeImageCount',
      'indexedImageCount',
      'missingImageCount',
      'staleActiveIndexCount',
      'inactiveIndexCount',
      'coverageRate',
    ].every((field) => isFiniteNumber(value[field])) &&
    isOptionalDateString(value.lastIndexedAt) &&
    isOptionalDateString(value.lastSyncedAt) &&
    Array.isArray(value.sourceBreakdown) &&
    value.sourceBreakdown.every(isSourceBreakdown) &&
    Array.isArray(value.modelBreakdown) &&
    value.modelBreakdown.every(isModelBreakdown) &&
    isRecord(value.samples) &&
    Array.isArray(value.samples.missing) &&
    value.samples.missing.every(isStatusItem) &&
    Array.isArray(value.samples.stale) &&
    value.samples.stale.every(isStatusItem)
  )

  if (!valid) {
    throw new Error('Dữ liệu visual search index không hợp lệ.')
  }

  return value as VisualIndexStatus
}

const parseBackfillResult = (value: unknown): VisualIndexBackfillResult => {
  if (!isRecord(value)) {
    throw new Error('Dữ liệu kết quả re-index không hợp lệ.')
  }

  const valid = (
    typeof value.dryRun === 'boolean' &&
    typeof value.activeOnly === 'boolean' &&
    ['productCount', 'imageCount', 'indexed', 'staleDeactivated', 'failed'].every((field) => isFiniteNumber(value[field])) &&
    typeof value.model === 'string' &&
    typeof value.modelVersion === 'string' &&
    isVisualProvider(value.provider) &&
    Array.isArray(value.failures) &&
    value.failures.every((failure) => (
      isRecord(failure) &&
      typeof failure.galleryImageId === 'string' &&
      typeof failure.imageUrl === 'string' &&
      typeof failure.message === 'string'
    ))
  )

  if (!valid) {
    throw new Error('Dữ liệu kết quả re-index không hợp lệ.')
  }

  return value as VisualIndexBackfillResult
}

export const getVisualIndexStatus = async () => {
  const response = await requestAdmin<unknown>('/admin/visual-search/index')
  return parseVisualIndexStatus(response)
}

export const backfillVisualIndex = async (input: VisualIndexBackfillInput) => {
  const response = await requestAdmin<unknown>('/admin/visual-search/index/backfill', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return parseBackfillResult(response)
}
