import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { AdminUser } from '../auth/adminSession'
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility'
import { listMembershipRankings } from '../loyalty/loyalty.service'
import type { MembershipRanking } from '../loyalty/loyalty.types'
import {
  checkCouponCodeAvailability,
  createCoupon,
  deleteCoupon,
  getCoupon,
  listCouponCategories,
  listCouponProducts,
  listCouponUsage,
  listCoupons,
  updateCoupon,
  updateCouponStatus,
} from './promotion.service'
import type {
  AdminCoupon,
  CategoryOption,
  CouponDiscountType,
  CouponEligibleUserType,
  CouponPayload,
  CouponUsageItem,
  CouponUsageListResponse,
  ProductOption,
} from './promotion.types'
import { OptionPicker, type PickerOption } from './components/OptionPicker'
import { CampaignAnalyticsPanel } from './components/CampaignAnalyticsPanel'
import './promotion.css'

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
  | { type: 'edit'; coupon: AdminCoupon }
  | { type: 'detail'; coupon: AdminCoupon; usage: CouponUsageListResponse }
  | { type: 'delete'; coupon: AdminCoupon; usageCount: number }
  | null

type CouponSelectionField = 'eligibleMembershipRanks' | 'applicableProducts' | 'applicableCategories'

const pageSize = 10

const statusFilterLabels: Record<CouponStatusFilter, string> = {
  all: 'Tất cả trạng thái',
  active: 'Đang chạy',
  inactive: 'Tạm tắt',
  expired: 'Hết hạn',
  upcoming: 'Sắp mở',
}

const displayStatusMeta: Record<CouponDisplayStatus, { label: string; className: string }> = {
  active: { label: 'Đang chạy', className: 'is-active' },
  inactive: { label: 'Tạm tắt', className: 'is-blocked' },
  expired: { label: 'Hết hạn', className: 'is-blocked' },
  upcoming: { label: 'Sắp mở', className: 'is-warning' },
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

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)

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

export function PromotionsPage({ currentUser }: PromotionsPageProps) {
  const [coupons, setCoupons] = useState<AdminCoupon[]>([])
  const [tiers, setTiers] = useState<MembershipRanking[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<CouponStatusFilter>('all')
  const [sort, setSort] = useState<CouponSort>('created_desc')
  const [page, setPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [referenceWarning, setReferenceWarning] = useState('')
  const [isSearchingProducts, setIsSearchingProducts] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [couponForm, setCouponForm] = useState<CouponFormState>(() => createEmptyCouponForm())
  const productSearchRequestId = useRef(0)

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
          label: tier.name,
          meta: `Từ ${new Intl.NumberFormat('vi-VN').format(tier.minPoint)} điểm`,
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

  const loadCoupons = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const result = await listCoupons({
        keyword,
        status: statusFilter,
        sort,
        page,
        limit: pageSize,
      })

      setCoupons(result.items)
      setTotalItems(result.pagination.totalItems)
      setTotalPages(Math.max(1, result.pagination.totalPages))
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [keyword, page, sort, statusFilter])

  const loadReferences = useCallback(async () => {
    const warnings: string[] = []
    const [tierResult, categoryResult, productResult] = await Promise.allSettled([
      listMembershipRankings(),
      canReadCatalog ? listCouponCategories() : Promise.resolve([]),
      canReadProducts ? listCouponProducts() : Promise.resolve([]),
    ])

    if (tierResult.status === 'fulfilled') {
      setTiers(tierResult.value)
    } else {
      warnings.push('Không tải được danh sách hạng thành viên')
    }

    if (categoryResult.status === 'fulfilled') {
      setCategories(categoryResult.value)
    } else {
      warnings.push('Không tải được danh mục áp dụng')
    }

    if (productResult.status === 'fulfilled') {
      setProducts(productResult.value)
    } else {
      warnings.push('Không tải được sản phẩm áp dụng')
    }

    setReferenceWarning(warnings.join('. '))
  }, [canReadCatalog, canReadProducts])

  const searchProducts = useCallback(async (query: string) => {
    if (!canReadProducts) {
      return
    }

    const requestId = productSearchRequestId.current + 1
    productSearchRequestId.current = requestId
    setIsSearchingProducts(true)

    try {
      const matches = await listCouponProducts(query)
      if (requestId !== productSearchRequestId.current) {
        return
      }

      setProducts((currentProducts) => {
        const productById = new Map(currentProducts.map((product) => [product._id, product]))
        matches.forEach((product) => productById.set(product._id, product))
        return Array.from(productById.values())
      })
    } catch (error) {
      if (requestId === productSearchRequestId.current) {
        setReferenceWarning(getErrorMessage(error))
      }
    } finally {
      if (requestId === productSearchRequestId.current) {
        setIsSearchingProducts(false)
      }
    }
  }, [canReadProducts])

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
    if (!notice) {
      return
    }

    const handle = window.setTimeout(() => setNotice(null), 5000)
    return () => window.clearTimeout(handle)
  }, [notice])

  const activeCount = coupons.filter((coupon) => getCouponStatus(coupon) === 'active').length
  const publicCount = coupons.filter((coupon) => coupon.isPublic).length
  const usedCount = coupons.reduce((sum, coupon) => sum + (coupon.usedCount ?? 0), 0)
  const visiblePages = useMemo(() => {
    const firstPage = Math.max(1, Math.min(page - 2, totalPages - 4))
    const lastPage = Math.min(totalPages, firstPage + 4)
    return Array.from({ length: Math.max(0, lastPage - firstPage + 1) }, (_, index) => firstPage + index)
  }, [page, totalPages])

  const replaceCoupon = (updatedCoupon: AdminCoupon) => {
    setCoupons((currentCoupons) =>
      currentCoupons.map((coupon) => (coupon._id === updatedCoupon._id ? updatedCoupon : coupon)),
    )
  }

  const openCreateDialog = () => {
    setCouponForm(createEmptyCouponForm())
    setNotice(null)
    setDialog({ type: 'create' })
  }

  const openEditDialog = (coupon: AdminCoupon) => {
    setCouponForm(toCouponForm(coupon))
    setNotice(null)
    setDialog({ type: 'edit', coupon })
  }

  const openDuplicateDialog = (coupon: AdminCoupon) => {
    setCouponForm({
      ...toCouponForm(coupon),
      code: `${coupon.code.slice(0, 35)}_COPY`,
      name: `${coupon.name} (bản sao)`,
      isActive: false,
    })
    setNotice(null)
    setDialog({ type: 'create' })
  }

  const openDetailDialog = async (coupon: AdminCoupon) => {
    setActionLoading(true)
    setNotice(null)

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
      const usage = await listCouponUsage(dialog.coupon._id, pageNumber)
      setDialog({ ...dialog, usage })
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setActionLoading(false)
    }
  }

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

    if (!dialog || (dialog.type !== 'create' && dialog.type !== 'edit')) {
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

      if (dialog.type === 'create') {
        await createCoupon(payload)
        setNotice({ type: 'success', message: 'Đã tạo voucher' })
      } else {
        const updatedCoupon = await updateCoupon(dialog.coupon._id, payload)
        replaceCoupon(updatedCoupon)
        setNotice({ type: 'success', message: 'Đã cập nhật voucher' })
      }

      setDialog(null)
      await loadCoupons()
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
  const formDiscountPreview =
    couponForm.discountType === 'free_shipping'
      ? 'Miễn phí vận chuyển'
      : couponForm.discountType === 'percent'
        ? `${couponForm.discountValue || 0}%${couponForm.maxDiscountAmount ? ` · tối đa ${formatCurrency(Number(couponForm.maxDiscountAmount))}` : ''}`
        : formatCurrency(Number(couponForm.discountValue || 0))

  return (
    <section className="admin-promotions-page" aria-busy={isLoading}>
      <header className="admin-page-heading">
        <div>
          <p>Marketing / Voucher</p>
          <h1>Khuyến mãi</h1>
        </div>

        <button
          className="admin-primary-button"
          type="button"
          disabled={!canManagePromotions}
          onClick={openCreateDialog}
        >
          Tạo voucher
        </button>
      </header>

      <div className="admin-user-stats admin-promotion-stats">
        <div>
          <span>Tổng voucher</span>
          <strong>{totalItems}</strong>
        </div>
        <div>
          <span>Đang chạy trên trang này</span>
          <strong>{activeCount}</strong>
        </div>
        <div>
          <span>Lượt đã dùng trên trang này</span>
          <strong>{usedCount}</strong>
        </div>
      </div>

      <CampaignAnalyticsPanel currentUser={currentUser} />

      <div className="admin-table-toolbar">
        <label className="admin-user-search">
          <span>Tìm kiếm</span>
          <input
            type="search"
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            placeholder="Mã, tên hoặc mô tả voucher"
          />
        </label>

        <label>
          <span>Trạng thái</span>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as CouponStatusFilter)
              setPage(1)
            }}
          >
            {Object.entries(statusFilterLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Sắp xếp</span>
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as CouponSort)
              setPage(1)
            }}
          >
            <option value="created_desc">Mới tạo trước</option>
            <option value="created_asc">Cũ nhất trước</option>
            <option value="end_asc">Sắp hết hạn</option>
            <option value="usage_desc">Dùng nhiều nhất</option>
            <option value="code_asc">Mã A-Z</option>
          </select>
        </label>

        <button className="admin-secondary-button" type="button" onClick={() => void loadCoupons()}>
          Làm mới
        </button>
      </div>

      {notice ? (
        <p className={`admin-notice is-${notice.type}`} role="status">
          {notice.message}
        </p>
      ) : null}

      {referenceWarning ? (
        <p className="admin-notice admin-promotion-reference-warning" role="status">
          {referenceWarning}
        </p>
      ) : null}

      {errorMessage ? (
        <div className="admin-empty-state" role="alert">
          <strong>Không tải được voucher</strong>
          <span>{errorMessage}</span>
          <button className="admin-secondary-button" type="button" onClick={() => void loadCoupons()}>
            Thử lại
          </button>
        </div>
      ) : (
        <div className="admin-table-shell">
          <table className="admin-table admin-promotions-table">
            <thead>
              <tr>
                <th>Voucher</th>
                <th>Giá trị</th>
                <th>Điều kiện</th>
                <th>Hạn dùng</th>
                <th>Hiển thị</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7}>
                    <div className="admin-table-loading">Đang tải voucher...</div>
                  </td>
                </tr>
              ) : null}

              {!isLoading && coupons.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="admin-promotion-empty-state">
                      <strong>Không có voucher phù hợp</strong>
                      <span>Thử đổi bộ lọc hoặc tạo voucher mới.</span>
                      <button
                        className="admin-secondary-button"
                        type="button"
                        disabled={!canManagePromotions}
                        onClick={openCreateDialog}
                      >
                        Tạo voucher
                      </button>
                    </div>
                  </td>
                </tr>
              ) : null}

              {!isLoading
                ? coupons.map((coupon) => {
                    const status = getCouponStatus(coupon)
                    const statusMeta = displayStatusMeta[status]
                    const canToggleCouponStatus = status === 'active' || status === 'inactive'
                    const remainingUsage =
                      coupon.usageLimit == null
                        ? 'Không giới hạn'
                        : `${Math.max(0, coupon.usageLimit - coupon.usedCount)} / ${coupon.usageLimit}`

                    return (
                      <tr key={coupon._id}>
                        <td>
                          <div className="admin-promotion-code-cell">
                            <strong>{coupon.code}</strong>
                            <span>{coupon.name}</span>
                          </div>
                        </td>
                        <td>
                          <strong>{getDiscountText(coupon)}</strong>
                          <span>Đơn từ {formatCurrency(coupon.minOrderAmount)}</span>
                        </td>
                        <td>
                          {getAudienceText(coupon)}
                          <span>{getScopeText(coupon)}</span>
                        </td>
                        <td>
                          {formatDateTime(coupon.startAt)}
                          <span>Đến {formatDateTime(coupon.endAt)}</span>
                          <span>Còn lượt: {remainingUsage}</span>
                        </td>
                        <td>
                          <span className={`admin-status-pill ${coupon.isPublic ? 'is-active' : 'is-warning'}`}>
                            {coupon.isPublic ? 'Public' : 'Private'}
                          </span>
                        </td>
                        <td>
                          <span className={`admin-status-pill ${statusMeta.className}`}>
                            {statusMeta.label}
                          </span>
                        </td>
                        <td>
                          <div className="admin-row-actions">
                            <button
                              className="admin-link-button"
                              type="button"
                              disabled={actionLoading}
                              onClick={() => void openDetailDialog(coupon)}
                            >
                              Xem
                            </button>
                            <button
                              className="admin-link-button"
                              type="button"
                              disabled={!canManagePromotions || actionLoading}
                              onClick={() => openEditDialog(coupon)}
                            >
                              Sửa
                            </button>
                            <button
                              className="admin-link-button"
                              type="button"
                              disabled={!canManagePromotions || actionLoading}
                              onClick={() => openDuplicateDialog(coupon)}
                            >
                              Nhân bản
                            </button>
                            <button
                              className={coupon.isActive ? 'admin-danger-link' : 'admin-link-button'}
                              type="button"
                              disabled={!canManagePromotions || actionLoading || !canToggleCouponStatus}
                              title={
                                canToggleCouponStatus
                                  ? undefined
                                  : 'Không thể đổi trạng thái voucher chưa bắt đầu hoặc đã hết hạn'
                              }
                              onClick={() => void handleStatusChange(coupon, !coupon.isActive)}
                            >
                              {coupon.isActive ? 'Tắt' : 'Bật'}
                            </button>
                            <button
                              className="admin-danger-link"
                              type="button"
                              disabled={!canManagePromotions || actionLoading}
                              onClick={() => void openDeleteDialog(coupon)}
                            >
                              Xóa
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                : null}
            </tbody>
          </table>
        </div>
      )}

      <footer className="admin-table-footer">
        <span>
          Trang {page} / {totalPages} • Public: {publicCount}
        </span>
        <div>
          <button
            className="admin-secondary-button"
            type="button"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
          >
            Trước
          </button>
          {visiblePages.map((pageNumber) => (
            <button
              key={pageNumber}
              className={`${pageNumber === page ? 'admin-primary-button' : 'admin-secondary-button'} admin-pagination-page`}
              type="button"
              disabled={isLoading}
              aria-current={pageNumber === page ? 'page' : undefined}
              onClick={() => setPage(pageNumber)}
            >
              {pageNumber}
            </button>
          ))}
          <button
            className="admin-secondary-button"
            type="button"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
          >
            Sau
          </button>
        </div>
      </footer>

      {dialog?.type === 'detail' ? (
        <div ref={dialogRef} tabIndex={-1} className="admin-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="admin-coupon-detail-title">
          <div className="admin-account-dialog admin-coupon-detail-dialog">
            <header className="admin-coupon-dialog-header">
              <div>
                <p>Chi tiết voucher</p>
                <h2 id="admin-coupon-detail-title">{dialog.coupon.code}</h2>
                <span>{dialog.coupon.name}</span>
              </div>
              <span className={`admin-status-pill ${displayStatusMeta[getCouponStatus(dialog.coupon)].className}`}>
                {displayStatusMeta[getCouponStatus(dialog.coupon)].label}
              </span>
            </header>

            <div className="admin-coupon-detail-body">
              <dl className="admin-coupon-detail-grid">
                <div><dt>Giá trị</dt><dd>{getDiscountText(dialog.coupon)}</dd></div>
                <div><dt>Đơn tối thiểu</dt><dd>{formatCurrency(dialog.coupon.minOrderAmount)}</dd></div>
                <div><dt>Đối tượng</dt><dd>{getAudienceText(dialog.coupon)}</dd></div>
                <div><dt>Phạm vi</dt><dd>{getScopeText(dialog.coupon)}</dd></div>
                <div><dt>Bắt đầu</dt><dd>{formatDateTime(dialog.coupon.startAt)}</dd></div>
                <div><dt>Kết thúc</dt><dd>{formatDateTime(dialog.coupon.endAt)}</dd></div>
                <div><dt>Giới hạn mỗi khách</dt><dd>{dialog.coupon.perUserLimit}</dd></div>
                <div><dt>Tổng lượt dùng</dt><dd>{dialog.usage.pagination.totalItems}</dd></div>
                <div><dt>Người tạo</dt><dd>{getCouponActorLabel(dialog.coupon.createdBy)}</dd></div>
                <div><dt>Người cập nhật</dt><dd>{getCouponActorLabel(dialog.coupon.updatedBy)}</dd></div>
                <div><dt>Ngày tạo</dt><dd>{dialog.coupon.createdAt ? formatDateTime(dialog.coupon.createdAt) : 'Không có dữ liệu'}</dd></div>
                <div><dt>Cập nhật gần nhất</dt><dd>{dialog.coupon.updatedAt ? formatDateTime(dialog.coupon.updatedAt) : 'Không có dữ liệu'}</dd></div>
              </dl>

              <section className="admin-coupon-usage-section">
                <div className="admin-section-heading">
                  <div>
                    <p>Đối soát</p>
                    <h2>Lịch sử sử dụng</h2>
                  </div>
                  {actionLoading ? <span>Đang tải...</span> : null}
                </div>
                <div className="admin-table-scroll">
                  <table className="admin-table admin-coupon-usage-table">
                    <thead>
                      <tr>
                        <th>Khách hàng</th>
                        <th>Đơn hàng</th>
                        <th>Giảm sản phẩm</th>
                        <th>Giảm vận chuyển</th>
                        <th>Thời gian</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dialog.usage.items.length ? dialog.usage.items.map((usage) => (
                        <tr key={usage._id}>
                          <td>{getCouponUsageUser(usage)}</td>
                          <td>{getCouponUsageOrder(usage)}</td>
                          <td>{formatCurrency(usage.discountAmount)}</td>
                          <td>{formatCurrency(usage.shippingDiscountAmount)}</td>
                          <td>{formatDateTime(usage.usedAt)}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5}><div className="admin-table-loading">Voucher chưa được sử dụng.</div></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <footer className="admin-dialog-actions admin-coupon-detail-actions">
              <span>
                Trang {dialog.usage.pagination.page} / {Math.max(1, dialog.usage.pagination.totalPages)}
              </span>
              <button
                className="admin-secondary-button"
                type="button"
                disabled={dialog.usage.pagination.page <= 1 || actionLoading}
                onClick={() => void loadCouponUsagePage(dialog.usage.pagination.page - 1)}
              >
                Trước
              </button>
              <button
                className="admin-secondary-button"
                type="button"
                disabled={dialog.usage.pagination.page >= dialog.usage.pagination.totalPages || actionLoading}
                onClick={() => void loadCouponUsagePage(dialog.usage.pagination.page + 1)}
              >
                Sau
              </button>
              <button className="admin-primary-button" type="button" disabled={actionLoading} onClick={closeDialog}>
                Đóng
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {dialog?.type === 'create' || dialog?.type === 'edit' ? (
        <div ref={dialogRef} tabIndex={-1} className="admin-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="admin-coupon-dialog-title">
          <form className="admin-account-dialog admin-coupon-dialog" onSubmit={handleSubmitCoupon}>
            <header className="admin-coupon-dialog-header">
              <div>
                <span>Marketing voucher</span>
                <h2 id="admin-coupon-dialog-title">
                  {dialog.type === 'create' ? 'Tạo voucher' : 'Sửa voucher'}
                </h2>
                <p>Thiết lập giá trị ưu đãi, thời hạn và điều kiện áp dụng.</p>
              </div>
            </header>

            <div className="admin-coupon-dialog-body">
              <div className="admin-coupon-form-column">
                <section className="admin-coupon-form-section">
                  <header className="admin-coupon-section-header">
                    <span>01</span>
                    <div>
                      <strong>Thông tin voucher</strong>
                      <p>Mã dễ nhớ giúp khách nhập đúng khi thanh toán.</p>
                    </div>
                  </header>

                  <div className="admin-account-form-grid">
                    <label>
                      <span>Mã voucher</span>
                      <div className="admin-field-with-action">
                        <input
                          value={couponForm.code}
                          onChange={(event) =>
                            setCouponForm((form) => ({ ...form, code: event.target.value.toUpperCase() }))
                          }
                          placeholder="WELCOME10"
                          required
                          minLength={2}
                          maxLength={40}
                          pattern="[A-Z0-9_-]+"
                        />
                        <button className="admin-secondary-button" type="button" onClick={handleGenerateCode}>
                          Tạo mã
                        </button>
                      </div>
                      <small className="admin-field-hint">Chữ in hoa, số, gạch dưới hoặc gạch ngang.</small>
                    </label>
                    <label>
                      <span>Tên voucher</span>
                      <input
                        value={couponForm.name}
                        onChange={(event) => setCouponForm((form) => ({ ...form, name: event.target.value }))}
                        placeholder="Ví dụ: Chào mừng khách mới"
                        required
                        minLength={2}
                        maxLength={120}
                      />
                    </label>
                    <label className="admin-coupon-wide-field">
                      <span>Mô tả</span>
                      <textarea
                        value={couponForm.description}
                        onChange={(event) => setCouponForm((form) => ({ ...form, description: event.target.value }))}
                        maxLength={500}
                        rows={3}
                        placeholder="Ghi chú nội bộ hoặc mô tả ngắn cho chương trình."
                      />
                    </label>
                  </div>
                </section>

                <section className="admin-coupon-form-section">
                  <header className="admin-coupon-section-header">
                    <span>02</span>
                    <div>
                      <strong>Giá trị ưu đãi</strong>
                      <p>Chọn kiểu giảm trước, các ô tiền sẽ tự đổi theo ngữ cảnh.</p>
                    </div>
                  </header>

                  <div className="admin-coupon-type-grid" role="group" aria-label="Loại giảm">
                    {(Object.keys(discountTypeLabels) as CouponDiscountType[]).map((discountType) => (
                      <button
                        key={discountType}
                        className={`admin-coupon-type-button${couponForm.discountType === discountType ? ' is-selected' : ''}`}
                        type="button"
                        aria-pressed={couponForm.discountType === discountType}
                        onClick={() => handleDiscountTypeChange(discountType)}
                      >
                        <span className="admin-coupon-type-symbol">{discountTypeSymbols[discountType]}</span>
                        <span>
                          <strong>{discountTypeLabels[discountType]}</strong>
                          <small>{discountTypeDescriptions[discountType]}</small>
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="admin-account-form-grid">
                    <label>
                      <span>Giá trị giảm</span>
                      <div className="admin-input-affix">
                        <input
                          type="number"
                          value={couponForm.discountValue}
                          onChange={(event) => setCouponForm((form) => ({ ...form, discountValue: event.target.value }))}
                          disabled={couponForm.discountType === 'free_shipping'}
                          required
                          min={couponForm.discountType === 'percent' ? 1 : 0}
                          max={couponForm.discountType === 'percent' ? 100 : undefined}
                        />
                        {couponForm.discountType !== 'free_shipping' ? (
                          <span>{couponForm.discountType === 'percent' ? '%' : 'đ'}</span>
                        ) : null}
                      </div>
                    </label>
                    <label>
                      <span>Giảm tối đa</span>
                      <div className="admin-input-affix">
                        <input
                          type="number"
                          value={couponForm.maxDiscountAmount}
                          onChange={(event) =>
                            setCouponForm((form) => ({ ...form, maxDiscountAmount: event.target.value }))
                          }
                          disabled={couponForm.discountType !== 'percent'}
                          min={0}
                          placeholder="Không giới hạn"
                        />
                        <span>đ</span>
                      </div>
                    </label>
                    <label>
                      <span>Đơn tối thiểu</span>
                      <div className="admin-input-affix">
                        <input
                          type="number"
                          value={couponForm.minOrderAmount}
                          onChange={(event) =>
                            setCouponForm((form) => ({ ...form, minOrderAmount: event.target.value }))
                          }
                          required
                          min={0}
                        />
                        <span>đ</span>
                      </div>
                    </label>
                  </div>

                  {couponForm.discountType !== 'free_shipping' ? (
                    <div className="admin-preset-row" aria-label="Giá trị gợi ý">
                      {(couponForm.discountType === 'percent' ? percentPresets : fixedPresets).map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className={couponForm.discountValue === preset ? 'is-selected' : ''}
                          onClick={() => setCouponForm((form) => ({ ...form, discountValue: preset }))}
                        >
                          {couponForm.discountType === 'percent' ? `${preset}%` : formatCurrency(Number(preset))}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </section>

                <section className="admin-coupon-form-section">
                  <header className="admin-coupon-section-header">
                    <span>03</span>
                    <div>
                      <strong>Thời gian và lượt dùng</strong>
                      <p>Kiểm soát thời hạn, tổng lượt và số lần mỗi khách được dùng.</p>
                    </div>
                  </header>

                  <div className="admin-account-form-grid">
                    <label>
                      <span>Bắt đầu</span>
                      <input
                        type="datetime-local"
                        value={couponForm.startAt}
                        onChange={(event) => setCouponForm((form) => ({ ...form, startAt: event.target.value }))}
                        required
                      />
                    </label>
                    <label>
                      <span>Kết thúc</span>
                      <input
                        type="datetime-local"
                        value={couponForm.endAt}
                        onChange={(event) => setCouponForm((form) => ({ ...form, endAt: event.target.value }))}
                        required
                      />
                    </label>
                  </div>
                  <div className="admin-preset-row" aria-label="Thời hạn gợi ý">
                    {durationPresets.map((preset) => (
                      <button key={preset.days} type="button" onClick={() => handleDurationPreset(preset.days)}>
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <div className="admin-account-form-grid">
                    <label>
                      <span>Giới hạn lượt dùng</span>
                      <input
                        type="number"
                        value={couponForm.usageLimit}
                        onChange={(event) => setCouponForm((form) => ({ ...form, usageLimit: event.target.value }))}
                        min={1}
                        placeholder="Không giới hạn"
                      />
                    </label>
                    <label>
                      <span>Mỗi khách được dùng</span>
                      <input
                        type="number"
                        value={couponForm.perUserLimit}
                        onChange={(event) => setCouponForm((form) => ({ ...form, perUserLimit: event.target.value }))}
                        required
                        min={1}
                      />
                    </label>
                  </div>
                  <div className="admin-toggle-grid">
                    <label>
                      <input
                        type="checkbox"
                        checked={couponForm.isPublic}
                        onChange={(event) => setCouponForm((form) => ({ ...form, isPublic: event.target.checked }))}
                      />
                      <span>
                        <strong>Public</strong>
                        <small>Hiển thị trong danh sách ưu đãi của khách</small>
                      </span>
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={couponForm.isActive}
                        onChange={(event) => setCouponForm((form) => ({ ...form, isActive: event.target.checked }))}
                      />
                      <span>
                        <strong>Đang hoạt động</strong>
                        <small>Cho phép áp dụng khi đến thời gian hiệu lực</small>
                      </span>
                    </label>
                  </div>
                </section>

                <section className="admin-coupon-form-section">
                  <header className="admin-coupon-section-header">
                    <span>04</span>
                    <div>
                      <strong>Đối tượng áp dụng</strong>
                      <p>Có thể giới hạn theo loại khách và hạng thành viên.</p>
                    </div>
                  </header>

                  <div className="admin-promotion-checkbox-row">
                    {eligibleUserTypeOptions.map((option) => (
                      <label key={option.value}>
                        <input
                          type="checkbox"
                          checked={couponForm.eligibleUserTypes.includes(option.value)}
                          onChange={(event) => toggleEligibleUserType(option.value, event.target.checked)}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                  <OptionPicker
                    title="Hạng thành viên"
                    emptyLabel="Tất cả hạng"
                    searchPlaceholder="Tìm hạng thành viên"
                    options={tierOptions}
                    selectedValues={couponForm.eligibleMembershipRanks}
                    onChange={(values) => updateSelectionField('eligibleMembershipRanks', values)}
                  />
                </section>

                <section className="admin-coupon-form-section">
                  <header className="admin-coupon-section-header">
                    <span>05</span>
                    <div>
                      <strong>Phạm vi sản phẩm</strong>
                      <p>Để trống nếu voucher áp dụng cho toàn bộ đơn hàng.</p>
                    </div>
                  </header>

                  <div className="admin-coupon-picker-grid">
                    <OptionPicker
                      title="Danh mục áp dụng"
                      emptyLabel="Toàn bộ danh mục"
                      searchPlaceholder="Tìm danh mục"
                      options={categoryOptions}
                      selectedValues={couponForm.applicableCategories}
                      onChange={(values) => updateSelectionField('applicableCategories', values)}
                    />
                    <OptionPicker
                      title="Sản phẩm áp dụng"
                      emptyLabel="Toàn bộ sản phẩm"
                      searchPlaceholder="Tìm sản phẩm"
                      options={productOptions}
                      selectedValues={couponForm.applicableProducts}
                      onChange={(values) => updateSelectionField('applicableProducts', values)}
                      onSearch={searchProducts}
                      isSearching={isSearchingProducts}
                    />
                  </div>
                </section>
              </div>

              <aside className="admin-coupon-side-panel" aria-label="Tóm tắt voucher">
                <div className="admin-coupon-preview">
                  <span>{couponForm.code || 'VOUCHER'}</span>
                  <strong>{formDiscountPreview}</strong>
                  <small>Đơn từ {formatCurrency(Number(couponForm.minOrderAmount || 0))}</small>
                </div>

                <div className="admin-coupon-summary">
                  <div>
                    <span>Đối tượng</span>
                    <strong>{formAudienceText}</strong>
                  </div>
                  <div>
                    <span>Phạm vi</span>
                    <strong>{formScopeText}</strong>
                  </div>
                  <div>
                    <span>Hạn dùng</span>
                    <strong>{formatDateTime(couponForm.endAt)}</strong>
                  </div>
                  <div>
                    <span>Lượt dùng</span>
                    <strong>{formUsageText}</strong>
                  </div>
                  <div>
                    <span>Hiển thị</span>
                    <strong>{couponForm.isPublic ? 'Public' : 'Private'} · {couponForm.isActive ? 'Đang bật' : 'Đang tắt'}</strong>
                  </div>
                </div>
              </aside>
            </div>

            <footer className="admin-dialog-actions admin-coupon-actions">
              <button className="admin-secondary-button" type="button" disabled={actionLoading} onClick={closeDialog}>
                Hủy
              </button>
              <button className="admin-primary-button" type="submit" disabled={actionLoading}>
                {actionLoading ? 'Đang lưu...' : 'Lưu voucher'}
              </button>
            </footer>
          </form>
        </div>
      ) : null}

      {dialog?.type === 'delete' ? (
        <div ref={dialogRef} tabIndex={-1} className="admin-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="admin-coupon-delete-title">
          <div className="admin-confirm-box">
            <h2 id="admin-coupon-delete-title">Xóa voucher?</h2>
            <p>
              {dialog.usageCount > 0 || dialog.coupon.usedCount > 0
                ? `Voucher ${dialog.coupon.code} đã ghi nhận ${Math.max(dialog.usageCount, dialog.coupon.usedCount)} lượt dùng hoặc giữ chỗ nên không thể xóa. Hãy tắt voucher để giữ dữ liệu đối soát.`
                : `Voucher ${dialog.coupon.code} chưa có lịch sử sử dụng và có thể được xóa.`}
            </p>
            <div className="admin-dialog-actions">
              <button className="admin-secondary-button" type="button" disabled={actionLoading} onClick={closeDialog}>
                Hủy
              </button>
              <button
                className="admin-danger-button"
                type="button"
                disabled={actionLoading || dialog.usageCount > 0 || dialog.coupon.usedCount > 0}
                onClick={() => void handleDeleteCoupon()}
              >
                {actionLoading ? 'Đang xử lý...' : dialog.usageCount > 0 || dialog.coupon.usedCount > 0 ? 'Không thể xóa' : 'Xóa voucher'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
