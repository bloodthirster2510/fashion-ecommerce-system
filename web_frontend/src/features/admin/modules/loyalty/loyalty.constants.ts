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
    title: 'Cách xét hạng',
    value: 'Theo điểm tích lũy hiện tại',
    note: 'Khách được đưa vào hạng cao nhất mà số điểm đang có đạt đủ mốc tối thiểu.',
  },
  {
    title: 'Mốc điểm',
    value: 'Hạng sau phải cao hơn hạng trước',
    note: 'Mốc điểm không được trùng hoặc thấp hơn hạng liền trước để tránh xếp sai hạng.',
  },
  {
    title: 'Trạng thái hạng',
    value: 'Chỉ hạng đang áp dụng mới có hiệu lực',
    note: 'Hạng tạm tắt không còn dùng để xếp hạng mới hoặc tính quyền lợi cho khách.',
  },
]

export const integrationChecks = [
  'Voucher có thể giới hạn cho một hoặc nhiều hạng thành viên.',
  'Trang thanh toán tự lấy hạng hiện tại để tính ưu đãi cho đơn hàng.',
  'Hồ sơ khách hàng hiển thị hạng, điểm và tiến độ lên hạng tiếp theo.',
  'Nhân viên CSKH dùng thông tin điểm và hạng để xử lý khiếu nại.',
  'Các thay đổi điểm, hạng và quy tắc tích điểm nên được ghi lại để đối soát.',
]
