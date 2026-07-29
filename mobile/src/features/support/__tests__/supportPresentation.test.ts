import {
  canReopenSupportTicket,
  getSupportTicketStatusLabel,
  supportCategoryNeedsOrder,
  validateSupportImageAssets,
  validateSupportTicketDraft,
} from '../supportPresentation';

describe('support presentation helpers', () => {
  it('maps ticket labels and preserves unknown backend statuses', () => {
    expect(getSupportTicketStatusLabel('waiting_customer')).toBe('Cần bạn bổ sung');
    expect(getSupportTicketStatusLabel('escalated')).toBe('escalated');
  });

  it('requires an order only for order-related categories', () => {
    expect(supportCategoryNeedsOrder('orders')).toBe(true);
    expect(supportCategoryNeedsOrder('returns')).toBe(true);
    expect(supportCategoryNeedsOrder('payments')).toBe(true);
    expect(supportCategoryNeedsOrder('shipping')).toBe(false);
  });

  it('validates draft lengths before contextual order requirements', () => {
    expect(
      validateSupportTicketDraft({
        subject: 'Lỗi',
        body: 'Quá ngắn',
        category: 'orders',
        orderId: '',
      }),
    ).toContain('Tiêu đề');
    expect(
      validateSupportTicketDraft({
        subject: 'Đơn bị lỗi',
        body: 'Tôi cần shop kiểm tra đơn hàng này.',
        category: 'orders',
        orderId: '',
      }),
    ).toContain('đơn hàng');
    expect(
      validateSupportTicketDraft({
        subject: 'Góp ý app',
        body: 'Ứng dụng đang hoạt động rất ổn định.',
        category: 'app_website',
        orderId: '',
      }),
    ).toBe('');
  });

  it('rejects too many, unsupported, or oversized images', () => {
    const jpeg = { mimeType: 'image/jpeg', fileSize: 1024 };
    expect(validateSupportImageAssets([jpeg, jpeg, jpeg, jpeg])).toContain('tối đa 3');
    expect(validateSupportImageAssets([{ mimeType: 'image/gif' }])).toContain('JPEG');
    expect(
      validateSupportImageAssets([{ mimeType: 'image/png', fileSize: 5 * 1024 * 1024 + 1 }]),
    ).toContain('5MB');
    expect(validateSupportImageAssets([jpeg])).toBe('');
  });

  it('allows reopening only a resolved ticket before its deadline', () => {
    const now = Date.parse('2026-07-29T00:00:00.000Z');
    expect(canReopenSupportTicket('resolved', '2026-07-30T00:00:00.000Z', now)).toBe(true);
    expect(canReopenSupportTicket('resolved', '2026-07-28T00:00:00.000Z', now)).toBe(false);
    expect(canReopenSupportTicket('closed', '2026-07-30T00:00:00.000Z', now)).toBe(false);
    expect(canReopenSupportTicket('resolved', 'invalid', now)).toBe(false);
  });
});
