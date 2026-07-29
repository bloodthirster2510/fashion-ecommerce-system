import type { SupportCategory, SupportTicketStatus } from './support.types';

const MAX_SUPPORT_IMAGES = 3;
const MAX_SUPPORT_IMAGE_SIZE = 5 * 1024 * 1024;
const allowedSupportImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const orderRelatedCategories = new Set<SupportCategory>(['orders', 'returns', 'payments']);

const supportStatusLabels: Record<SupportTicketStatus, string> = {
  open: 'Đã tiếp nhận',
  in_progress: 'Đang xử lý',
  waiting_customer: 'Cần bạn bổ sung',
  resolved: 'Đã giải quyết',
  closed: 'Đã đóng',
};

export const getSupportTicketStatusLabel = (status: string) =>
  supportStatusLabels[status as SupportTicketStatus] ?? status;

export const supportCategoryNeedsOrder = (category: SupportCategory) =>
  orderRelatedCategories.has(category);

export const validateSupportTicketDraft = (input: {
  subject: string;
  body: string;
  category: SupportCategory;
  orderId: string;
}) => {
  if (input.subject.trim().length < 5 || input.body.trim().length < 10) {
    return 'Tiêu đề cần ít nhất 5 ký tự và nội dung ít nhất 10 ký tự.';
  }
  if (supportCategoryNeedsOrder(input.category) && !input.orderId.trim()) {
    return 'Vui lòng nhập/chọn đơn hàng liên quan.';
  }
  return '';
};

export const validateSupportImageAssets = (
  assets: Array<{ mimeType?: string | null; fileSize?: number | null }>,
) => {
  if (assets.length > MAX_SUPPORT_IMAGES) return 'Chỉ được chọn tối đa 3 ảnh.';
  if (assets.some((asset) => !allowedSupportImageTypes.has(asset.mimeType || ''))) {
    return 'Chỉ hỗ trợ ảnh JPEG, PNG hoặc WEBP.';
  }
  if (assets.some((asset) => (asset.fileSize ?? 0) > MAX_SUPPORT_IMAGE_SIZE)) {
    return 'Mỗi ảnh phải có dung lượng không quá 5MB.';
  }
  return '';
};

export const canReopenSupportTicket = (
  status: SupportTicketStatus,
  reopenDeadline?: string | null,
  now = Date.now(),
) => {
  if (status !== 'resolved' || !reopenDeadline) return false;
  const deadline = new Date(reopenDeadline).getTime();
  return Number.isFinite(deadline) && deadline >= now;
};
