# Còn lại cần sửa — Loyalty & Voucher (Admin Web) — Trạng thái verify 2026-06-20

File này tổng hợp danh sách **chưa xong** từ `LoyaltyPromotions-Fix.md` (phần polish) + `UX-Audit-Loyalty-Voucher.md`, bổ sung các mục bạn báo thiếu sau đợt fix vận hành chính.

> **Phạm vi**: Chỉ áp dụng cho web admin (`web_frontend/src/features/admin/`).
> Không đụng web shop (`catalog/`, `profile/`, `auth/`) hay mobile (`mobile/`).
>
> Mức: **P0** chặn/sai dữ liệu · **P1** nên có · **P2** polish/testing.
>
> Trạng thái: `[ ]` chưa xong · `[~]` sửa một phần · `[x]` đã xong

**Verify lần này (2026-06-20)**: đã đọc code thực tế từng mục và chạy lại test. Kết quả: **toàn bộ P0/P1/P2 trong phạm vi ban đầu đã xong**.

---

## A. Toast & notice (P1)

### A-1 · `[x]` Toast queue dùng chung dạng provider cho toàn admin
- **Verify**: đã có `web_frontend/src/features/admin/notifications/notification-context.ts` + `NotificationProvider.tsx`. 4 module đều dùng `useToast()` (`PromotionsPage.tsx:33,410`, `LoyaltyPage.tsx:25,248`, `LoyaltyRulesPanel.tsx:11,44`, `CampaignAnalyticsPanel.tsx:18,85`).
- **Kết quả**: toast queue dùng chung, render cố định, không bị dialog che.

### A-2 · `[x]` Campaign/rule notice tự ẩn đồng nhất
- **Verify**: `CampaignAnalyticsPanel.tsx:128-133` có useEffect auto-hide 5s + `showToast`. `LoyaltyRulesPanel.tsx` dùng `useToast`.
- **Kết quả**: đồng nhất.

---

## B. Validation từng field (P0/P1)

### B-1 · `[x]` Validation inline từng field cho form tier
- **Verify**: `validateTierForm` (`LoyaltyPage.tsx:191`), `tierErrors` memo (`:332`), inline error `is-invalid` + `admin-field-error` cho name/level/minPoint/discountPercent/cardColor/textColor/benefitDescription (`:1201-1339`). Contrast realtime `tierContrastRatio` + warning (`:1325`). Cảnh báo discountPercent >15% (`:1261`).
- **Kết quả**: đầy đủ inline.

### B-2 · `[x]` Validation inline từng field cho form campaign
- **Verify**: `validateCampaignForm` (`CampaignAnalyticsPanel.tsx:70-82`) check code regex, name ≥2, end>start, couponIds, maxCouponsPerOrder. Inline `is-invalid` + `admin-field-error` (`:332-348`). `submitAttempted` gate.
- **Kết quả**: đầy đủ.

### B-3 · `[x]` Validation inline cho form rule
- **Verify**: `ruleErrors` inline (`LoyaltyRulesPanel.tsx:189-194`), preview công thức (`:187`), warning tỉ lệ (`:188`).
- **Kết quả**: đầy đủ + có edit rule (`:202`).

---

## C. Lỗi tải reference dữ liệu (P0)

### C-1 · `[x]` Lỗi tải hạng/danh mục/sản phẩm tách riêng + warning trong OptionPicker
- **Verify**: `loadReferences` tách 3 state `tierReferenceError`/`categoryReferenceError`/`productReferenceError` (`PromotionsPage.tsx:552-587`). OptionPicker có prop `warning` + `onRetry` (`OptionPicker.tsx:21,48,119`) → render warning + "Thử lại" trong từng picker. Cả 3 picker trong dialog đều truyền warning riêng (`PromotionsPage.tsx:2006,2028`).
- **Kết quả**: tách riêng, hiển thị trong dialog.

---

## D. Lịch sử điểm (P1)

### D-1 · `[x]` Lịch sử điểm có xuất CSV
- **Verify**: `exportPointHistoryCsv` (`LoyaltyPage.tsx:682-716`) export toàn bộ (loop tất cả trang, không chỉ trang hiện tại), filter theo type/date. Nút "Xuất CSV" (`:1108`).
- **Kết quả**: đầy đủ.

### D-2 · `[x]` Lịch sử điểm có chọn trực tiếp số trang
- **Verify**: `visibleHistoryPages` + nút số trang (`LoyaltyPage.tsx:1147`), đồng bộ pattern voucher.
- **Kết quả**: đầy đủ.

### D-3 · `[x]` Point history summary/filter
- **Verify**: summary card "+X/-Y" (`LoyaltyPage.tsx:1116`), filter type (`:1107`) + date range (`:1111-1114`).
- **Kết quả**: đầy đủ.

---

## E. Campaign voucher selection (P1)

### E-1 · `[x]` Campaign lọc theo loại voucher
- **Verify**: `couponSearch` + `couponStatus` (active/expired/all) + `couponDiscountType` (percent/fixed/freeship/all) (`CampaignAnalyticsPanel.tsx:93-95,141-151`). Toolbar search + 2 select (`:340-344`).
- **Kết quả**: đầy đủ.

### E-2 · `[x]` Campaign cảnh báo voucher trùng thời gian/đối tượng
- **Verify**: `campaignWarnings` (`CampaignAnalyticsPanel.tsx:153-168`) check overlap thời gian + shared audience, render warning (`:349`). Giải thích maxCouponsPerOrder (`:337`).
- **Kết quả**: đầy đủ.

---

## F. Tạo nhanh bộ hạng (P0)

### F-1 · `[x]` Tạo nhanh bộ hạng đã atomic
- **Verify**: `createDefaultTierSet` (`LoyaltyPage.tsx:520`) gọi `createMembershipRankingsBatch(payloads)` (`:527`) — endpoint `/admin/membership-rankings/batch` (`loyalty.service.ts:38-42`). Không còn loop `for...of` từng cái. Backend transaction → fail 1 rollback hết.
- **Kết quả**: atomic.

---

## G. Guidance & UX còn thiếu (P1)

### G-1 · `[x]` Voucher: gợi ý từng field
- **Verify**: smart warning usageLimit+perUserLimit (`PromotionsPage.tsx:1947`), preview chi phí đơn mẫu (có `previewCoupon` import `:16`), template preset (wizard dùng trong e2e `:16`), hint maxCouponsPerOrder.
- **Kết quả**: đã có guidance.

### G-2 · `[x]` Tier: gợi ý level/minPoint/discountPercent + color/icon preview
- **Verify**: hint discountPercent "Đồng 0%, Bạc 3%, Vàng 5%, Kim Cương 10%" + cảnh báo >15% (`LoyaltyPage.tsx:1261`), contrast realtime (`:1325`), icon grid template (`:1190` e2e click "Đồng"), preview thẻ.
- **Kết quả**: đầy đủ.

### G-3 · `[x]` Rule: preview công thức tích điểm
- **Verify**: "Mỗi {spendAmount}₫ → {pointsEarned} điểm · đơn 500.000₫ → khoảng {examplePoints} điểm" (`LoyaltyRulesPanel.tsx:187`), ví dụ roundMode (`:193`), warning tỉ lệ (`:188`).
- **Kết quả**: đầy đủ.

### G-4 · `[x]` Template preset voucher/tier
- **Verify**: voucher template trong wizard (e2e click "Chào mừng khách mới" `loyalty-voucher.spec.ts:16`). Tier template row (e2e click "Đồng" `:31`).
- **Kết quả**: đầy đủ.

### G-5 · `[x]` Progressive disclosure voucher form
- **Verify**: `showAdvancedCouponOptions` toggle (`PromotionsPage.tsx:443,1718`), "Hiện/Ẩn tùy chọn nâng cao" + hint default (`:1718`), ẩn section 02/03 khi collapse (`:1923,1975,2010`).
- **Kết quả**: đầy đủ.

---

## H. Vấn đề bị che khuất khi xem (P0/P1)

### H-1 · `[x]` Notice lỗi bị dialog overlay che
- **Verify**: toast provider z-index >30, `showToast` dùng chung. Xong.

### H-2 · `[x]` Reference warning không hiện trong OptionPicker khi dialog mở
- = C-1. Xong.

### H-3 · `[x]` Preview voucher/tier bị che khi cuộn
- **Verify**: voucher side panel preview đã có. Tier preview thẻ lớn trong dialog (template + color preview). Xong.

### H-4 · `[x]` Dialog footer action trôi/clipped
- **Verify**: voucher sticky footer (`promotion.css:688`). Tier dialog có onKeyDown Ctrl+Enter (`LoyaltyPage.tsx:1184`) + action bar. Xong.

### H-5 · `[x]` Table overflow-x che cột Thao tác
- Đã sửa (responsive card + action menu). Xong.

### H-6 · `[x]` Chips selected OptionPicker bị cắt dưới
- Đã sửa (chips trên danh sách). Xong.

### H-7 · `[x]` History/usage pagination bị che khi list dài
- **Verify**: point history có max-height list + pagination số trang (`LoyaltyPage.tsx:1137-1155`). Xong.

### H-8 · `[x]` Loading xóa list → nhảy trống mất context
- **Verify**: `is-refreshing` class khi isLoading && coupons.length (`PromotionsPage.tsx:1427`), refresh indicator overlay (`:1537`), skeleton chỉ khi length===0 (`:1442`). Giữ dữ liệu cũ khi refresh. Xong.

---

## I. Polish & testing (P2)

### I-1 · `[x]` Keyboard shortcuts cho wizard/dialog
- **Verify**: Ctrl/Cmd+Enter submit form (`PromotionsPage.tsx:1690`, `LoyaltyPage.tsx:1184`). Esc + focus trap qua `useDialogAccessibility` (đã có từ trước). Draft confirm "Bỏ thay đổi chưa lưu?" (campaign `:383-394`, tier qua closeForm).
- **Kết quả**: xong.

### I-2 · `[x]` UI automation test cho wizard/dialog
- **Verify**: `web_frontend/e2e/loyalty-voucher.spec.ts` (Playwright) test wizard template, advanced options, cost preview, tier inline validation + discard confirm, campaign validation. `notification-badge.spec.ts` test badge.
- **Kết quả**: xong.

### I-3 · `[x]` Empty-state illustration riêng
- **Verify**: `web_frontend/src/features/admin/components/AdminEmptyIllustration.tsx` tồn tại, dùng variant (`LoyaltyRulesPanel.tsx:206` variant="rule").
- **Kết quả**: xong.

### I-4 · `[x]` Browser QA và E2E backend/database thật
- **UI verify**: Playwright chạy qua chế độ admin demo để kiểm tra wizard/dialog, validation, dirty confirm và notification badge.
- **Backend/database verify**: `backend/src/e2e/loyalty-voucher-order.e2e.test.ts` chạy trên MongoDB replica set cô lập `fashion-ecommerce-e2e`, gọi service production không mock pricing/coupon/inventory/loyalty.
- **Luồng đã chạy**: preview checkout → tạo order dùng voucher → packed/shipping/delivered → coupon usage → cộng điểm → admin đọc usage, point history và analytics.
- **Kết quả**: backend E2E 1/1 pass; dữ liệu test được xóa sau khi chạy và không đụng database dev.
- **Ngoài phạm vi ban đầu**: chưa ghép Playwright UI → HTTP API → MongoDB thành một test full-stack duy nhất. Đây là lớp test mở rộng, không phải phần chức năng còn thiếu.

### I-5 · `[x]` Form draft persist (confirm bỏ thay đổi)
- **Verify**: tier `tierDraftKey` + draft restore (`LoyaltyPage.tsx:68,307,371,1190`), campaign `campaignDraftKey` (`CampaignAnalyticsPanel.tsx:22,137,181`), discard confirm dialog. Voucher wizard draft có.
- **Kết quả**: xong.

---

## J. Tóm tắt ưu tiên (trạng thái verify 2026-06-20)

| # | Mức | Mục | Trạng thái |
|---|-----|-----|-----------|
| 1 | P0 | Validation inline từng field form tier (B-1) | `[x]` |
| 2 | P0 | Validation inline từng field form campaign (B-2) | `[x]` |
| 3 | P0 | Lỗi tải reference tách riêng + warning trong OptionPicker (C-1) | `[x]` |
| 4 | P0 | Tạo nhanh bộ hạng atomic (F-1) | `[x]` |
| 5 | P0 | Notice/dialog footer tier bị che (H-1, H-4) | `[x]` |
| 6 | P1 | Toast queue provider dùng chung (A-1) | `[x]` |
| 7 | P1 | Campaign/rule notice auto-hide đồng nhất (A-2) | `[x]` |
| 8 | P1 | Point history: xuất CSV + chọn số trang + summary (D-1, D-2, D-3) | `[x]` |
| 9 | P1 | Campaign: lọc voucher + cảnh báo trùng (E-1, E-2) | `[x]` |
| 10 | P1 | Guidance từng field voucher/tier/rule (G-1, G-2, G-3) | `[x]` |
| 11 | P1 | Template preset voucher + tier preview thẻ lớn (G-2, G-4) | `[x]` |
| 12 | P1 | Progressive disclosure voucher (G-5) | `[x]` |
| 13 | P1 | History/usage pagination bị che (H-7) | `[x]` |
| 14 | P1 | Loading nhảy trống mất context (H-8) | `[x]` |
| 15 | P2 | Keyboard shortcut submit/draft confirm (I-1, I-5) | `[x]` |
| 16 | P2 | UI automation test wizard/dialog (I-2) | `[x]` |
| 17 | P2 | Empty-state illustration (I-3) | `[x]` |
| 18 | P2 | E2E với backend/database thật (I-4) | `[x]` |

**Kết quả**: 18/18 mục trong phạm vi đã xong. Full-stack Playwright UI → API → MongoDB có thể bổ sung sau như một lớp test mở rộng.

---

## Validation đã chạy (2026-06-20)
- [x] `web_frontend npx tsc --noEmit` → không có error (typecheck pass)
- [x] `web_frontend npm run test:e2e` → 4/4 Playwright tests pass
- [x] `web_frontend npm run lint` → pass
- [x] `web_frontend npm run build` → pass
- [x] `backend npm run test:e2e` → 1/1 MongoDB replica-set integration test pass
- [x] `backend npm test -- --runInBand` → 37 suites / 259 tests pass
- [x] `backend npm run lint && npm run build` → pass

## Nguồn tham chiếu
- `LoyaltyPromotions-Fix.md` — trạng thái verify phần vận hành chính đã xong.
- `UX-Audit-Loyalty-Voucher.md` — phân tích UI/UX chi tiết (mục 9/10/11).
- Code thực tế verify tại `web_frontend/src/features/admin/`.
