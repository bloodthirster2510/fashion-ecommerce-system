# Phân tích UI/UX — Chương trình thành viên & Voucher (Admin Web)

Phạm vi: `web_frontend/src/features/admin/modules/loyalty/*` và `web_frontend/src/features/admin/modules/promotions/*`.
Mục tiêu: liệt kê cụ thể những điểm yếu về UX và đề xuất thay đổi để bàn giao lại cho dev sửa.

> **Ghi chú phạm vi**: Tất cả đề xuất trong file này **chỉ áp dụng cho web admin** (`web_frontend/src/features/admin/`).
> KHÔNG đụng tới web shop (`web_frontend/src/features/catalog/`, `profile/`, `auth/`) hay mobile app (`mobile/`).
> Khi triển khai, chỉ sửa file trong `web_frontend/src/features/admin/`.

Mức ưu tiên: **P0** (chặn trải nghiệm / sai lệch dữ liệu) · **P1** (nên có) · **P2** (tinh chỉnh).

---

## 1. Tạo / sửa voucher (dialog form)

Nguồn: `PromotionsPage.tsx:1250-1600`, `promotion.css:39-692`.

### P0 — Phá trải nghiệm
- **Form quá dài, không phân bước.** 5 section dọc (`01–05`) + side panel, `max-height: min(92svh, 820px)` (`promotion.css:41`) → người dùng phải cuộn nhiều, dễ quên ô nào chưa điền. Đề xuất: chuyển thành **stepper 3 bước** (① Thông tin + giá trị → ② Thời gian + đối tượng → ③ Phạm vi + xem lại) hoặc ít nhất làm **sticky section index** bên cạnh.
- **Validation chỉ chạy khi submit.** `toCouponPayload` (`PromotionsPage.tsx:300-362`) `throw Error` rồi hiện `notice` banner (`handleSubmitCoupon:749`). Không có **inline field error** (không border đỏ, không message dưới ô), người dùng không biết ô nào sai. Đề xuất: validate realtime + hiển thị lỗi ngay dưới từng field.
- **Mã voucher không check trùng khi gõ.** Chỉ `checkCouponCodeAvailability` trong `handleSubmitCoupon:730` → báo lỗi sau khi bấm Lưu. Đề xuất: debounce check khi nhập mã + badge "Đã tồn tại/Còn trống" cạnh ô mã.
- **Lỗi validation bị che.** `notice` render ở ngoài dialog (`PromotionsPage.tsx:956`), trong khi dialog đang mở → người dùng trong dialog không thấy lỗi. Đề xuất: notice lỗi của form phải hiển thị **bên trong dialog** (header/footer dialog).

### P1 — Nên có
- **Khi chọn `free_shipping`, ô "Giá trị giảm" bị `disabled` nhưng vẫn hiển thị** (`PromotionsPage.tsx:1354,1359`) → lộn xộn thị giác. Đề xuất: ẩn hoàn toàn ô giá trị giảm khi free_shipping, chỉ hiện ghi chú "Không cần nhập giá trị".
- **Preset giá trị gợi ý** (`percentPresets`/`fixedPresets`, `PromotionsPage.tsx:115-116`) chỉ là 4 giá trị cứng. Đề xuất: thêm "Tùy chỉnh" và gợi ý theo context (ví dụ voucher thành viên hạng cao → gợi ý % cao hơn).
- **Duration preset** (`durationPresets`, `PromotionsPage.tsx:117-122`) bấm vào chỉ set `endAt` theo `startAt` nhưng **không preview ngày kết quả** trước khi bấm. Đề xuất: chip hiển thị "→ 20/06/2026" khi hover/preview.
- **`datetime-local` native** (`PromotionsPage.tsx:1426,1436`) giao diện xấu, không đồng bộ định dạng vi-VN, không có quick-pick giờ (00:00 / 23:59). Đề xuất: dùng date/time picker tùy biến hoặc thêm 2 nút quick "Cả ngày" / "Đến cuối ngày".
- **Side panel preview** (`PromotionsPage.tsx:1560-1589`) chỉ là text, không phản ánh đúng **voucher card mà khách nhìn thấy** trên web/app. Đề xuất: render preview mô phỏng card voucher thật (mã, %, đơn tối thiểu, hạn) đúng visual khách thấy.
- **Không có nút "Lưu nháp"/draft.** Đóng dialog (`closeDialog`) = mất toàn bộ form. Đề xuất: localStorage draft hoặc confirm trước khi đóng khi form đã dirty.

### P2 — Tinh chỉnh
- Section header số `01–05` (`promotion.css:150-161`) đẹp nhưng không click-to-scroll được. Cho click để nhảy tới section.
- "Nhân bản" (`openDuplicateDialog:586`) sinh code `{code}_COPY` + name `... (bản sao)` — nên tự sinh mã mới ngẫu nhiên + đặt isActive=false rõ hơn (đã làm, nhưng chưa thông báo cho người dùng biết mã mới là gì).

---

## 2. OptionPicker (chọn hạng/danh mục/sản phẩm)

Nguồn: `OptionPicker.tsx`, `promotion.css:419-578`.

### P0
- **Tìm sản phẩm không có load-more / infinite scroll.** `searchProducts` (`PromotionsPage.tsx:502-531`) thay thế danh sách `products` state mỗi lần search → mất các lựa chọn đã load trước đó nếu query đổi. Đề xuất: append kết quả + nút "Tải thêm" hoặc virtualized list với paging backend.
- **Virtualize thủ công bằng `translateY`** (`OptionPicker.tsx:130-138`) dễ lệch khi chiều cao item thay đổi (text 2 dòng). Đề xuất: dùng thư viện virtualization (react-window/tanstack-virtual) hoặc đảm bảo `optionRowHeight` cố định đúng `48px`.

### P1
- **Chips selected** (`OptionPicker.tsx:158-166`) nằm dưới danh sách → khi chọn nhiều phải cuộn xuống mới thấy. Đề xuất: hiểnển chips **trên cùng** (giống tag input) để dễ gỡ.
- **Không hiển thị tổng số options** (ví dụ "12/320 sản phẩm"). Người dùng không biết có bao nhiêu để chọn.
- **Không có "Chọn tất cả"/"Bỏ chọn tất cả"** khi danh mục lớn.

### P2
- Ô search xuất hiện khi `options.length > 8` (`OptionPicker.tsx:111`) — ngưỡng hơi tùy tiện, nên luôn hiện khi có `onSearch` (vì search backend luôn cần).

---

## 3. Danh sách voucher (table)

Nguồn: `PromotionsPage.tsx:906-1115`, `promotion.css:16-37`.

### P0
- **6 action text-button trên 1 hàng** (`PromotionsPage.tsx:1060-1106`: Xem/Sửa/Nhân bản/Tắt|Bật/Xóa) → tràn ngang, khó bấm trên mobile. Đề xuất: gom vào **dropdown "⋯" menu** với item chính (Xem/Sửa) + divider + danger (Xóa).
- **Bảng `min-width: 1060px`** (`promotion.css:17`) → overflow ngang trên màn nhỏ, không có card-view responsive. Đề xuất: breakpoint <980px chuyển sang **card list** thay vì table.

### P1
- **Stats nhãn gây nhầm** (`PromotionsPage.tsx:889-902`): "Đang chạy **trên trang này**", "Lượt đã dùng **trên trang này**" — "trang này" dễ bị hiểu là cả hệ thống. Đề xuất: đổi thành "trên trang hiện tại (page X)" hoặc tách 2 nhóm: tổng hệ thống vs. page hiện tại.
- **Không filter theo** discountType / public-private / audience / hạng thành viên. Chỉ có keyword + status + sort (`PromotionsPage.tsx:906-954`). Đề xuất: thêm chip filter multi-select.
- **Status pill `is-blocked`** (`displayStatusMeta:86-88`) dùng chung màu cho `inactive` và `expired` → trùng màu, khó phân biệt. Đề xuất: màu khác cho `expired` (xám) vs `inactive` (cam/vàng).
- **Cột "Điều kiện"** (`getAudienceText`/`getScopeText`, `PromotionsPage.tsx:1041-1043`) text dài, không truncate an toàn → cột cao không đều. Đề xuất: dùng `max-width` + tooltip/xem thêm.
- **Không có bulk action** (bật/tắt/xóa hàng loạt) — hữu ích khi dọn voucher cũ.

### P2
- Bảng không có `aria-sort` trên header (không khai báo thứ tự cho screen reader).
- Pagination dùng text "Trang X / Y • Public: N" (`PromotionsPage.tsx:1118`) — gộp thông tin không liên quan, nên tách.

---

## 4. Chi tiết voucher (detail dialog)

Nguồn: `PromotionsPage.tsx:1153-1248`, `promotion.css:720-790`.

### P1
- **Grid 4 cột** (`admin-coupon-detail-grid`, `promotion.css:737-742`) quá dày, nhiều ô text dài (audience, scope) bị ép. Đề xuất: 2 cột, hoặc để ô dài tự span full-width.
- **Không có nút "Chỉnh sửa" ngay trong detail dialog** — phải đóng rồi tìm lại voucher bấm Sửa. Đề xuất: thêm nút "Sửa" trong footer detail.
- **Usage history không có export CSV** — admin đối soát thường cần xuất. Đề xuất: nút "Xuất Excel/CSV" cho usage list.
- **Không filter usage** (theo ngày, theo khách). Đề xuất: thêm search trong usage table.

### P2
- "Đối tượng"/"Phạm vi" hiển thị dạng text dài, không tag — nên render thành chips cho dễ đọc.

---

## 5. Campaign & Analytics (CampaignAnalyticsPanel)

Nguồn: `CampaignAnalyticsPanel.tsx`, `promotion.css:792-938`.

### P0
- **`window.confirm` để xóa campaign** (`CampaignAnalyticsPanel.tsx:120`) — không nhất quán với pattern dialog confirm ở voucher. Đề xuất: dùng dialog confirm giống voucher delete.
- **Coupon list trong form không có search** (`CampaignAnalyticsPanel.tsx:158-160`) — load 100 coupon (`listCoupons limit:100`), checkbox 3 cột max-height 150px scroll. Khi nhiều voucher khó tìm. Đề xuất: thêm ô search + filter theo status.

### P1
- **Analytics chỉ 4 số tĩnh** (`CampaignAnalyticsPanel.tsx:141-146`) — không có chart/graaph, không có so sánh giai đoạn (this month vs last month). Đề xuất: thêm mini chart (bar/line) + % thay đổi.
- **Form campaign không validate end > start** inline (`CampaignAnalyticsPanel.tsx:84-106`) — chỉ server validate. Đề xuất: client check.
- **Không edit campaign** — chỉ create/toggle/delete. Muốn sửa phải xóa tạo lại (mất couponIds đã setup).
- **`topCoupons`** trong `PromotionAnalytics` (`promotion.types.ts:83`) không được hiển thị ở UI. Đề xuất: render bảng "Top voucher dùng nhiều nhất".

### P2
- Metric "Đơn hàng 30 ngày" hardcode nhãn, range thật ở `analytics.range` (`promotion.types.ts:70`) — nên hiển thị range động.

---

## 6. Chương trình thành viên — Tier table & form

Nguồn: `LoyaltyPage.tsx:522-715` (table), `LoyaltyPage.tsx:907-1041` (form).

### P0
- **Form tier 1 khối dài, không group section** (`LoyaltyPage.tsx:913-1030`) — 11 field grid 2 cột + textarea, không có nhóm "Thông tin / Quyền lợi / Giao diện thẻ". Đề xuất: chia section như voucher form.
- **Icon picker là `<select>` text-only** (`LoyaltyPage.tsx:1004-1016`: Star/Crown/Diamond...) — không preview ký tự `★♛◆`. Người dùng phải đoán. Đề xuất: grid button icon + preview symbol (`membershipIconSymbols` đã có sẵn `LoyaltyPage.tsx:107-114`).
- **Color picker 3 ô native nhỏ** (`LoyaltyPage.tsx:981-1003`) — không preview lớn, không palette gợi ý. Đề xuất: thêm preview thẻ hạng real-time lớn + preset palette.
- **Contrast ratio check chỉ khi submit** (`toTierPayload:200`) — lỗi "Màu chữ và màu nền thẻ chưa đủ tương phản" báo sau Lưu. Đề xuất: realtime warning ngay cạnh color picker + hiển thị ratio.

### P1
- **maxPoint "tự tính" hiển thị text "Theo mốc hạng kế tiếp"** trong input disabled (`LoyaltyPage.tsx:947-952`) — khó hiểu. Đề xuất: label rõ "Tự động = minPoint của hạng kế tiếp" hoặc hiện số gợi ý.
- **Click "Thành viên" (số) → scroll xuống point management** (`handleViewTierMembers:435-455`) nhưng sau scroll **không highlight rõ đang filter tier** ngoài banner nhỏ (`admin-loyalty-tier-filter`, `LoyaltyPage.tsx:747-754`). Đề xuất: highlight row tier tương ứng + accent banner to hơn.
- **Bảng 8 cột** (`LoyaltyPage.tsx:592-604`) dày, cột "Hiển thị" là preview thẻ `min-width:120px` (`loyalty.css:73`) — overflow ngang mobile. Đề xuất: card-view responsive + gom action vào dropdown.
- **Không preview thẻ hạng lớn** khi tạo/sửa — admin không biết khách sẽ thấy thẻ thế nào. Đề xuất: preview card visual (màu card + icon + tên + level + quyền lợi) đúng như app khách.

### P2
- "Quyền lợi" textarea (`LoyaltyPage.tsx:1018-1029`) `required minLength 2 maxLength 200` — nhưng không có character counter.

---

## 7. Quản lý điểm khách hàng

Nguồn: `LoyaltyPage.tsx:737-888`, `loyalty.css:166-366`.

### P0
- **Tìm khách hàng phải bấm nút** (`handleSearchLoyaltyUsers:419` form submit) — không debounce auto-search như voucher (`PromotionsPage.tsx:533-540` debounce 320ms). Đề xuất: debounce auto-search khi gõ.
- **User list chỉ load 10, không pagination/load-more** (`listLoyaltyUsers(..., 1, 10, ...)`, `LoyaltyPage.tsx:425,446,462`) — không biết còn bao nhiêu. Đề xuất: nút "Tải thêm" hoặc paging từ `result.pagination` (đang bỏ qua).
- **Validation delta/reason trong handler** (`handleAdjustPoints:478-520`) — báo lỗi qua `notice`, không inline. Đề xuất: inline error dưới 2 ô.

### P1
- **Không filter lịch sử điểm** (`LoyaltyPointHistory` list, `LoyaltyPage.tsx:845-861`) theo loại (earn/redeem/adjust) hay khoảng ngày. Đề xuất: filter chips + date range.
- **Không có tổng kết** (tổng cộng/trừ trong khoảng) — admin muốn đối soát nhanh. Đề xuất: summary card "+X điểm / -Y điểm" phía trên history.
- **Pagination "Trang trước/Trang sau" text** (`LoyaltyPage.tsx:862-882`) — không có số trang để click trực tiếp như voucher (`visiblePages`). Đề xuất: đồng bộ pattern pagination.
- **Không hiển thị hạng hiện tại của khách** trong user result card (`LoyaltyPage.tsx:774-787`) — chỉ có name/email/phone/points. Đề xuất: thêm chip "Hạng: Vàng".
- **Adjust form 3 cột** (`admin-loyalty-adjust-form`, `loyalty.css:311-315`) trên mobile collapse 1 cột — nhưng nút submit trôi xuống cuối. Đề xuất: sticky action bar.

### P2
- History article 2 cột (`88px` + flex, `loyalty.css:331-337`) — số delta `+500` đôi khi bị cắt. Tăng width hoặc dùng `tabular-nums`.

---

## 8. Loyalty rules (LoyaltyRulesPanel)

Nguồn: `LoyaltyRulesPanel.tsx`, `loyalty.css:368-435`.

### P0
- **Không có edit rule** — chỉ create/toggle/delete (`LoyaltyRulesPanel.tsx:44,60,71`). Muốn đổi `spendAmount` phải xóa tạo lại. Đề xuất: thêm edit (inline hoặc dialog).
- **`window.confirm` xóa rule** (`LoyaltyRulesPanel.tsx:72`) — không nhất quán với dialog pattern. Đề xuất: dialog confirm.

### P1
- **Form 5 cột + button** (`admin-loyalty-rule-form`, `loyalty.css:375-383`) — trên mobile collapse 1 cột nhưng nút "Lưu quy tắc" trôi xuống cuối, label không align. Đề xuất: sticky footer form.
- **Không preview công thức** ("1.000₫ = 1 điểm"). Đề xuất: hiển thị preview "Mỗi {spendAmount}₫ → {pointsEarned} điểm" ngay trong form.
- **Không phân biệt rule nào đang active mặc định** rõ — chỉ `is-active`/`is-blocked` pill. Đề xuất: badge "Mặc định" cho rule hệ thống.

### P2
- `roundMode` select (`LoyaltyRulesPanel.tsx:98`) nhãn "Xuống/Gần nhất/Lên" — nên thêm ví dụ (floor: 1234→1234, round: →1234,...).

---

## 9. Cross-cutting (chung cả 2 module)

### P0
- **Notice/Toast chỉ 1 message** (`notice` state, tự ẩn 5s `PromotionsPage.tsx:550-557`, `LoyaltyPage.tsx:260-267`) — không stack được nhiều lỗi, lỗi trong dialog bị che. Đề xuất: toast queue + render toast trong dialog layer.
- **Loading state chỉ text "Đang tải..."** (`PromotionsPage.tsx:991-997`, `LoyaltyPage.tsx:606-612`) — không skeleton, bảng nhảy. Đề xuất: skeleton row / shimmer.

### P1
- **Confirm delete dùng 2 pattern khác nhau**: voucher/loyalty tier = dialog đẹp (`PromotionsPage.tsx:1604`, `LoyaltyPage.tsx:1069`), campaign/rule = `window.confirm` (`CampaignAnalyticsPanel.tsx:120`, `LoyaltyRulesPanel.tsx:72`). **Bất nhất quán.** Đề xuất:统一 dialog confirm.
- **Responsive chỉ 2 breakpoint** 980px/560px (`promotion.css:909`, `loyalty.css:461`). Table voucher/loyalty vẫn overflow ngang ở 700-980px. Đề xuất: thêm breakpoint trung gian + card-view.
- **Không keyboard shortcut**: Enter để submit form OK, nhưng không có Esc-to-close rõ (có `useDialogAccessibility` nhưng không document), không tab-trap test.
- **Form draft không persist**: đóng dialog mất dữ liệu (cả voucher & tier & rule). Đề xuất: confirm "Bạn đang chỉnh sửa dở, thoát?" khi form dirty.
- **Currency/date format** tốt (vi-VN) nhưng `datetime-local` input không localize picker — dùng picker tùy biến.

### P2
- Empty states (`PromotionsPage.tsx:999`, `LoyaltyPage.tsx:614`) chỉ text + button — thêm illustration/icon cho thân thiện.
- "Integration checks" list (`LoyaltyPage.tsx:892-905`, `integrationChecks:134-140`) là text checklist tĩnh — nên có icon check ✓/⚠ visual.

---

## 10. Vấn đề bị che khuất khi xem (visibility / overlay)

Đây là nhóm lỗi đặc thù mà người dùng hay phàn nàn: thông tin tồn tại trong DOM nhưng **không nhìn thấy được** do stacking, scroll, hoặc layout. Tách riêng để sửa gọn.

### 10.1. Notice/Toast lỗi bị dialog che (P0)
- **Hiện trạng**: `notice` state render ở **ngoài dialog**, nằm trong `.admin-promotions-page` (`PromotionsPage.tsx:956`) và `.admin-loyalty-page` (`LoyaltyPage.tsx:547`). Khi dialog voucher/tier mở (`.admin-confirm-layer` `position:fixed; z-index:30` — `admin.css:540-544`), notice ở z-index thấp hơn + nằm phía sau overlay `rgba(20,29,39,0.38)` → **hoàn toàn bị che**.
- **Hậu quả**: Submit form voucher lỗi (mã trùng, ngày sai, contrast không đủ...) → throw Error → `setNotice` (`handleSubmitCoupon:749`, `handleSubmitTier:339`) → message hiện ở vùng bị dialog phủ → người dùng **không thấy lỗi**, tưởng app treo.
- **Đề xuất**:
  1. Render notice **bên trong dialog** (ví dụ trong `.admin-coupon-dialog-header` hoặc sticky trên `.admin-coupon-dialog-body`).
  2. Hoặc nâng toast lên `z-index: 40` (>30) + position fixed top-right, độc lập với dialog layer.
  3. Thêm toast queue để hiển thị nhiều lỗi cùng lúc (hiện `notice` là single state).

### 10.2. Reference warning bị che (P0)
- `referenceWarning` (`PromotionsPage.tsx:962-966`) — cảnh báo "Không tải được danh sách hạng thành viên/sản phẩm" — cũng render ngoài dialog. Khi đang mở form tạo voucher, OptionPicker không có dữ liệu nhưng **không có cảnh báo nào hiển thị trong dialog**. Người dùng tưởng OptionPicker trống là do chưa có dữ liệu thật, không biết là lỗi tải.
- **Đề xuất**: hiển thị inline warning trong từng OptionPicker khi nguồn dữ liệu đó load fail (đã có `referenceWarning` state nhưng gộp chung, nên tách theo field: tier/categories/products).

### 10.3. Preview voucher/tier bị che khi cuộn (P1)
- **Voucher side panel preview** (`.admin-coupon-side-panel`, `PromotionsPage.tsx:1560`) nằm cột phải `grid-template-columns: minmax(0,1fr) 326px` (`promotion.css:93`). Khi form column bên trái cuộn dài (5 section), side panel cũng `overflow-y:auto` riêng → **preview tách rời khỏi context**, người dùng điền bên trái nhưng không thấy preview cập nhật vì phải cuộn panel phải. Đề xuất: sticky preview (`position: sticky; top: 0`) hoặc sync scroll highlight.
- **Tier preview thẻ** (`admin-loyalty-visual-preview`, `LoyaltyPage.tsx:659-674`) chỉ là ô nhỏ 120×34px trong cell table — **không có preview lớn khi tạo/sửa**. Admin đổi cardColor/textColor/icon trong form nhưng không thấy thẻ thật → phải Lưu rồi quay ra bảng xem. Đề xuất: thêm preview thẻ hạng lớn (full card với tên + level + icon + quyền lợi) ngay trong dialog form.

### 10.4. Dialog body overflow — phần dưới bị cắt (P0)
- **Voucher dialog** `max-height: min(92svh, 820px)` + `overflow:hidden` ở dialog, chỉ `.admin-coupon-form-column` và `.admin-coupon-side-panel` scroll (`promotion.css:89-106`). Footer action `.admin-coupon-actions` fixed trong dialog. Nhưng nếu màn hình thấp (<700px) hoặc nội dung dài, footer có thể bị **clip** do dialog `overflow:hidden` (`promotion.css:42`).
- **Tier dialog** `.admin-account-dialog` `max-height: min(86svh,760px); overflow-y:auto` (`admin.css:586-587`) — **scroll cả dialog**, footer action cũng cuộn → khi form dài, nút "Lưu hạng/Hủy" **trôi khỏi màn hình**, phải cuộn xuống tận cùng mới thấy. Đề xuất: sticky footer (`position: sticky; bottom: 0`) cho action bar cả 2 dialog.
- **Detail voucher dialog** `max-height: min(90svh,760px)`, `.admin-coupon-detail-body` scroll (`promotion.css:731-735`) — usage history pagination footer `.admin-coupon-detail-actions` không sticky → phải cuộn tới đáy mới thấy nút "Trước/Sau/Đóng".

### 10.5. Table nội dung bị che bởi overflow-x (P0)
- **Voucher table** `min-width:1060px` (`promotion.css:17`) trong `.admin-table-shell` — trên màn <1060px **overflow-x:auto** nhưng không có scroll indicator. Cột cuối "Thao tác" (6 nút) hay bị **che khỏi viewport**, người dùng không biết kéo ngang. Đề xuất: thêm shadow/grab indicator 2 đầu, hoặc action cột đầu (sticky col), hoặc card-view mobile.
- **Tier table** 8 cột, cột "Hiển thị" preview `min-width:120px` (`loyalty.css:73`) + cột "Thao tác" → tương tự bị che trên mobile.

### 10.6. Sidebar admin che nội dung (P1)
- Cần kiểm tra `.admin-loyalty-page` / `.admin-promotions-page` width `min(100%,1180px) margin:0 auto` — nếu admin sidebar fixed chiếm 240px, page 1180px có thể **bị sidebar phủ** phần trái khi viewport 1180-1280px. Đề xuất: page dùng `padding-left` theo sidebar width, hoặc `max-width` tính theo vùng content thực.

### 10.7. Chips/selected trong OptionPicker bị che (P1)
- **Chips selected** render **dưới** danh sách option (`OptionPicker.tsx:158-166`), danh sách `max-height:196px; overflow-y:auto` (`promotion.css:475`). Khi chọn nhiều, chips xuất hiện dưới cùng — nhưng nếu panel dialog cao vừa đủ, chips **bị cắt bởi dialog overflow:hidden** → không thấy được đã chọn gì. Đề xuất: chuyển chips lên **trên** danh sách (giống tag-input), luôn visible.

### 10.8. Lịch sử điểm / usage history bị che khi scroll (P1)
- **Point history** (`LoyaltyPage.tsx:845-861`) nằm trong `.admin-loyalty-point-detail` không có max-height riêng → dài theo số giao dịch, đẩy pagination "Trang trước/sau" xuống tận đáy. Khi nhiều lịch sử, pagination **bị che** khỏi viewport. Đề xuất: history list `max-height` + scroll riêng, pagination sticky.
- **Coupon usage history** (`PromotionsPage.tsx:1191-1219`) tương tự trong detail dialog, table `min-width:760px` overflow-x (`promotion.css:772-778`) — trên dialog hẹp cột "Khách hàng/Đơn hàng" bị che ngang.

### 10.9. Loading state che dữ liệu cũ (P2)
- `isLoading`/`actionLoading` thường **xóa list** rồi hiện "Đang tải..." (`PromotionsPage.tsx:463 setCoupons(result.items)` sau khi isLoading=true). Khi refresh/loadCoupons, bảng **nhảy thành trống** trong lúc chờ → mất context. Đề xuất: giữ dữ liệu cũ + overlay shimmer, chỉ thay khi có data mới.

### Tóm tắt mục 10
| # | Mức | Vấn đề bị che | File |
|---|-----|--------------|------|
| 10.1 | P0 | Notice lỗi bị dialog overlay che (z-index 30 > notice) | `admin.css:540`, `PromotionsPage.tsx:956` |
| 10.2 | P0 | Reference warning không hiện trong OptionPicker | `PromotionsPage.tsx:962` |
| 10.3 | P1 | Preview voucher/tier bị che khi cuộn | `promotion.css:93`, `LoyaltyPage.tsx:659` |
| 10.4 | P0 | Dialog footer action trôi/clipped, không sticky | `admin.css:586`, `promotion.css:42` |
| 10.5 | P0 | Table overflow-x che cột Thao tác, không indicator | `promotion.css:17` |
| 10.6 | P1 | Page 1180px bị sidebar phủ ở viewport trung bình | `loyalty.css:2` |
| 10.7 | P1 | Chips selected OptionPicker bị cắt dưới | `OptionPicker.tsx:158` |
| 10.8 | P1 | History/usage pagination bị che khi list dài | `LoyaltyPage.tsx:862` |
| 10.9 | P2 | Loading xóa list → nhảy trống mất context | `PromotionsPage.tsx:463` |

---

## 11. Thiếu lời khuyên/gợi ý khi nhập — giảm độ phức tạp (smart guidance)

Vấn đề cốt lõi: form voucher ~15 field, form tier ~11 field, rule ~5 field — toàn bộ đều **chỉ là ô nhập trống + hint 1 dòng**, không có hướng dẫn theo ngữ cảnh. Người dùng (đặc biệt staff không rành marketing) không biết chọn giá trị nào hợp lý, phải đoán → dễ tạo voucher sai/tối ưu kém. Cần thêm **smart guidance** ở từng ô.

### 11.1. Voucher — thiếu gợi ý từng trường (P0)

**a. Loại giảm (discountType)**
- Hiện: 3 button text `Giảm theo phần trăm / Giảm số tiền / Miễn phí vận chuyển` + mô tả chung (`PromotionsPage.tsx:103-107`).
- Thiếu: **khi nào dùng loại nào**. Đề xuất thêm tooltip/guide:
  - `percent`: "Dùng khi muốn giảm theo tỷ lệ đơn (VD khuyến mãi toàn shop). Khuyến nghị set mức giảm tối đa."
  - `fixed`: "Dùng cho voucher số tiền cụ thể (VD giảm 50k). Tốt cho khách mới."
  - `free_shipping`: "Dùng khi muốn freeship, không cần giá trị giảm. Nên set đơn tối thiểu để tránh lạm dụng."

**b. Giá trị giảm (discountValue)**
- Hiện: input number + preset 4 giá trị cứng `percentPresets/fixedPresets` (`PromotionsPage.tsx:115-116`).
- Thiếu: **gợi ý theo ngữ cảnh**. Đề xuất:
  - Nếu `eligibleUserTypes` = `new_user` → gợi ý `10-15%` (vừa đủ hút khách mới, không lỗ).
  - Nếu `eligibleMembershipRanks` có hạng cao → gợi ý `%` cao hơn hạng thấp.
  - Hiển thị **ước tính chi phí**: "Với đơn TB 500k, voucher 10% ≈ giảm 50k/đơn" → admin biết ngân sách.
  - Cảnh báo khi `percent > 30`: "Giảm >30% có thể ảnh hưởng biên — xác nhận?"

**c. Giảm tối đa (maxDiscountAmount)**
- Hiên: placeholder "Không giới hạn" (`PromotionsPage.tsx:1375`).
- Thiếu: giải thích **tại sao cần**. Đề xuất: hint "Bắt buộc nên set cho voucher % để tránh lỗ khi đơn lớn (VD đơn 5tr × 20% = giảm 1tr)."

**d. Đơn tối thiểu (minOrderAmount)**
- Hiện: input, default 0 (`createEmptyCouponForm:163`).
- Thiếu: gợi ý mốc phổ biến. Đề xuất preset chips: 0 / 200k / 500k / 1tr + giải thích "Đơn tối thiểu giúp tránh lạm dụng voucher cho đơn quá nhỏ."

**e. Giới hạn lượt (usageLimit / perUserLimit)**
- Hiện: input, placeholder "Không giới hạn" (`PromotionsPage.tsx:1457`).
- Thiếu: cảnh báo nếu **cả 2 đều không giới hạn**. Đề xuất: khi usageLimit trống + perUserLimit cao → warning "Không giới hạn tổng lượt + nhiều lượt/khách có thể bùng nổ chi phí. Khuyến nghị set usageLimit."
- Thêm gợi ý: perUserLimit = 1 cho voucher công khai (tránh 1 khách dùng nhiều lần).

**f. Đối tượng (eligibleUserTypes)**
- Hiện: 3 checkbox (`PromotionsPage.tsx:1507-1517`).
- Thiếu: gợi ý combo. Đề xuất: khi check `member` → hiện hint "Chỉ thành viên có hạng mới dùng, nên kết hợp `eligibleMembershipRanks` để giới hạn hạng cụ thể."
- Logic `all` chiếm ưu tiên (`toggleEligibleUserType:697-716`) — khi check `all`, các choice khác bị clear **im lặng** → dễ nhầm. Đề xuất: disable các option khác khi chọn `all`, hoặc warning "Đã chọn 'Tất cả khách' — các lựa chọn khác sẽ bị bỏ."

**g. Hạng thành viên (eligibleMembershipRanks)**
- Hiện: OptionPicker (`PromotionsPage.tsx:1518-1525`).
- Thiếu: **preview nhóm khách được hưởng**. Đề xuất: hiển thị "Chọn hạng Vàng+Bạc ≈ 320 khách (60% tổng thành viên)" — admin thấy quy mô hưởng lợi tức thì.

**h. Phạm vi sản phẩm (applicableProducts/Categories)**
- Hiện: 2 OptionPicker cạnh nhau (`PromotionsPage.tsx:1537-1556`).
- Thiếu: gợi ý "Để trống = toàn đơn (dễ nhất, khuyến nghị cho voucher chung). Giới hạn danh mục/sản phẩm khi muốn clearance hàng cụ thể."
- Cảnh báo khi chọn cả danh mục + sản phẩm chồng nhau: "Sản phẩm X đã thuộc danh mục Y đang chọn — trùng lặp."

**i. Thời gian (startAt/endAt)**
- Hiện: 2 datetime-local + 4 preset (`PromotionsPage.tsx:1422-1448`).
- Thiếu: gợi ý pattern. Đề xuất:
  - "Bắt đầu ngay" / "Lên lịch" toggle.
  - Cảnh báo nếu `endAt - startAt > 90 ngày`: "Voucher kéo dài >90 ngày khó kiểm soát chi phí, nên chia nhiều đợt."
  - Auto-suggest giờ: start 00:00, end 23:59 cho "cả ngày".

### 11.2. Tier (hạng thành viên) — thiếu hướng dẫn cấu hình (P0)

**a. Level (cấp hạng)**
- Hiện: input 1-20 (`LoyaltyPage.tsx:925-933`).
- Thiếu: giải thích level = thứ tự thăng tiến. Đề xuất: hint "Level càng cao = hạng càng cao. VD Level 1 = Đồng, 3 = Bạc, 5 = Vàng, 10 = Kim Cương."
- Cảnh báo nếu gap level quá xa (VD level 1 rồi level 5): "Gap điểm lớn giữa 2 hạng khiến khách khó thăng tiến — cân nhắc hạng trung gian."

**b. minPoint (điểm tối thiểu)**
- Hiện: input 0-100tr (`LoyaltyPage.tsx:935-943`).
- Thiếu: gợi ý mốc thực tế. Đề xuất preset: 0 / 1.000 / 5.000 / 20.000 / 100.000 + hint "1 điểm ≈ 1.000₫ chi tiêu (theo rule). VD minPoint 5.000 = cần tiêu 5tr để đạt hạng này."
- **Tự tính maxPoint** nhưng chỉ hiện text disabled "Theo mốc hạng kế tiếp" (`LoyaltyPage.tsx:947-952`) — không hiện số cụ thể. Đề xuất: hiện "maxPoint = 4.999 (minPoint của hạng kế tiếp − 1)" rõ ràng.

**c. discountPercent**
- Hiện: input 0-100 step 0.1 (`LoyaltyPage.tsx:954-966`).
- Thiếu: gợi ý dải hợp lý. Đề xuất: hint "Hạng cao giảm nhiều hơn. VD Đồng 0%, Bạc 3%, Vàng 5%, Kim Cương 10%. Quá cao sẽ ăn biên."
- Cảnh báo `>15%`: "Mức giảm >15% cho hạng thành viên có thể ảnh hưởng lợi nhuận — xác nhận?"

**d. cardColor / textColor / badgeColor**
- Hiện: 3 color input native (`LoyaltyPage.tsx:981-1003`).
- Thiếu: **palette gợi ý** + preview thẻ lớn. Đề xuất:
  - Preset bộ màu theo hạng: Đồng (#b87333), Bạc (#c0c0c0), Vàng (#d4af37), Kim Cương (#b9f2ff).
  - Auto-pick textColor theo độ sáng cardColor (đã có `getContrastRatio` — dùng để suggest textColor tối ưu thay vì bắt nhập).
  - Preview thẻ hạng lớn (icon + tên + level + quyền lợi) realtime bên cạnh.
  - Warning contrast realtime thay vì báo khi submit (`toTierPayload:200`).

**e. iconName**
- Hiện: `<select>` text "Star/Crown/Diamond..." (`LoyaltyPage.tsx:1004-1016`).
- Thiếu: **preview ký tự**. Đề xuất: grid button hiển thị `★♛◆✦☆` (`membershipIconSymbols` đã có `LoyaltyPage.tsx:107-114` — chỉ cần render thay vì select text). Gợi ý icon theo hạng: Đồng=medal, Bạc=shield-star, Vàng=crown, Kim Cương=diamond.

**f. benefitDescription**
- Hiện: textarea 2-200 ký tự (`LoyaltyPage.tsx:1018-1029`).
- Thiếu: character counter + gợi ý mẫu. Đề xuất: counter "120/200" + placeholder mẫu "Đổi điểm lấy voucher, freeship đơn >500k, ưu tiên CSKH."

### 11.3. Loyalty rule — thiếu preview công thức (P0)

**a. spendAmount / pointsEarned**
- Hiện: 2 input number (`LoyaltyRulesPanel.tsx:95-96`).
- Thiếu: **preview công thức**. Đề xuất: dòng realtime "Mỗi {spendAmount}₫ → {pointsEarned} điểm · VD đơn 500k → 500 điểm" ngay trong form.
- Cảnh báo nếu ratio quá generous (VD 100₫ = 1 điểm): "Tỉ lệ này cho điểm rất nhanh — cân đối với giá trị đổi điểm."

**b. minOrderAmount / roundMode**
- Hiện: input + select (`LoyaltyRulesPanel.tsx:97-98`).
- Thiếu: ví dụ roundMode. Đề xuất: select hiển thị "Xuống (1234→1 điểm) / Gần nhất (→1) / Lên (→2)" với ví dụ cụ thể.

### 11.4. Campaign — thiếu guidance chọn voucher (P1)

**a. couponIds (chọn voucher cho chiến dịch)**
- Hiện: checkbox list 3 cột, max-height 150px, không search (`CampaignAnalyticsPanel.tsx:158-160`).
- Thiếu: gợi ý combo voucher. Đề xuất:
  - Filter theo discountType/status.
  - Warning khi chọn voucher trùng đối tượng/ thời gian: "Voucher A và B cùng target new_user, cùng thời gian — stacking có thể giảm quá sâu."
  - Hiển thị `maxCouponsPerOrder` giải thích: "Tối đa 2 voucher/đơn nghĩa là khách chỉ được áp 2 trong số các voucher đã chọn."

### 11.5. Mẫu/template — giảm thao tác lặp (P1)

- Không có **preset template** cho voucher phổ biến. Đề xuất: nút "Chọn mẫu" với template:
  - "Chào mừng khách mới" → percent 10, new_user, 30 ngày, perUserLimit 1.
  - "Freeship đơn >300k" → free_shipping, minOrder 300k, all.
  - "Tri ân thành viên Vàng" → percent 15, rank Vàng, 14 ngày.
- Template tier preset: "Bộ 4 hạng tiêu chuẩn (Đồng/Bạc/Vàng/KC)" auto-fill nhanh.

### 11.6. Wizard / progressive disclosure (P1)

- Thay vì show hết 15 field voucher ngay, dùng **progressive disclosure**:
  - Bắt đầu chỉ hiện: Tên + loại giảm + giá trị.
  - "Tùy chọn nâng cao" → mở thêm: đơn tối thiểu, giới hạn lượt, đối tượng, phạm vi.
  - Giảm cognitive load cho voucher đơn giản (phần lớn voucher chỉ cần 3-4 field).

### Tóm tắt mục 11
| # | Mức | Vấn đề thiếu guidance | File |
|---|-----|----------------------|------|
| 11.1 | P0 | Voucher: không gợi ý từng field (loại/giá trị/đối tượng/phạm vi/thời gian) | `PromotionsPage.tsx:1328-1557` |
| 11.2 | P0 | Tier: không gợi ý level/minPoint/discountPercent + color/icon không preview | `LoyaltyPage.tsx:913-1030` |
| 11.3 | P0 | Rule: không preview công thức tích điểm | `LoyaltyRulesPanel.tsx:93-100` |
| 11.4 | P1 | Campaign: chọn voucher không filter, không warning trùng | `CampaignAnalyticsPanel.tsx:158` |
| 11.5 | P1 | Không có voucher/tier template preset | — |
| 11.6 | P1 | Không progressive disclosure, show hết field | `PromotionsPage.tsx:1250` |

---

## 12. Tóm tắt ưu tiên sửa

| # | Mức | Vấn đề | File |
|---|-----|-------|------|
| 1 | P0 | Dialog tạo voucher quá dài, không stepper | `PromotionsPage.tsx:1250` |
| 2 | P0 | Validation chỉ khi submit, không inline | `PromotionsPage.tsx:300,749` |
| 3 | P0 | 6 action button tràn ngang, table overflow mobile | `PromotionsPage.tsx:1060` |
| 4 | P0 | OptionPicker search thay thế list, không load-more | `OptionPicker.tsx:502` |
| 5 | P0 | Tier form 1 khối, icon/color không preview | `LoyaltyPage.tsx:913,1004,981` |
| 6 | P0 | Tìm khách hàng phải bấm nút, user list không paging | `LoyaltyPage.tsx:419,425` |
| 7 | P0 | `window.confirm` không nhất quán (campaign/rule) | `CampaignAnalyticsPanel.tsx:120`, `LoyaltyRulesPanel.tsx:72` |
| 8 | P0 | **Notice lỗi bị dialog che (z-index overlay)** | `admin.css:540`, `PromotionsPage.tsx:956` |
| 9 | P0 | **Reference warning không hiện trong OptionPicker khi dialog mở** | `PromotionsPage.tsx:962` |
| 10 | P0 | **Dialog footer action trôi/clipped, không sticky** | `admin.css:586`, `promotion.css:42` |
| 11 | P0 | **Table overflow-x che cột Thao tác, không indicator** | `promotion.css:17` |
| 12 | P1 | Status pill inactive/expired trùng màu | `PromotionsPage.tsx:84` |
| 13 | P1 | Analytics chỉ số tĩnh, không chart, không edit campaign | `CampaignAnalyticsPanel.tsx:141` |
| 14 | P1 | Loyalty rule không edit, không preview công thức | `LoyaltyRulesPanel.tsx` |
| 15 | P1 | Point history không filter, không summary | `LoyaltyPage.tsx:845` |
| 16 | P1 | No bulk action voucher, no responsive card-view | `PromotionsPage.tsx` |
| 17 | P1 | **Preview voucher/tier bị che khi cuộn, tier không có preview lớn** | `promotion.css:93`, `LoyaltyPage.tsx:659` |
| 18 | P1 | **Page 1180px bị sidebar phủ ở viewport trung bình** | `loyalty.css:2` |
| 19 | P1 | **Chips selected OptionPicker bị cắt dưới dialog** | `OptionPicker.tsx:158` |
| 20 | P1 | **History/usage pagination bị che khi list dài** | `LoyaltyPage.tsx:862` |
| 21 | P2 | Skeleton loading, draft persist, empty illustration | toàn module |
| 22 | P2 | **Loading xóa list → nhảy trống mất context** | `PromotionsPage.tsx:463` |
| 23 | P0 | **Voucher: thiếu gợi ý từng field (loại/giá trị/đối tượng/phạm vi)** | `PromotionsPage.tsx:1328` |
| 24 | P0 | **Tier: thiếu gợi ý level/minPoint/discountPercent, color/icon không preview** | `LoyaltyPage.tsx:913` |
| 25 | P0 | **Rule: không preview công thức tích điểm "1.000₫ → 1 điểm"** | `LoyaltyRulesPanel.tsx:93` |
| 26 | P1 | Campaign chọn voucher không filter/warning trùng | `CampaignAnalyticsPanel.tsx:158` |
| 27 | P1 | **Không có voucher/tier template preset** | — |
| 28 | P1 | **Không progressive disclosure, show hết 15 field voucher** | `PromotionsPage.tsx:1250` |