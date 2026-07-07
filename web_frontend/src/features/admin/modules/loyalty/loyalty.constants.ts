import type { LoyaltyPagination } from './loyalty.types'
import type { TierFormState, TierTemplate } from './components/TierDialog'

export const emptyPagination: LoyaltyPagination = {
  page: 1,
  limit: 10,
  totalItems: 0,
  totalPages: 0,
}

export const tierDraftKey = 'fashionista.admin.tier-draft'

export const emptyTierForm: TierFormState = {
  name: '',
  level: '',
  minPoint: '',
  maxPoint: '',
  discountPercent: '',
  benefitDescription: '',
  cardColor: '#5b788a',
  textColor: '#ffffff',
  badgeColor: '#5b788a',
  iconName: 'star',
  isActive: true,
}

export const tierPalettePresets = [
  { name: 'Đồng', card: '#8f5b34', text: '#ffffff', badge: '#d19a66' },
  { name: 'Bạc', card: '#59636e', text: '#ffffff', badge: '#c0c7cf' },
  { name: 'Vàng', card: '#6f5310', text: '#ffffff', badge: '#d4af37' },
  { name: 'Bạch kim', card: '#1f2937', text: '#ffffff', badge: '#d1d5db' },
  { name: 'Kim cương', card: '#20546b', text: '#ffffff', badge: '#8bd5ee' },
  { name: 'VIP', card: '#3f3f46', text: '#ffffff', badge: '#facc15' },
]

export const iconOptions = [
  { value: 'star', label: 'Ngôi sao' },
  { value: 'shield-star', label: 'Khiên sao' },
  { value: 'crown', label: 'Vương miện' },
  { value: 'diamond-stone', label: 'Kim cương' },
  { value: 'medal-outline', label: 'Huy chương' },
  { value: 'trophy-outline', label: 'Cúp' },
  { value: 'certificate-outline', label: 'Chứng nhận' },
]

export const tierTemplates: TierTemplate[] = [
  {
    label: 'Đồng',
    values: {
      name: 'Đồng',
      level: '1',
      minPoint: '0',
      discountPercent: '0',
      cardColor: '#8f5b34',
      textColor: '#ffffff',
      badgeColor: '#d19a66',
      iconName: 'medal-outline',
      benefitDescription: 'Tích điểm và nhận ưu đãi dành cho thành viên.',
    },
  },
  {
    label: 'Bạc',
    values: {
      name: 'Bạc',
      level: '2',
      minPoint: '1000',
      discountPercent: '3',
      cardColor: '#59636e',
      textColor: '#ffffff',
      badgeColor: '#c0c7cf',
      iconName: 'shield-star',
      benefitDescription: 'Giảm 3%, ưu tiên nhận voucher và chương trình dành riêng.',
    },
  },
  {
    label: 'Vàng',
    values: {
      name: 'Vàng',
      level: '3',
      minPoint: '5000',
      discountPercent: '5',
      cardColor: '#6f5310',
      textColor: '#ffffff',
      badgeColor: '#d4af37',
      iconName: 'crown',
      benefitDescription: 'Giảm 5%, ưu tiên chăm sóc và nhận ưu đãi sinh nhật.',
    },
  },
  {
    label: 'Kim cương',
    values: {
      name: 'Kim cương',
      level: '4',
      minPoint: '20000',
      discountPercent: '10',
      cardColor: '#20546b',
      textColor: '#ffffff',
      badgeColor: '#8bd5ee',
      iconName: 'diamond-stone',
      benefitDescription: 'Giảm 10%, đặc quyền cao nhất và ưu tiên hỗ trợ.',
    },
  },
]

export const membershipIconSymbols: Record<string, string> = {
  star: '★',
  'shield-star': '✦',
  crown: '♛',
  'diamond-stone': '◆',
  certificate: '✪',
  'certificate-outline': '☆',
}

export const policyCards = [
  {
    title: 'Cộng điểm',
    value: '1 điểm / 1.000đ',
    note: 'Chỉ cộng khi đơn hàng đã giao thành công.',
  },
  {
    title: 'Trừ điểm',
    value: 'Điều chỉnh giảm',
    note: 'Áp dụng khi hoàn trả hoặc cần thu hồi điểm đã cộng.',
  },
  {
    title: 'Giảm theo hạng',
    value: 'Sau coupon sản phẩm',
    note: 'Tính vào phần giảm giá thành viên của đơn hàng.',
  },
]

export const integrationChecks = [
  'Voucher có thể áp dụng riêng cho từng hạng thành viên.',
  'Trang thanh toán tự xác định hạng từ điểm tích lũy hiện tại.',
  'Khách hàng xem hạng, điểm và tiến trình nâng hạng trong hồ sơ.',
  'CSKH có nhóm vấn đề thành viên để xử lý khiếu nại điểm hoặc hạng.',
  'Mọi thay đổi hạng và quy tắc điểm cần được ghi lịch sử quản trị.',
]
