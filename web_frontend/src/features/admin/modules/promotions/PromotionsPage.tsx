import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { AdminUser } from '../auth/adminSession'
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility'
import { listMembershipRankings } from '../loyalty/loyalty.service'
import type { MembershipRanking } from '../loyalty/loyalty.types'
import {
  checkCouponCodeAvailability,
  createCoupon,
  duplicateCoupon,
  deleteCoupon,
  getCoupon,
  listCouponCategories,
  listCouponProducts,
  listCouponUsage,
  listCoupons,
  previewCoupon,
  updateCoupon,
  updateCouponStatus,
} from './promotion.service'
import type {
  AdminCoupon,
  CategoryOption,
  CouponDiscountType,
  CouponEligibleUserType,
  CouponPayload,
  CouponPreview,
  CouponUsageItem,
  CouponUsageListResponse,
  ProductOption,
} from './promotion.types'
import type { PickerOption } from './components/OptionPicker'
import { useToast } from '../../notifications/notification-context'
import { requestAdminNotificationRefresh } from '../../notifications/notification-summary-events'
import {
  Pagination,
} from '../../components/ui'
import './promotion.css'
import { CouponBulkDeleteDialog, CouponDeleteDialog } from './components/CouponDeleteDialogs'
import { CouponDetailDialog } from './components/CouponDetailDialog'
import { CouponFormDialog } from './components/CouponFormDialog'
import { CouponTablePanel } from './components/CouponTablePanel'
import { CampaignAnalyticsPanel } from './components/CampaignAnalyticsPanel'
import { PromotionBulkToolbar } from './components/PromotionBulkToolbar'
import { PromotionFilterBar } from './components/PromotionFilterBar'
import { PromotionKpiSummary } from './components/PromotionKpiSummary'

type PromotionsPageProps = {
  currentUser: AdminUser
}

type Notice = {
  type: 'success' | 'error'
  message: string
}

type CouponStatusFilter = 'all' | 'active' | 'inactive' | 'expired' | 'upcoming'
type CouponDisplayStatus = Exclude<CouponStatusFilter, 'all'>
type CouponSort = 'created_desc' | 'created_asc' | 'end_asc' | 'usage_desc' | 'code_asc'
type CouponDiscountFilter = 'all' | CouponDiscountType
type CouponVisibilityFilter = 'all' | 'public' | 'private'
type CouponAudienceFilter = 'all_filter' | CouponEligibleUserType

type CouponFormState = {
  code: string
  name: string
  description: string
  discountType: CouponDiscountType
  discountValue: string
  maxDiscountAmount: string
  minOrderAmount: string
  usageLimit: string
  perUserLimit: string
  isPublic: boolean
  eligibleUserTypes: CouponEligibleUserType[]
  eligibleMembershipRanks: string[]
  applicableProducts: string[]
  applicableCategories: string[]
  startAt: string
  endAt: string
  isActive: boolean
}

type DialogState =
  | { type: 'create' }
  | { type: 'duplicate'; coupon: AdminCoupon }
  | { type: 'edit'; coupon: AdminCoupon }
  | { type: 'detail'; coupon: AdminCoupon; usage: CouponUsageListResponse }
  | { type: 'delete'; coupon: AdminCoupon; usageCount: number }
  | { type: 'bulk-delete'; coupons: AdminCoupon[] }
  | null

type CouponSelectionField = 'eligibleMembershipRanks' | 'applicableProducts' | 'applicableCategories'
type CouponFieldErrors = Partial<Record<keyof CouponFormState, string>>
type CodeAvailabilityState = 'idle' | 'checking' | 'available' | 'taken'
type CouponScopeMode = 'all' | 'category' | 'product'

const pageSize = 10
const couponDraftKey = 'fashionista.admin.coupon-draft'

const displayStatusMeta: Record<CouponDisplayStatus, { label: string; className: string }> = {
  active: { label: 'Đang chạy', className: 'is-active' },
  inactive: { label: 'Tạm tắt', className: 'is-blocked' },
  expired: { label: 'Hết hạn', className: 'is-expired' },
  upcoming: { label: 'Sắp mở', className: 'is-warning' },
}

const displayStatusTone: Record<CouponDisplayStatus, 'success' | 'neutral' | 'danger' | 'warning'> = {
  active: 'success',
  inactive: 'neutral',
  expired: 'danger',
  upcoming: 'warning',
}

const eligibleUserTypeOptions: Array<{ value: CouponEligibleUserType; label: string }> = [
  { value: 'all', label: 'Tất cả khách' },
  { value: 'new_user', label: 'Khách mới' },
  { value: 'member', label: 'Thành viên có ưu đãi' },
]

const discountTypeLabels: Record<CouponDiscountType, string> = {
  percent: 'Giảm theo phần trăm',
  fixed: 'Giảm số tiền',
  free_shipping: 'Miễn phí vận chuyển',
}

const discountTypeDescriptions: Record<CouponDiscountType, string> = {
  percent: 'Có thể đặt mức giảm tối đa',
  fixed: 'Trừ thẳng vào giá trị đơn',
  free_shipping: 'Không cần nhập giá trị giảm',
}

const discountTypeSymbols: Record<CouponDiscountType, string> = {
  percent: '%',
  fixed: '₫',
  free_shipping: 'Ship',
}

const percentPresets = ['5', '10', '15', '20']
const fixedPresets = ['50000', '100000', '200000']
const durationPresets = [
  { label: '7 ngày', days: 7 },
  { label: '14 ngày', days: 14 },
  { label: '30 ngày', days: 30 },
  { label: '60 ngày', days: 60 },
]

const couponTemplates: Array<{ label: string; description: string; values: Partial<CouponFormState>; durationDays: number }> = [
  { label: 'Chào mừng khách mới', description: 'Giảm 10% · mỗi khách 1 lần', values: { name: 'Chào mừng khách mới', discountType: 'percent', discountValue: '10', maxDiscountAmount: '100000', minOrderAmount: '200000', perUserLimit: '1', eligibleUserTypes: ['new_user'], isPublic: true }, durationDays: 30 },
  { label: 'Miễn phí vận chuyển', description: 'Cho đơn từ 300K · toàn shop', values: { name: 'Miễn phí vận chuyển đơn từ 300K', discountType: 'free_shipping', discountValue: '0', maxDiscountAmount: '', minOrderAmount: '300000', perUserLimit: '1', eligibleUserTypes: ['all'], isPublic: true }, durationDays: 30 },
  { label: 'Tri ân thành viên', description: 'Giảm 15% · dành cho thành viên', values: { name: 'Tri ân thành viên', discountType: 'percent', discountValue: '15', maxDiscountAmount: '200000', minOrderAmount: '500000', perUserLimit: '1', eligibleUserTypes: ['member'], isPublic: false }, durationDays: 14 },
]

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)
const formatNumber = (value: number) => new Intl.NumberFormat('vi-VN').format(Number.isFinite(value) ? value : 0)

const formatDateTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const toDateTimeInputValue = (date: Date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

const createEmptyCouponForm = (): CouponFormState => {
  const startDate = new Date()
  const endDate = new Date()
  endDate.setDate(endDate.getDate() + 30)

  return {
    code: '',
    name: '',
    description: '',
    discountType: 'percent',
    discountValue: '10',
    maxDiscountAmount: '',
    minOrderAmount: '0',
    usageLimit: '',
    perUserLimit: '1',
    isPublic: true,
    eligibleUserTypes: ['all'],
    eligibleMembershipRanks: [],
    applicableProducts: [],
    applicableCategories: [],
    startAt: toDateTimeInputValue(startDate),
    endAt: toDateTimeInputValue(endDate),
    isActive: true,
  }
}

const getCouponScopeModeFromForm = (form: CouponFormState): CouponScopeMode => {
  if (form.applicableProducts.length) return 'product'
  if (form.applicableCategories.length) return 'category'
  return 'all'
}

const normalizeId = (value: unknown) => {
  if (typeof value === 'string') {
    return value
  }

  if (value && typeof value === 'object' && '_id' in value) {
    return String((value as { _id: unknown })._id)
  }

  return value?.toString() ?? ''
}

const normalizeIds = (values: unknown[] | undefined) =>
  (values ?? []).map(normalizeId).filter(Boolean)

const getCouponUsageUser = (usage: CouponUsageItem) => {
  if (typeof usage.userId === 'string') {
    return usage.userId
  }

  return usage.userId.name || usage.userId.email || usage.userId.phone || usage.userId._id
}

const getCouponUsageOrder = (usage: CouponUsageItem) => {
  if (typeof usage.orderId === 'string') {
    return usage.orderId
  }

  return usage.orderId.orderCode || usage.orderId._id
}

const getCouponActorLabel = (actor: AdminCoupon['createdBy']) => {
  if (!actor) {
    return 'Không có dữ liệu'
  }

  if (typeof actor === 'string') {
    return actor
  }

  return actor.name || actor.email || actor._id
}

const normalizeSearchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const buildCouponCode = (name: string) => {
  const baseCode = normalizeSearchText(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 22)

  return baseCode || `VOUCHER${Math.floor(1000 + Math.random() * 9000)}`
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Không thể xử lý yêu cầu'

const getCouponStatus = (coupon: AdminCoupon): CouponDisplayStatus => {
  const now = Date.now()
  const startTime = new Date(coupon.startAt).getTime()
  const endTime = new Date(coupon.endAt).getTime()

  if (!coupon.isActive) {
    return 'inactive'
  }

  if (Number.isFinite(startTime) && startTime > now) {
    return 'upcoming'
  }

  if (Number.isFinite(endTime) && endTime < now) {
    return 'expired'
  }

  return 'active'
}

const toCouponForm = (coupon: AdminCoupon): CouponFormState => ({
  code: coupon.code,
  name: coupon.name,
  description: coupon.description ?? '',
  discountType: coupon.discountType,
  discountValue: String(coupon.discountType === 'free_shipping' ? 0 : coupon.discountValue),
  maxDiscountAmount: coupon.maxDiscountAmount === null || coupon.maxDiscountAmount === undefined
    ? ''
    : String(coupon.maxDiscountAmount),
  minOrderAmount: String(coupon.minOrderAmount ?? 0),
  usageLimit: coupon.usageLimit === null || coupon.usageLimit === undefined ? '' : String(coupon.usageLimit),
  perUserLimit: String(coupon.perUserLimit ?? 1),
  isPublic: coupon.isPublic,
  eligibleUserTypes: coupon.eligibleUserTypes?.length ? coupon.eligibleUserTypes : ['all'],
  eligibleMembershipRanks: normalizeIds(coupon.eligibleMembershipRanks),
  applicableProducts: normalizeIds(coupon.applicableProducts),
  applicableCategories: normalizeIds(coupon.applicableCategories),
  startAt: toDateTimeInputValue(new Date(coupon.startAt)),
  endAt: toDateTimeInputValue(new Date(coupon.endAt)),
  isActive: coupon.isActive,
})

const parseOptionalLimit = (value: string, fieldName: string) => {
  if (!value.trim()) {
    return null
  }

  const numericValue = Number(value)
  if (!Number.isInteger(numericValue) || numericValue < 1) {
    throw new Error(`${fieldName} phải là số nguyên từ 1 trở lên`)
  }

  return numericValue
}

const assertMoneyValue = (value: number, fieldName: string) => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} không hợp lệ`)
  }
}

const toCouponPayload = (form: CouponFormState): CouponPayload => {
  const code = form.code.trim().toUpperCase()
  const name = form.name.trim()
  const startAt = new Date(form.startAt)
  const endAt = new Date(form.endAt)
  const discountValue = form.discountType === 'free_shipping' ? 0 : Number(form.discountValue)
  const minOrderAmount = Number(form.minOrderAmount)
  const maxDiscountAmount = form.discountType === 'percent' && form.maxDiscountAmount.trim()
    ? Number(form.maxDiscountAmount)
    : null
  const usageLimit = parseOptionalLimit(form.usageLimit, 'Giới hạn lượt dùng')
  const perUserLimit = parseOptionalLimit(form.perUserLimit, 'Giới hạn mỗi khách')

  if (!/^[A-Z0-9_-]{2,40}$/.test(code)) {
    throw new Error('Mã voucher chỉ gồm chữ in hoa, số, gạch dưới hoặc gạch ngang')
  }

  if (name.length < 2) {
    throw new Error('Tên voucher tối thiểu 2 ký tự')
  }

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
    throw new Error('Thời gian kết thúc phải sau thời gian bắt đầu')
  }

  if (form.discountType === 'percent' && (discountValue <= 0 || discountValue > 100)) {
    throw new Error('Voucher phần trăm phải nằm trong khoảng 1-100')
  }

  if (form.discountType === 'fixed' && discountValue <= 0) {
    throw new Error('Voucher giảm tiền phải lớn hơn 0')
  }

  assertMoneyValue(minOrderAmount, 'Đơn tối thiểu')

  if (maxDiscountAmount !== null) {
    assertMoneyValue(maxDiscountAmount, 'Mức giảm tối đa')
  }

  if (perUserLimit === null) {
    throw new Error('Giới hạn mỗi khách là bắt buộc')
  }

  return {
    code,
    name,
    description: form.description.trim() || null,
    discountType: form.discountType,
    discountValue,
    maxDiscountAmount,
    minOrderAmount,
    usageLimit,
    perUserLimit,
    isPublic: form.isPublic,
    eligibleUserTypes: form.eligibleUserTypes.length ? form.eligibleUserTypes : ['all'],
    eligibleMembershipRanks: form.eligibleMembershipRanks,
    applicableProducts: form.applicableProducts,
    applicableCategories: form.applicableCategories,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    isActive: form.isActive,
  }
}

const validateCouponForm = (form: CouponFormState): CouponFieldErrors => {
  const errors: CouponFieldErrors = {}
  const code = form.code.trim().toUpperCase()
  const discountValue = Number(form.discountValue)
  const minOrderAmount = Number(form.minOrderAmount)
  const maxDiscountAmount = Number(form.maxDiscountAmount)
  const usageLimit = Number(form.usageLimit)
  const perUserLimit = Number(form.perUserLimit)
  const startAt = new Date(form.startAt)
  const endAt = new Date(form.endAt)

  if (!/^[A-Z0-9_-]{2,40}$/.test(code)) errors.code = 'Dùng 2–40 ký tự in hoa, số, “_” hoặc “-”.'
  if (form.name.trim().length < 2) errors.name = 'Tên voucher cần ít nhất 2 ký tự.'
  if (form.discountType === 'percent' && (!Number.isFinite(discountValue) || discountValue <= 0 || discountValue > 100)) errors.discountValue = 'Nhập phần trăm từ 1 đến 100.'
  if (form.discountType === 'fixed' && (!Number.isFinite(discountValue) || discountValue <= 0)) errors.discountValue = 'Số tiền giảm phải lớn hơn 0.'
  if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) errors.minOrderAmount = 'Đơn tối thiểu không hợp lệ.'
  if (form.maxDiscountAmount && (!Number.isFinite(maxDiscountAmount) || maxDiscountAmount < 0)) errors.maxDiscountAmount = 'Mức giảm tối đa không hợp lệ.'
  if (form.usageLimit && (!Number.isInteger(usageLimit) || usageLimit < 1)) errors.usageLimit = 'Nhập số nguyên từ 1 trở lên.'
  if (!Number.isInteger(perUserLimit) || perUserLimit < 1) errors.perUserLimit = 'Nhập số nguyên từ 1 trở lên.'
  if (Number.isNaN(startAt.getTime())) errors.startAt = 'Chọn thời gian bắt đầu.'
  if (Number.isNaN(endAt.getTime()) || endAt <= startAt) errors.endAt = 'Kết thúc phải sau thời gian bắt đầu.'

  return errors
}

export function PromotionsPage({ currentUser }: PromotionsPageProps) {
  const { showToast } = useToast()
  const [coupons, setCoupons] = useState<AdminCoupon[]>([])
  const [tiers, setTiers] = useState<MembershipRanking[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<CouponStatusFilter>('all')
  const [discountFilter, setDiscountFilter] = useState<CouponDiscountFilter>('all')
  const [visibilityFilter, setVisibilityFilter] = useState<CouponVisibilityFilter>('all')
  const [audienceFilter, setAudienceFilter] = useState<CouponAudienceFilter>('all_filter')
  const [rankFilter, setRankFilter] = useState('')
  const [dateFromFilter, setDateFromFilter] = useState('')
  const [dateToFilter, setDateToFilter] = useState('')
  const [sort, setSort] = useState<CouponSort>('created_desc')
  const [page, setPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [tierReferenceError, setTierReferenceError] = useState('')
  const [categoryReferenceError, setCategoryReferenceError] = useState('')
  const [productReferenceError, setProductReferenceError] = useState('')
  const [isSearchingProducts, setIsSearchingProducts] = useState(false)
  const [productSearchQuery, setProductSearchQuery] = useState('')
  const [productPage, setProductPage] = useState(1)
  const [productTotal, setProductTotal] = useState(0)
  const [productTotalPages, setProductTotalPages] = useState(1)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [couponForm, setCouponForm] = useState<CouponFormState>(() => createEmptyCouponForm())
  const [couponStep, setCouponStep] = useState(1)
  const [showAdvancedCouponOptions, setShowAdvancedCouponOptions] = useState(false)
  const [showCouponErrors, setShowCouponErrors] = useState(false)
  const [codeAvailability, setCodeAvailability] = useState<CodeAvailabilityState>('idle')
  const [usageSearch, setUsageSearch] = useState('')
  const [usageDateFrom, setUsageDateFrom] = useState('')
  const [usageDateTo, setUsageDateTo] = useState('')
  const [couponSummary, setCouponSummary] = useState({ totalCoupons: 0, usedCount: 0, activeCount: 0, publicCount: 0 })
  const [sampleSubTotal, setSampleSubTotal] = useState('500000')
  const [sampleShippingFee, setSampleShippingFee] = useState('30000')
  const [couponPreview, setCouponPreview] = useState<CouponPreview | null>(null)
  const [couponScopeMode, setCouponScopeModeState] = useState<CouponScopeMode>('all')
  const [draftRestored, setDraftRestored] = useState(false)
  const [selectedCouponIds, setSelectedCouponIds] = useState<string[]>([])
  const productSearchRequestId = useRef(0)
  const couponErrors = useMemo(() => validateCouponForm(couponForm), [couponForm])

  const hasPermission = useCallback(
    (permission: string) => currentUser.role === 'admin' || currentUser.permissions?.includes(permission) === true,
    [currentUser.permissions, currentUser.role],
  )

  const canManagePromotions = hasPermission('promotions.write')
  const canReadCatalog = hasPermission('catalog.read')
  const canReadProducts = hasPermission('products.read')

  const rankNameById = useMemo(() => {
    const map = new Map<string, string>()
    tiers.forEach((tier) => {
      if (tier._id) {
        map.set(tier._id, tier.name)
      }
    })

    return map
  }, [tiers])

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>()
    categories.forEach((category) => map.set(category._id, category.name))
    return map
  }, [categories])

  const productNameById = useMemo(() => {
    const map = new Map<string, string>()
    products.forEach((product) => map.set(product._id, product.name))
    return map
  }, [products])

  const tierOptions = useMemo<PickerOption[]>(
    () =>
      tiers
        .filter((tier) => tier._id)
        .map((tier) => ({
          value: tier._id as string,
          label: tier.name?.trim() || `Hạng ${tier.level}`,
          meta: [
            `Từ ${new Intl.NumberFormat('vi-VN').format(tier.minPoint)} điểm`,
            typeof tier.memberCount === 'number' ? `${new Intl.NumberFormat('vi-VN').format(tier.memberCount)} thành viên` : '',
          ].filter(Boolean).join(' · '),
        })),
    [tiers],
  )

  const categoryOptions = useMemo<PickerOption[]>(
    () =>
      categories.map((category) => ({
        value: category._id,
        label: category.name,
        meta: [category.gender, category.level ? `Level ${category.level}` : ''].filter(Boolean).join(' • '),
      })),
    [categories],
  )

  const productOptions = useMemo<PickerOption[]>(
    () =>
      products.map((product) => ({
        value: product._id,
        label: product.name,
        meta: product.category?.name,
      })),
    [products],
  )

  const categoryScopeShortcuts = useMemo(
    () =>
      [
        { key: 'tops', label: 'Toàn bộ áo', keywords: ['ao', 'shirt', 'top'] },
        { key: 'bottoms', label: 'Toàn bộ quần', keywords: ['quan', 'pants', 'jean'] },
        { key: 'dresses', label: 'Váy / đầm', keywords: ['vay', 'dam', 'dress', 'skirt'] },
        { key: 'shoes', label: 'Giày / dép', keywords: ['giay', 'dep', 'shoe', 'sandal'] },
      ].map((shortcut) => {
        const categoryIds = categoryOptions
          .filter((option) => {
            const optionText = normalizeSearchText(`${option.label} ${option.meta ?? ''}`)
            return shortcut.keywords.some((keyword) => optionText.includes(keyword))
          })
          .map((option) => option.value)

        return { ...shortcut, categoryIds }
      }),
    [categoryOptions],
  )

  const loadCoupons = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const result = await listCoupons({
        keyword,
        status: statusFilter,
        discountType: discountFilter,
        visibility: visibilityFilter,
        eligibleUserType: audienceFilter,
        eligibleMembershipRank: rankFilter || undefined,
        dateFrom: dateFromFilter || undefined,
        dateTo: dateToFilter || undefined,
        sort,
        page,
        limit: pageSize,
      })

      setCoupons(result.items)
      setCouponSummary(result.summary)
      setTotalItems(result.pagination.totalItems)
      setTotalPages(Math.max(1, result.pagination.totalPages))
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [audienceFilter, dateFromFilter, dateToFilter, discountFilter, keyword, page, rankFilter, sort, statusFilter, visibilityFilter])

  const loadReferences = useCallback(async () => {
    setTierReferenceError('')
    setCategoryReferenceError('')
    setProductReferenceError('')
    const [tierResult, categoryResult, productResult] = await Promise.allSettled([
      listMembershipRankings(),
      canReadCatalog ? listCouponCategories() : Promise.resolve([]),
      canReadProducts ? listCouponProducts() : Promise.resolve([]),
    ])

    if (tierResult.status === 'fulfilled') {
      setTiers(tierResult.value)
    } else {
      setTierReferenceError('Không tải được danh sách hạng thành viên.')
    }

    if (categoryResult.status === 'fulfilled') {
      setCategories(categoryResult.value)
    } else {
      setCategoryReferenceError('Không tải được danh mục áp dụng.')
    }

    if (productResult.status === 'fulfilled') {
      if (Array.isArray(productResult.value)) {
        setProducts(productResult.value)
        setProductTotal(productResult.value.length)
      } else {
        setProducts(productResult.value.items)
        setProductPage(productResult.value.pagination.page)
        setProductTotal(productResult.value.pagination.totalItems)
        setProductTotalPages(Math.max(1, productResult.value.pagination.totalPages))
      }
    } else {
      setProductReferenceError('Không tải được sản phẩm áp dụng.')
    }
  }, [canReadCatalog, canReadProducts])

  const searchProducts = useCallback(async (query: string, nextPage = 1) => {
    if (!canReadProducts) {
      return
    }

    const requestId = productSearchRequestId.current + 1
    productSearchRequestId.current = requestId
    setIsSearchingProducts(true)

    try {
      const result = await listCouponProducts(query, nextPage)
      if (requestId !== productSearchRequestId.current) {
        return
      }

      setProducts((currentProducts) => {
        const productById = new Map(currentProducts.map((product) => [product._id, product]))
        result.items.forEach((product) => productById.set(product._id, product))
        return Array.from(productById.values())
      })
      setProductSearchQuery(query)
      setProductPage(result.pagination.page)
      setProductTotal(result.pagination.totalItems)
      setProductTotalPages(Math.max(1, result.pagination.totalPages))
      setProductReferenceError('')
    } catch (error) {
      if (requestId === productSearchRequestId.current) {
        setProductReferenceError(getErrorMessage(error))
      }
    } finally {
      if (requestId === productSearchRequestId.current) {
        setIsSearchingProducts(false)
      }
    }
  }, [canReadProducts])

  const loadMoreProducts = () => {
    if (!isSearchingProducts && productPage < productTotalPages) {
      void searchProducts(productSearchQuery, productPage + 1)
    }
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setPage(1)
      setKeyword(keywordInput.trim())
    }, 320)

    return () => window.clearTimeout(handle)
  }, [keywordInput])

  useEffect(() => {
    void loadCoupons()
  }, [loadCoupons])

  useEffect(() => {
    void loadReferences()
  }, [loadReferences])

  useEffect(() => {
    if (!dialog || (dialog.type !== 'create' && dialog.type !== 'duplicate' && dialog.type !== 'edit')) return
    const code = couponForm.code.trim().toUpperCase()
    if (!/^[A-Z0-9_-]{2,40}$/.test(code)) {
      setCodeAvailability('idle')
      return
    }

    setCodeAvailability('checking')
    const handle = window.setTimeout(() => {
      void checkCouponCodeAvailability(code, dialog.type === 'edit' ? dialog.coupon._id : undefined)
        .then((result) => setCodeAvailability(result.available ? 'available' : 'taken'))
        .catch(() => setCodeAvailability('idle'))
    }, 350)
    return () => window.clearTimeout(handle)
  }, [couponForm.code, dialog])

  useEffect(() => {
    if (!dialog || !['create', 'duplicate', 'edit'].includes(dialog.type) || Object.keys(couponErrors).length) {
      setCouponPreview(null)
      return
    }
    const subTotal = Number(sampleSubTotal)
    const shippingFee = Number(sampleShippingFee)
    if (!Number.isFinite(subTotal) || subTotal < 0 || !Number.isFinite(shippingFee) || shippingFee < 0) {
      setCouponPreview(null)
      return
    }
    const handle = window.setTimeout(() => {
      try {
        void previewCoupon(toCouponPayload(couponForm), subTotal, shippingFee)
          .then(setCouponPreview)
          .catch(() => setCouponPreview(null))
      } catch {
        setCouponPreview(null)
      }
    }, 300)
    return () => window.clearTimeout(handle)
  }, [couponErrors, couponForm, dialog, sampleShippingFee, sampleSubTotal])

  useEffect(() => {
    if (dialog?.type !== 'create') return
    if (!couponForm.code.trim() && !couponForm.name.trim() && !couponForm.description.trim()) {
      window.localStorage.removeItem(couponDraftKey)
      return
    }
    const handle = window.setTimeout(() => {
      window.localStorage.setItem(couponDraftKey, JSON.stringify(couponForm))
    }, 400)
    return () => window.clearTimeout(handle)
  }, [couponForm, dialog?.type])

  useEffect(() => {
    const visibleIds = new Set(coupons.map((coupon) => coupon._id))
    setSelectedCouponIds((ids) => ids.filter((id) => visibleIds.has(id)))
  }, [coupons])

  useEffect(() => {
    if (!notice) {
      return
    }
    showToast(notice.message, notice.type)
    const handle = window.setTimeout(() => setNotice(null), 5000)
    return () => window.clearTimeout(handle)
  }, [notice, showToast])

  const replaceCoupon = (updatedCoupon: AdminCoupon) => {
    setCoupons((currentCoupons) =>
      currentCoupons.map((coupon) => (coupon._id === updatedCoupon._id ? updatedCoupon : coupon)),
    )
  }

  const openCreateDialog = useCallback(() => {
    const emptyForm = createEmptyCouponForm()
    const rawDraft = window.localStorage.getItem(couponDraftKey)
    if (rawDraft) {
      try {
        const draftForm = { ...emptyForm, ...(JSON.parse(rawDraft) as Partial<CouponFormState>) }
        setCouponForm(draftForm)
        setCouponScopeModeState(getCouponScopeModeFromForm(draftForm))
        setDraftRestored(true)
      } catch {
        window.localStorage.removeItem(couponDraftKey)
        setCouponForm(emptyForm)
        setCouponScopeModeState('all')
        setDraftRestored(false)
      }
    } else {
      setCouponForm(emptyForm)
      setCouponScopeModeState('all')
      setDraftRestored(false)
    }
    setNotice(null)
    setCouponStep(1)
    setShowAdvancedCouponOptions(false)
    setShowCouponErrors(false)
    setCodeAvailability('idle')
    setDialog({ type: 'create' })
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!canManagePromotions || params.get('action') !== 'create') return

    openCreateDialog()
    params.delete('action')
    const query = params.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
  }, [canManagePromotions, openCreateDialog])

  const openEditDialog = (coupon: AdminCoupon) => {
    const nextForm = toCouponForm(coupon)
    setCouponForm(nextForm)
    setCouponScopeModeState(getCouponScopeModeFromForm(nextForm))
    setNotice(null)
    setCouponStep(1)
    setShowAdvancedCouponOptions(true)
    setShowCouponErrors(false)
    setCodeAvailability('idle')
    setDraftRestored(false)
    setDialog({ type: 'edit', coupon })
  }

  const openDuplicateDialog = (coupon: AdminCoupon) => {
    const nextForm = {
      ...toCouponForm(coupon),
      code: `${coupon.code.slice(0, 35)}_COPY`,
      name: `${coupon.name} (bản sao)`,
      isActive: false,
    }
    setCouponForm(nextForm)
    setCouponScopeModeState(getCouponScopeModeFromForm(nextForm))
    setNotice(null)
    setCouponStep(1)
    setShowAdvancedCouponOptions(true)
    setShowCouponErrors(false)
    setCodeAvailability('idle')
    setDraftRestored(false)
    setDialog({ type: 'duplicate', coupon })
  }

  const openDetailDialog = async (coupon: AdminCoupon) => {
    setActionLoading(true)
    setNotice(null)
    setUsageSearch('')
    setUsageDateFrom('')
    setUsageDateTo('')

    try {
      const [detail, usage] = await Promise.all([
        getCoupon(coupon._id),
        listCouponUsage(coupon._id),
      ])
      setDialog({ type: 'detail', coupon: detail.coupon, usage })
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const loadCouponUsagePage = async (pageNumber: number) => {
    if (!dialog || dialog.type !== 'detail') {
      return
    }

    setActionLoading(true)
    try {
      const usage = await listCouponUsage(dialog.coupon._id, pageNumber, 10, {
        keyword: usageSearch,
        dateFrom: usageDateFrom || undefined,
        dateTo: usageDateTo || undefined,
      })
      setDialog({ ...dialog, usage })
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const detailCouponId = dialog?.type === 'detail' ? dialog.coupon._id : ''
  useEffect(() => {
    if (!detailCouponId) return
    const handle = window.setTimeout(async () => {
      try {
        const usage = await listCouponUsage(detailCouponId, 1, 10, {
          keyword: usageSearch,
          dateFrom: usageDateFrom || undefined,
          dateTo: usageDateTo || undefined,
        })
        setDialog((current) => current?.type === 'detail' && current.coupon._id === detailCouponId
          ? { ...current, usage }
          : current)
      } catch (error) {
        setNotice({ type: 'error', message: getErrorMessage(error) })
      }
    }, 350)
    return () => window.clearTimeout(handle)
  }, [detailCouponId, usageDateFrom, usageDateTo, usageSearch])

  const openDeleteDialog = async (coupon: AdminCoupon) => {
    setActionLoading(true)
    setNotice(null)

    try {
      const detail = await getCoupon(coupon._id)
      setDialog({ type: 'delete', coupon: detail.coupon, usageCount: detail.usageCount })
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const closeDialog = () => {
    if (!actionLoading) {
      setDialog(null)
    }
  }

  const selectedCoupons = coupons.filter((coupon) => selectedCouponIds.includes(coupon._id))
  const toggleCouponSelection = (couponId: string) => {
    setSelectedCouponIds((ids) => ids.includes(couponId) ? ids.filter((id) => id !== couponId) : [...ids, couponId])
  }
  const toggleAllCoupons = () => {
    setSelectedCouponIds(selectedCouponIds.length === coupons.length ? [] : coupons.map((coupon) => coupon._id))
  }

  const handleBulkStatus = async (isActive: boolean) => {
    if (!selectedCoupons.length) return
    setActionLoading(true)
    setNotice(null)
    const eligibleCoupons = selectedCoupons.filter((coupon) => {
      const status = getCouponStatus(coupon)
      return status === 'active' || status === 'inactive'
    })
    const results = await Promise.allSettled(eligibleCoupons.map((coupon) => updateCouponStatus(coupon._id, isActive)))
    const updated = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
    updated.forEach(replaceCoupon)
    const skippedCount = selectedCoupons.length - updated.length
    setSelectedCouponIds([])
    setNotice({
      type: skippedCount ? 'error' : 'success',
      message: `Đã ${isActive ? 'bật' : 'tắt'} ${updated.length} voucher${skippedCount ? `; bỏ qua ${skippedCount} voucher không hợp lệ hoặc xử lý lỗi` : ''}.`,
    })
    if (updated.length) requestAdminNotificationRefresh()
    setActionLoading(false)
  }

  const openBulkDeleteDialog = () => {
    if (selectedCoupons.length) setDialog({ type: 'bulk-delete', coupons: selectedCoupons })
  }

  const dialogRef = useDialogAccessibility(Boolean(dialog), closeDialog, !actionLoading)

  const handleDiscountTypeChange = (discountType: CouponDiscountType) => {
    setCouponForm((form) => ({
      ...form,
      discountType,
      discountValue:
        discountType === 'free_shipping'
          ? '0'
          : form.discountValue === '0' || !form.discountValue.trim()
            ? discountType === 'percent'
              ? '10'
              : '50000'
            : form.discountValue,
      maxDiscountAmount: form.maxDiscountAmount,
    }))
  }

  const handleGenerateCode = () => {
    setCouponForm((form) => ({
      ...form,
      code: buildCouponCode(form.name || form.description),
    }))
  }

  const handleDurationPreset = (days: number) => {
    setCouponForm((form) => {
      const startDate = new Date(form.startAt)
      const safeStartDate = Number.isNaN(startDate.getTime()) ? new Date() : startDate
      const endDate = new Date(safeStartDate)
      endDate.setDate(endDate.getDate() + days)

      return {
        ...form,
        startAt: toDateTimeInputValue(safeStartDate),
        endAt: toDateTimeInputValue(endDate),
      }
    })
  }

  const updateSelectionField = (field: CouponSelectionField, values: string[]) => {
    setCouponForm((form) => ({
      ...form,
      [field]: values,
    }))
  }

  const setCouponScopeMode = (scopeMode: CouponScopeMode) => {
    setCouponScopeModeState(scopeMode)
    setCouponForm((form) => ({
      ...form,
      applicableCategories: scopeMode === 'all' || scopeMode === 'product' ? [] : form.applicableCategories,
      applicableProducts: scopeMode === 'all' || scopeMode === 'category' ? [] : form.applicableProducts,
    }))
  }

  const applyCategoryScopeShortcut = (categoryIds: string[]) => {
    setCouponScopeModeState('category')
    setCouponForm((form) => ({
      ...form,
      applicableCategories: categoryIds,
      applicableProducts: [],
    }))
  }

  const runProductScopeSearch = (query: string) => {
    setCouponScopeMode('product')
    void searchProducts(query, 1)
  }

  const toggleEligibleUserType = (value: CouponEligibleUserType, checked: boolean) => {
    setCouponForm((form) => {
      if (value === 'all') {
        return {
          ...form,
          eligibleUserTypes: checked ? ['all'] : form.eligibleUserTypes,
        }
      }

      const currentValues = form.eligibleUserTypes.filter((item) => item !== 'all')
      const nextValues = checked
        ? Array.from(new Set([...currentValues, value]))
        : currentValues.filter((item) => item !== value)

      return {
        ...form,
        eligibleUserTypes: nextValues.length ? nextValues : ['all'],
      }
    })
  }

  const handleSubmitCoupon = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!dialog || (dialog.type !== 'create' && dialog.type !== 'duplicate' && dialog.type !== 'edit')) {
      return
    }

    setShowCouponErrors(true)
    const stepFields: Record<number, Array<keyof CouponFormState>> = {
      1: ['code', 'name', 'discountValue', 'maxDiscountAmount', 'minOrderAmount'],
      2: ['startAt', 'endAt', 'usageLimit', 'perUserLimit'],
      3: [],
    }
    const currentStepHasErrors = stepFields[couponStep].some((field) => Boolean(couponErrors[field]))
    if (currentStepHasErrors || codeAvailability === 'taken') {
      setNotice({ type: 'error', message: 'Kiểm tra lại các trường được đánh dấu.' })
      return
    }
    if (couponStep < 3) {
      setCouponStep((step) => step + 1)
      setShowCouponErrors(false)
      setNotice(null)
      return
    }

    setActionLoading(true)
    setNotice(null)

    try {
      const payload = toCouponPayload(couponForm)
      const availability = await checkCouponCodeAvailability(
        payload.code,
        dialog.type === 'edit' ? dialog.coupon._id : undefined,
      )
      if (!availability.available) {
        throw new Error(`Mã voucher ${availability.code} đã tồn tại`)
      }

      if (dialog.type === 'create' || dialog.type === 'duplicate') {
        if (dialog.type === 'duplicate') await duplicateCoupon(dialog.coupon._id, payload)
        else await createCoupon(payload)
        window.localStorage.removeItem(couponDraftKey)
        setNotice({ type: 'success', message: 'Đã tạo voucher' })
      } else {
        const updatedCoupon = await updateCoupon(dialog.coupon._id, payload)
        replaceCoupon(updatedCoupon)
        setNotice({ type: 'success', message: 'Đã cập nhật voucher' })
      }

      setDialog(null)
      await loadCoupons()
      requestAdminNotificationRefresh()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleStatusChange = async (coupon: AdminCoupon, isActive: boolean) => {
    setActionLoading(true)
    setNotice(null)

    try {
      const updatedCoupon = await updateCouponStatus(coupon._id, isActive)
      replaceCoupon(updatedCoupon)
      setNotice({
        type: 'success',
        message: isActive ? 'Đã bật voucher' : 'Đã tắt voucher',
      })
      requestAdminNotificationRefresh()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteCoupon = async () => {
    if (!dialog || dialog.type !== 'delete') {
      return
    }

    setActionLoading(true)
    setNotice(null)

    try {
      await deleteCoupon(dialog.coupon._id)
      setDialog(null)
      setNotice({ type: 'success', message: 'Đã xóa voucher' })
      await loadCoupons()
      requestAdminNotificationRefresh()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const getDiscountText = (coupon: AdminCoupon) => {
    if (coupon.discountType === 'free_shipping') {
      return 'Miễn phí vận chuyển'
    }

    if (coupon.discountType === 'percent') {
      return `${coupon.discountValue}%${coupon.maxDiscountAmount ? `, tối đa ${formatCurrency(coupon.maxDiscountAmount)}` : ''}`
    }

    return formatCurrency(coupon.discountValue)
  }

  const getAudienceText = (coupon: AdminCoupon) => {
    const userTypeText = coupon.eligibleUserTypes.includes('all')
      ? 'Tất cả khách'
      : coupon.eligibleUserTypes
        .map((type) => eligibleUserTypeOptions.find((option) => option.value === type)?.label ?? type)
        .join(', ')
    const rankNames = coupon.eligibleMembershipRanks
      .map((rankId) => rankNameById.get(normalizeId(rankId)))
      .filter(Boolean)

    if (!rankNames.length) {
      return userTypeText
    }

    return `${userTypeText}; hạng ${rankNames.join(', ')}`
  }

  const getScopeText = (coupon: AdminCoupon) => {
    const categoryNames = coupon.applicableCategories
      .map((categoryId) => categoryNameById.get(normalizeId(categoryId)))
      .filter(Boolean)
    const productNames = coupon.applicableProducts
      .map((productId) => productNameById.get(normalizeId(productId)))
      .filter(Boolean)

    if (!categoryNames.length && !productNames.length) {
      return 'Toàn bộ đơn hàng'
    }

    return [
      categoryNames.length ? `${categoryNames.length} danh mục` : '',
      productNames.length ? `${productNames.length} sản phẩm` : '',
    ].filter(Boolean).join(', ')
  }

  const getSelectedOptionLabels = (options: PickerOption[], selectedValues: string[]) => {
    const labelByValue = new Map(options.map((option) => [option.value, option.label]))
    return selectedValues.map((value) => labelByValue.get(value)).filter(Boolean)
  }

  const selectedTierLabels = getSelectedOptionLabels(tierOptions, couponForm.eligibleMembershipRanks)
  const selectedCategoryLabels = getSelectedOptionLabels(categoryOptions, couponForm.applicableCategories)
  const selectedProductLabels = getSelectedOptionLabels(productOptions, couponForm.applicableProducts)
  const formAudienceText = [
    couponForm.eligibleUserTypes.includes('all')
      ? 'Tất cả khách'
      : couponForm.eligibleUserTypes
        .map((type) => eligibleUserTypeOptions.find((option) => option.value === type)?.label ?? type)
        .join(', '),
    selectedTierLabels.length ? `hạng ${selectedTierLabels.join(', ')}` : '',
  ].filter(Boolean).join(' • ')
  const formScopeText = [
    selectedCategoryLabels.length ? `${selectedCategoryLabels.length} danh mục` : '',
    selectedProductLabels.length ? `${selectedProductLabels.length} sản phẩm` : '',
  ].filter(Boolean).join(' • ') || 'Toàn bộ đơn hàng'
  const formUsageText = couponForm.usageLimit.trim()
    ? `${couponForm.usageLimit} lượt tổng, ${couponForm.perUserLimit || 1} lượt/khách`
    : `${couponForm.perUserLimit || 1} lượt/khách`
  const estimatedAudience = couponForm.eligibleMembershipRanks.length
    ? tiers.filter((tier) => tier._id && couponForm.eligibleMembershipRanks.includes(tier._id)).reduce((sum, tier) => sum + (tier.memberCount ?? 0), 0)
    : tiers.reduce((sum, tier) => sum + (tier.memberCount ?? 0), 0)
  const couponDurationDays = (new Date(couponForm.endAt).getTime() - new Date(couponForm.startAt).getTime()) / 86_400_000
  const formDiscountPreview =
    couponForm.discountType === 'free_shipping'
      ? 'Miễn phí vận chuyển'
      : couponForm.discountType === 'percent'
        ? `${couponForm.discountValue || 0}%${couponForm.maxDiscountAmount ? ` · tối đa ${formatCurrency(Number(couponForm.maxDiscountAmount))}` : ''}`
        : formatCurrency(Number(couponForm.discountValue || 0))
  const exportUsageCsv = async () => {
    if (!dialog || dialog.type !== 'detail') return
    setActionLoading(true)
    let allItems: CouponUsageItem[] = []
    try {
      let exportPage = 1
      let exportTotalPages = 1
      do {
        const result = await listCouponUsage(dialog.coupon._id, exportPage, 100, {
          keyword: usageSearch,
          dateFrom: usageDateFrom || undefined,
          dateTo: usageDateTo || undefined,
        })
        allItems = [...allItems, ...result.items]
        exportTotalPages = result.pagination.totalPages
        exportPage += 1
      } while (exportPage <= exportTotalPages)
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
      setActionLoading(false)
      return
    }
    const rows = [
      ['Khách hàng', 'Đơn hàng', 'Giảm sản phẩm', 'Giảm vận chuyển', 'Thời gian'],
      ...allItems.map((usage) => [getCouponUsageUser(usage), getCouponUsageOrder(usage), usage.discountAmount, usage.shippingDiscountAmount, usage.usedAt]),
    ]
    const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')}`
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${dialog.coupon.code}-usage.csv`
    link.click()
    URL.revokeObjectURL(url)
    setActionLoading(false)
  }

  const exportCouponsCsv = async () => {
    setActionLoading(true)
    try {
      let exportPage = 1
      let exportTotalPages = 1
      let allCoupons: AdminCoupon[] = []
      do {
        const result = await listCoupons({
          keyword,
          status: statusFilter,
          discountType: discountFilter,
          visibility: visibilityFilter,
          eligibleUserType: audienceFilter,
          eligibleMembershipRank: rankFilter || undefined,
          dateFrom: dateFromFilter || undefined,
          dateTo: dateToFilter || undefined,
          sort,
          page: exportPage,
          limit: 100,
        })
        allCoupons = [...allCoupons, ...result.items]
        exportTotalPages = result.pagination.totalPages
        exportPage += 1
      } while (exportPage <= exportTotalPages)
      const rows = [
        ['Mã', 'Tên', 'Loại giảm', 'Giá trị', 'Đã dùng', 'Bắt đầu', 'Kết thúc', 'Trạng thái'],
        ...allCoupons.map((coupon) => [coupon.code, coupon.name, coupon.discountType, coupon.discountValue, coupon.usedCount, coupon.startAt, coupon.endAt, getCouponStatus(coupon)]),
      ]
      const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')}`
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'vouchers.csv'
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

  const handleBulkDeleteCoupons = async () => {
    if (!dialog || dialog.type !== 'bulk-delete') return
    setActionLoading(true)
    setNotice(null)
    const candidates = dialog.coupons.filter((coupon) => coupon.usedCount === 0)
    const results = await Promise.allSettled(candidates.map((coupon) => deleteCoupon(coupon._id)))
    const deletedIds = candidates.filter((_, index) => results[index].status === 'fulfilled').map((coupon) => coupon._id)
    const failedCount = dialog.coupons.length - deletedIds.length
    setCoupons((items) => items.filter((coupon) => !deletedIds.includes(coupon._id)))
    setSelectedCouponIds([])
    setDialog(null)
    setNotice({
      type: failedCount ? 'error' : 'success',
      message: failedCount
        ? `Đã xóa ${deletedIds.length} voucher; ${failedCount} voucher có lịch sử hoặc không thể xóa.`
        : `Đã xóa ${deletedIds.length} voucher.`,
    })
    setActionLoading(false)
    if (deletedIds.length) {
      await loadCoupons()
      requestAdminNotificationRefresh()
    }
  }

  const applyCouponTemplate = (template: typeof couponTemplates[number]) => {
    const startAt = new Date()
    const endAt = new Date(startAt)
    endAt.setDate(endAt.getDate() + template.durationDays)
    setCouponForm({
      ...createEmptyCouponForm(),
      ...template.values,
      code: buildCouponCode(template.values.name ?? ''),
      startAt: toDateTimeInputValue(startAt),
      endAt: toDateTimeInputValue(endAt),
    })
    setCouponStep(1)
    setShowAdvancedCouponOptions(true)
    setShowCouponErrors(false)
    setDraftRestored(false)
    setNotice(null)
  }

  const setStartNow = () => setCouponForm((form) => ({ ...form, startAt: toDateTimeInputValue(new Date()) }))

  const setFullDay = () => setCouponForm((form) => {
    const start = new Date(form.startAt || Date.now())
    const end = new Date(form.endAt || start)
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 0, 0)
    if (end <= start) end.setDate(end.getDate() + 1)
    return { ...form, startAt: toDateTimeInputValue(start), endAt: toDateTimeInputValue(end) }
  })

  return (
    <section className="admin-ui-page admin-promotions-page" aria-busy={isLoading}>
      <header className="admin-page-heading admin-promotion-heading">
        <div>
          <p>Marketing / Voucher</p>
          <h1>Khuyến mãi</h1>
          <span className="admin-promotion-heading-copy">
            Quản lý mã giảm giá, thời hạn áp dụng và lượt sử dụng của khách hàng.
          </span>
        </div>
        <div className="admin-promotion-heading-actions">
          <button className="admin-secondary-button" type="button" onClick={() => void loadCoupons()}>
            Làm mới
          </button>
          <button
            className="admin-secondary-button"
            type="button"
            disabled={actionLoading}
            onClick={() => void exportCouponsCsv()}
          >
            Xuất CSV
          </button>
          <button
            className="admin-primary-button"
            type="button"
            disabled={!canManagePromotions}
            onClick={openCreateDialog}
          >
            + Tạo voucher
          </button>
        </div>
      </header>

      <PromotionKpiSummary
        summary={couponSummary}
        hasKeyword={Boolean(keyword)}
        formatNumber={formatNumber}
      />

      <PromotionBulkToolbar
        selectedCount={selectedCouponIds.length}
        isLoading={actionLoading}
        onEnable={() => void handleBulkStatus(true)}
        onDisable={() => void handleBulkStatus(false)}
        onDelete={openBulkDeleteDialog}
        onClear={() => setSelectedCouponIds([])}
      />

      <PromotionFilterBar
        keywordInput={keywordInput}
        statusFilter={statusFilter}
        discountFilter={discountFilter}
        sort={sort}
        onReset={() => {
          setKeywordInput('')
          setStatusFilter('all')
          setDiscountFilter('all')
          setVisibilityFilter('all')
          setAudienceFilter('all_filter')
          setRankFilter('')
          setDateFromFilter('')
          setDateToFilter('')
          setSort('created_desc')
          setPage(1)
        }}
        onKeywordChange={setKeywordInput}
        onStatusChange={(value) => {
          setStatusFilter(value as CouponStatusFilter)
          setVisibilityFilter('all')
          setAudienceFilter('all_filter')
          setRankFilter('')
          setDateFromFilter('')
          setDateToFilter('')
          setPage(1)
        }}
        onDiscountChange={(value) => {
          setDiscountFilter(value as CouponDiscountFilter)
          setVisibilityFilter('all')
          setAudienceFilter('all_filter')
          setRankFilter('')
          setDateFromFilter('')
          setDateToFilter('')
          setPage(1)
        }}
        onSortChange={(value) => {
          setSort(value as CouponSort)
          setVisibilityFilter('all')
          setAudienceFilter('all_filter')
          setRankFilter('')
          setDateFromFilter('')
          setDateToFilter('')
          setPage(1)
        }}
      />

      {tierReferenceError || categoryReferenceError || productReferenceError ? (
        <p className="admin-notice admin-promotion-reference-warning" role="status">
          {[tierReferenceError, categoryReferenceError, productReferenceError].filter(Boolean).join(' ')}
        </p>
      ) : null}

      <CouponTablePanel
        coupons={coupons}
        selectedCouponIds={selectedCouponIds}
        isLoading={isLoading}
        actionLoading={actionLoading}
        canManagePromotions={canManagePromotions}
        errorMessage={errorMessage}
        displayStatusMeta={displayStatusMeta}
        displayStatusTone={displayStatusTone}
        formatCurrency={formatCurrency}
        formatDateTime={formatDateTime}
        getCouponStatus={getCouponStatus}
        getDiscountText={getDiscountText}
        getAudienceText={getAudienceText}
        getScopeText={getScopeText}
        onRetry={() => void loadCoupons()}
        onToggleAll={toggleAllCoupons}
        onToggleCouponSelection={toggleCouponSelection}
        onOpenDetail={openDetailDialog}
        onOpenEdit={openEditDialog}
        onOpenDuplicate={openDuplicateDialog}
        onStatusChange={handleStatusChange}
        onOpenDelete={openDeleteDialog}
      />

      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        isDisabled={isLoading}
        onPageChange={setPage}
      />

      <CampaignAnalyticsPanel currentUser={currentUser} />

      {dialog?.type === 'detail' ? (
        <CouponDetailDialog
          dialogRef={dialogRef}
          coupon={dialog.coupon}
          usage={dialog.usage}
          actionLoading={actionLoading}
          canManagePromotions={canManagePromotions}
          usageSearch={usageSearch}
          usageDateFrom={usageDateFrom}
          usageDateTo={usageDateTo}
          displayStatusMeta={displayStatusMeta}
          formatCurrency={formatCurrency}
          formatDateTime={formatDateTime}
          getCouponStatus={getCouponStatus}
          getDiscountText={getDiscountText}
          getAudienceText={getAudienceText}
          getScopeText={getScopeText}
          getCouponActorLabel={getCouponActorLabel}
          getCouponUsageUser={getCouponUsageUser}
          getCouponUsageOrder={getCouponUsageOrder}
          onUsageSearchChange={setUsageSearch}
          onUsageDateFromChange={setUsageDateFrom}
          onUsageDateToChange={setUsageDateTo}
          onExportUsageCsv={exportUsageCsv}
          onLoadUsagePage={loadCouponUsagePage}
          onClose={closeDialog}
          onEdit={openEditDialog}
        />
      ) : null}
      {dialog?.type === 'create' || dialog?.type === 'duplicate' || dialog?.type === 'edit' ? (
        <CouponFormDialog
          dialogRef={dialogRef}
          mode={dialog.type}
          couponForm={couponForm}
          setCouponForm={setCouponForm}
          couponErrors={couponErrors}
          showCouponErrors={showCouponErrors}
          couponStep={couponStep}
          showAdvancedCouponOptions={showAdvancedCouponOptions}
          notice={notice}
          actionLoading={actionLoading}
          codeAvailability={codeAvailability}
          draftRestored={draftRestored}
          couponTemplates={couponTemplates}
          discountTypeLabels={discountTypeLabels}
          discountTypeDescriptions={discountTypeDescriptions}
          discountTypeSymbols={discountTypeSymbols}
          percentPresets={percentPresets}
          fixedPresets={fixedPresets}
          durationPresets={durationPresets}
          eligibleUserTypeOptions={eligibleUserTypeOptions}
          tierOptions={tierOptions}
          categoryOptions={categoryOptions}
          productOptions={productOptions}
          categoryScopeShortcuts={categoryScopeShortcuts}
          tierReferenceError={tierReferenceError}
          categoryReferenceError={categoryReferenceError}
          productReferenceError={productReferenceError}
          couponScopeMode={couponScopeMode}
          couponDurationDays={couponDurationDays}
          productSearchQuery={productSearchQuery}
          isSearchingProducts={isSearchingProducts}
          productTotal={productTotal}
          productPage={productPage}
          productTotalPages={productTotalPages}
          sampleSubTotal={sampleSubTotal}
          sampleShippingFee={sampleShippingFee}
          couponPreview={couponPreview}
          formAudienceText={formAudienceText}
          formScopeText={formScopeText}
          formUsageText={formUsageText}
          formDiscountPreview={formDiscountPreview}
          estimatedAudience={estimatedAudience}
          formatCurrency={formatCurrency}
          formatNumber={formatNumber}
          formatDateTime={formatDateTime}
          onSubmit={handleSubmitCoupon}
          onInvalidForm={() => {
            setShowCouponErrors(true)
            setNotice({ type: 'error', message: 'Kiểm tra lại các trường được đánh dấu.' })
          }}
          onDiscardDraft={() => {
            window.localStorage.removeItem(couponDraftKey)
            setCouponForm(createEmptyCouponForm())
            setDraftRestored(false)
          }}
          onStepChange={setCouponStep}
          onPreviousStep={() => {
            setCouponStep((step) => step - 1)
            setShowCouponErrors(false)
            setNotice(null)
          }}
          onToggleAdvancedOptions={() => setShowAdvancedCouponOptions((visible) => !visible)}
          onApplyCouponTemplate={applyCouponTemplate}
          onGenerateCode={handleGenerateCode}
          onDiscountTypeChange={handleDiscountTypeChange}
          onSetStartNow={setStartNow}
          onSetFullDay={setFullDay}
          onDurationPreset={handleDurationPreset}
          onToggleEligibleUserType={toggleEligibleUserType}
          onUpdateSelectionField={updateSelectionField}
          onLoadReferences={loadReferences}
          onSetCouponScopeMode={setCouponScopeMode}
          onApplyCategoryScopeShortcut={applyCategoryScopeShortcut}
          onRunProductScopeSearch={runProductScopeSearch}
          onSearchProducts={searchProducts}
          onLoadMoreProducts={loadMoreProducts}
          onSampleSubTotalChange={setSampleSubTotal}
          onSampleShippingFeeChange={setSampleShippingFee}
          onClose={closeDialog}
        />
      ) : null}
      {dialog?.type === 'delete' ? (
        <CouponDeleteDialog
          dialogRef={dialogRef}
          coupon={dialog.coupon}
          usageCount={dialog.usageCount}
          actionLoading={actionLoading}
          onClose={closeDialog}
          onDelete={handleDeleteCoupon}
        />
      ) : null}

      {dialog?.type === 'bulk-delete' ? (
        <CouponBulkDeleteDialog
          dialogRef={dialogRef}
          coupons={dialog.coupons}
          actionLoading={actionLoading}
          onClose={closeDialog}
          onDelete={handleBulkDeleteCoupons}
        />
      ) : null}
    </section>
  )
}
