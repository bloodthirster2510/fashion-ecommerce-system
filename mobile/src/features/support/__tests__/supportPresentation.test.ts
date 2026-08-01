import {
  canReopenSupportTicket,
  getSupportImageMimeType,
  getSupportTicketStatusLabel,
  shouldMarkIncomingSupportMessageRead,
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

  it('accepts a supported image extension when the device omits MIME metadata', () => {
    const pngWithoutMime = {
      mimeType: null,
      fileName: 'anh-minh-chung.PNG',
      uri: 'file:///cache/anh-minh-chung.PNG',
      fileSize: 1024,
    };

    expect(validateSupportImageAssets([pngWithoutMime])).toBe('');
    expect(getSupportImageMimeType(pngWithoutMime)).toBe('image/png');
  });

  it('allows reopening only a resolved ticket before its deadline', () => {
    const now = Date.parse('2026-07-29T00:00:00.000Z');
    expect(canReopenSupportTicket('resolved', '2026-07-30T00:00:00.000Z', now)).toBe(true);
    expect(canReopenSupportTicket('resolved', '2026-07-28T00:00:00.000Z', now)).toBe(false);
    expect(canReopenSupportTicket('closed', '2026-07-30T00:00:00.000Z', now)).toBe(false);
    expect(canReopenSupportTicket('resolved', 'invalid', now)).toBe(false);
  });

  it('marks only visible staff replies on the active ticket as read', () => {
    const base = {
      activeTicketId: 'ticket-1',
      eventTicketId: 'ticket-1',
      isFocused: true,
      isAppActive: true,
      senderType: 'staff' as const,
    };

    expect(shouldMarkIncomingSupportMessageRead(base)).toBe(true);
    expect(shouldMarkIncomingSupportMessageRead({ ...base, isFocused: false })).toBe(false);
    expect(shouldMarkIncomingSupportMessageRead({ ...base, isAppActive: false })).toBe(false);
    expect(shouldMarkIncomingSupportMessageRead({ ...base, eventTicketId: 'ticket-2' })).toBe(false);
    expect(shouldMarkIncomingSupportMessageRead({ ...base, senderType: 'customer' })).toBe(false);
  });
});
