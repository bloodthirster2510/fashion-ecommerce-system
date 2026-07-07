import { emptyTierForm, tierPalettePresets } from './loyalty.constants'
import type { LoyaltyPointHistory, MembershipRanking, MembershipRankingPayload } from './loyalty.types'
import type { TierFieldErrors, TierFormState } from './components/TierDialog'

export const formatNumber = (value: number | null | undefined) =>
  typeof value === 'number' ? new Intl.NumberFormat('vi-VN').format(value) : 'Không giới hạn'

export const formatHistoryDate = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
}).format(new Date(value))

export const getHistoryActor = (history: LoyaltyPointHistory) => {
  if (history.actorId && typeof history.actorId === 'object') {
    return history.actorId.name
  }

  const roleLabels: Record<LoyaltyPointHistory['actorRole'], string> = {
    admin: 'Admin',
    staff: 'Nhân viên',
    system: 'Hệ thống',
    user: 'Khách hàng',
  }
  return roleLabels[history.actorRole]
}

export const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Không thể xử lý yêu cầu'

export const toTierForm = (tier: MembershipRanking): TierFormState => ({
  name: tier.name,
  level: String(tier.level),
  minPoint: String(tier.minPoint),
  maxPoint: tier.maxPoint === null || tier.maxPoint === undefined ? '' : String(tier.maxPoint),
  discountPercent: String(tier.discountPercent),
  benefitDescription: tier.benefitDescription ?? '',
  cardColor: tier.cardColor ?? '#5b788a',
  textColor: tier.textColor ?? '#ffffff',
  badgeColor: tier.badgeColor ?? tier.cardColor ?? '#5b788a',
  iconName: tier.iconName ?? 'star',
  isActive: tier.isActive !== false,
})

export const getSuggestedTierForm = (tiers: MembershipRanking[]): TierFormState => {
  const orderedTiers = [...tiers].sort((first, second) => first.level - second.level)
  const lastTier = orderedTiers[orderedTiers.length - 1]
  const previousTier = orderedTiers[orderedTiers.length - 2]
  const nextLevel = lastTier ? lastTier.level + 1 : 1
  const pointStep = lastTier
    ? Math.max(1000, previousTier ? lastTier.minPoint - previousTier.minPoint : Math.max(lastTier.minPoint, 1000))
    : 0
  const palette = tierPalettePresets[(nextLevel - 1) % tierPalettePresets.length]
  const nextDiscount = lastTier ? Math.min(30, Math.round((lastTier.discountPercent + 2) * 10) / 10) : 0

  return {
    ...emptyTierForm,
    name: nextLevel <= tierPalettePresets.length ? palette.name : `Hạng ${nextLevel}`,
    level: String(nextLevel),
    minPoint: String(lastTier ? lastTier.minPoint + pointStep : 0),
    discountPercent: String(nextDiscount),
    benefitDescription: lastTier
      ? `Quyền lợi cao hơn ${lastTier.name}; chỉnh lại ưu đãi trước khi lưu.`
      : 'Tích điểm và nhận ưu đãi dành cho thành viên.',
    cardColor: palette.card,
    textColor: palette.text,
    badgeColor: palette.badge,
    iconName: nextLevel >= 5 ? 'diamond-stone' : nextLevel >= 3 ? 'crown' : 'star',
  }
}

const getRelativeLuminance = (hexColor: string) => {
  const channels = hexColor.slice(1).match(/.{2}/g)
  if (!channels || channels.length !== 3) {
    return 0
  }

  const [red, green, blue] = channels.map((channel) => {
    const value = Number.parseInt(channel, 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

export const getContrastRatio = (firstColor: string, secondColor: string) => {
  const first = getRelativeLuminance(firstColor)
  const second = getRelativeLuminance(secondColor)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

export const validateTierForm = (form: TierFormState): TierFieldErrors => {
  const errors: TierFieldErrors = {}
  const level = Number(form.level)
  const minPoint = Number(form.minPoint)
  const discountPercent = Number(form.discountPercent)
  if (form.name.trim().length < 2) errors.name = 'Tên hạng cần ít nhất 2 ký tự.'
  if (!Number.isInteger(level) || level < 1 || level > 20) errors.level = 'Cấp hạng phải là số nguyên từ 1 đến 20.'
  if (!Number.isInteger(minPoint) || minPoint < 0 || minPoint > 100000000) errors.minPoint = 'Điểm tối thiểu phải là số nguyên từ 0 đến 100.000.000.'
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) errors.discountPercent = 'Mức giảm phải nằm trong khoảng 0-100%.'
  if (form.benefitDescription.trim().length < 2) errors.benefitDescription = 'Quyền lợi cần ít nhất 2 ký tự.'
  if (!/^#[0-9a-f]{6}$/i.test(form.cardColor)) errors.cardColor = 'Màu thẻ không hợp lệ.'
  if (!/^#[0-9a-f]{6}$/i.test(form.textColor)) errors.textColor = 'Màu chữ không hợp lệ.'
  if (getContrastRatio(form.cardColor, form.textColor) < 4.5) errors.textColor = 'Màu chữ và nền cần độ tương phản tối thiểu 4.5:1.'
  return errors
}

export const toTierPayload = (form: TierFormState): MembershipRankingPayload => {
  const name = form.name.trim()
  const level = Number(form.level)
  const minPoint = Number(form.minPoint)
  const discountPercent = Number(form.discountPercent)

  if (name.length < 2) {
    throw new Error('Tên hạng phải có ít nhất 2 ký tự')
  }

  if (!Number.isInteger(level) || level < 1 || level > 20) {
    throw new Error('Cấp hạng phải là số nguyên từ 1 đến 20')
  }

  if (!Number.isInteger(minPoint) || minPoint < 0 || minPoint > 100000000) {
    throw new Error('Điểm tối thiểu phải là số nguyên từ 0 đến 100.000.000')
  }

  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
    throw new Error('Mức giảm giá phải nằm trong khoảng 0-100%')
  }

  if (getContrastRatio(form.cardColor, form.textColor) < 4.5) {
    throw new Error('Màu chữ và màu nền thẻ chưa đủ tương phản')
  }

  return {
    name,
    level,
    minPoint,
    discountPercent,
    benefitDescription: form.benefitDescription.trim(),
    cardColor: form.cardColor,
    textColor: form.textColor,
    badgeColor: form.badgeColor,
    iconName: form.iconName,
    isActive: form.isActive,
  }
}
