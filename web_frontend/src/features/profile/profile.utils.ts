import { formatPrice } from '../../utils/formatPrice'
import type { OrderItem } from '../orders/order.types'
import type { AvailableCouponItem, MembershipTier, UserAddress } from './profile.service'

export const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

export const formatDateForInput = (value?: string) => {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return date.toISOString().slice(0, 10)
}

export const formatDisplayDate = (value?: string) => {
  if (!value) return 'Đang cập nhật'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Đang cập nhật'

  return new Intl.DateTimeFormat('vi-VN').format(date)
}

const normalizeAddressText = (value?: string | null) => value?.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi') ?? ''

export const getCleanStreetName = (address?: UserAddress | null) => {
  if (!address?.streetName) return ''

  const locationParts = [address.ward, address.district, address.province]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(normalizeAddressText)
  const streetParts = address.streetName
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  while (streetParts.length > 1) {
    const lastPart = normalizeAddressText(streetParts[streetParts.length - 1])
    if (!locationParts.includes(lastPart)) break
    streetParts.pop()
  }

  return streetParts.join(', ')
}

export const getAddressFormValues = (address?: UserAddress | null) => ({
  streetName: getCleanStreetName(address),
  provinceId: address?.ghnProvinceId ?? address?.provinceId ?? undefined,
  districtId: address?.ghnDistrictId ?? address?.districtId ?? undefined,
  wardCode: address?.ghnWardCode ?? address?.wardCode ?? undefined,
})

export const formatAddressLine = (address: UserAddress) => (
  [getCleanStreetName(address), address.ward, address.district, address.province].filter(Boolean).join(', ')
)

export const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('Không thể đọc file ảnh.'))
  reader.readAsDataURL(file)
})

export const isObjectIdText = (value?: string) => Boolean(value && /^[a-f\d]{24}$/i.test(value))

export const getOrderItemMeta = (item: OrderItem) => {
  const fitType = isObjectIdText(item.fitType) ? '' : item.fitType
  return [item.size ? `Size: ${item.size}` : '', item.color ? `Màu: ${item.color}` : '', fitType]
    .filter((value) => value.trim())
    .join(' | ')
}

export const formatPoint = (value?: number | null) => new Intl.NumberFormat('vi-VN').format(value ?? 0)

export const getTierCondition = (tier: MembershipTier) => {
  const minPoint = formatPoint(tier.minPoint)
  if (tier.maxPoint === null) return `Từ ${minPoint} điểm trở lên`
  return `Từ ${minPoint} điểm đến dưới ${formatPoint(tier.maxPoint + 1)} điểm`
}

export const getTierBenefit = (tier: MembershipTier) => (
  tier.discountPercent > 0 ? `Giảm ${tier.discountPercent}% trên mỗi hóa đơn` : tier.benefitDescription || 'Tích điểm đổi quà/voucher'
)

export const formatCouponValue = (coupon: AvailableCouponItem['coupon']) => {
  if (coupon.discountType === 'free_shipping') return 'Miễn phí ship'
  if (coupon.discountType === 'percent') return `${coupon.discountValue}%`
  return formatPrice(coupon.discountValue)
}
