# Notification Badge — Phân tích & Tính năng cần thiết

Tài liệu về "chấm đỏ kèm số" trên icon/menu — gọi là gì, vì sao cần, và nên áp dụng ở đâu trong hệ thống fashion ecommerce này.

> **Ghi chú phạm vi**: Tài liệu này phân tích tổng quan, nhưng khi **triển khai chỉ áp dụng cho web admin**
> (`web_frontend/src/features/admin/` + `AdminLayout.tsx`).
> Phần "Mobile app khách" ở mục 4 và mục 7 (dòng 7, 8) **chỉ tham khảo, không triển khai** — không đụng tới
> mobile app (`mobile/`) hay web shop (`web_frontend/src/features/catalog/`, `profile/`, `auth/`).

---

## 1. Gọi là gì?

"Chấm đỏ kèm số" đó có nhiều tên tùy ngữ cảnh:

| Thuật ngữ | Mô tả | Khi dùng |
|-----------|-------|---------|
| **Notification badge** | Chấm/icon số đếm trên icon báo có việc cần xử lý | Tên chung nhất, đúng nhất cho trường hợp này |
| **Badge count** | Số đếm hiển thị trong badge | Khi nhấn mạnh số lượng |
| **Unread badge** / **unread counter** | Đếm số mục chưa xem (chưa đọc/ chưa xử lý) | Khi badge = số "mới/chưa xem" |
| **Dot indicator** / **red dot** | Chấm tròn không số, chỉ báo "có mới" | Khi không cần đếm chính xác (VD app settings có cập nhật) |
| **Pill badge** | Badge hình pill text (VD "Mới", "Sắp ra mắt") | Badge trạng thái/label, không phải count |

→ Trong tài liệu này dùng thống nhất **notification badge** (badge count khi có số, dot indicator khi chỉ chấm).

Hiện tại trong codebase đã có **pill badge** (status/membership/sale) nhưng **chưa có notification badge count** cho việc cần xử lý. `AdminLayout.tsx:293-295` có `BellIcon` nhưng chỉ là icon chuông trống, không badge.

---

## 2. Tại sao cần notification badge?

Badge giải quyết 3 vấn đề UX cốt lõi:

1. **Nhận biết việc cần làm ngay (actionability)** — admin/staff không phải mở từng trang để kiểm tra có đơn mới/ ticket mới không. Badge trên sidebar = "2 đơn chờ duyệt" → click vào xử lý.
2. **Giảm tải nhận thức (cognitive load)** — thay vì nhớ "mình phải check orders, check reviews, check support", badge tổng hợp trạng thái trên 1 màn hình.
3. **Tạo cảm giác cập nhật (recency)** — khách thấy badge "2 voucher mới" → tin shop hoạt động, quay lại xem.

Thiếu badge = người dùng **phải chủ động load từng page** để biết có gì mới → dễ bỏ sót đơn/review quan trọng → chậm xử lý → mất doanh thu/khách.

---

## 3. Phân loại badge theo ngữ cảnh

### 3.1. Badge count (có số) — khi cần đếm chính xác
- Dùng khi: số lượng việc cần xử lý **có ý nghĩa** (2 đơn chờ ≠ 200 đơn chờ).
- Trên 99 → hiển thị "99+" (tránh badge quá to).
- Nguồn: từ API count, cập nhật theo polling/SSE/websocket.

### 3.2. Dot indicator (chấm không số) — khi chỉ cần biết "có mới"
- Dùng khi: chỉ cần tín hiệu "có thứ mới/cần xem", không cần số.
- VD: settings có bản mới, có thông báo hệ thống, mục menu có sub-item mới.
- Nhẹ hơn count (không cần query đếm).

### 3.3. Pill badge (text) — label trạng thái
- Đã có trong codebase (status pill, "Mới", "Sắp ra mắt" `AdminLayout.tsx:273`).
- Không phải notification, là trạng thái tĩnh.

---

## 4. Tính năng cần badge trong hệ thống này

Dựa vào cấu trúc admin nav (`AdminLayout.tsx:33-49`, `adminRoutes`) + order flow + loyalty/voucher, đây là các điểm nên có badge, ưu tiên theo tác động nghiệp vụ.

### P0 — Admin sidebar (đơn vị xử lý trực tiếp)

| Vị trí | Badge | Ý nghĩa | Nguồn count |
|--------|-------|---------|-------------|
| **Đơn hàng (orders / ordersOnline / ordersCod)** | count | Đơn ở trạng thái **cần admin action**: `pending` (chờ xác nhận), `packed` (chờ giao), `return_requested` (chờ duyệt trả hàng) | `Order.countDocuments({ status: { $in: ['pending','packed','return_requested'] } })` |
| **Hỗ trợ (support)** | count | Ticket chat **chưa trả lời** / mới từ khách | `SupportTicket.countDocuments({ status: 'open', lastMessageFrom: 'customer' })` |
| **Đánh giá (reviews)** | count | Review **chờ duyệt** (isApproved=false) | `Review.countDocuments({ isApproved: false })` |
| **Kho (inventory)** | dot | Sản phẩm **sắp hết / dưới reorder point** | `ProductVariant.countDocuments({ stock: { $lte: reorderPoint } })` |
| **Khách hàng (customers)** | count | Khách **có yêu cầu chờ** (VD đổi/trả, khiếu nại pending) | theo return request / complaint model |
| **Bell icon (topbar)** | total | Tổng tất cả badge trên = "notification inbox" | sum các count trên |

**Lý do P0**: những thứ này admin/staff **bắt buộc xử lý** trong ngày. Không badge = đơn chờ bị quên → khách chờ → hủy đơn → mất doanh thu. Đây là badge "nhiệm vụ" (task badge).

### P1 — Admin sidebar (theo dõi/giám sát)

| Vị trí | Badge | Ý nghĩa |
|--------|-------|---------|
| **Voucher (promotions)** | dot | Voucher **sắp hết hạn** (<3 ngày) đang chạy → kịp gia hạn |
| **Thành viên (loyalty)** | dot | Có **yêu cầu điều chỉnh điểm chờ duyệt** (nếu có workflow approval) |
| **Tài khoản (accounts)** | count | Manager **chờ kích hoạt** / mới tạo chưa active |
| **Báo cáo (reports)** | dot | Có **báo cáo định kỳ mới** sẵn sàng xem |

### P1 — Mobile app khách (tài khoản/giỏ hàng)

| Vị trí | Badge | Ý nghĩa | Hiện trạng |
|--------|-------|---------|-----------|
| **Giỏ hàng (tab Cart)** | count | Số item trong cart | `ProfileScreen.tsx:306` đã có `shippingOrderCount` badge — mở rộng ra tab bar cart |
| **Đơn hàng (tab Orders)** | dot | Đơn **có cập nhật trạng thái mới** (chuyển shipped/delivered) kể từ lần xem cuối | chưa có |
| **Tài khoản (tab Account)** | dot | Có **voucher mới nhận** / hạng vừa thăng / điểm vừa cộng | chưa có |
| **Thông báo (nếu có)** | count | Notification inbox: đơn giao, voucher, khuyến mãi | chưa có screen |

### P2 — Điểm bổ sung (nice-to-have)

| Vị trí | Badge | Ý nghĩa |
|--------|-------|---------|
| Admin topbar Bell | phân loại | Badge phân màu: đỏ=đơn/cần action, cam=support, xanh=thông báo hệ thống |
| Voucher list row | count | Cột "Còn lượt" hiện đã có (`PromotionsPage.tsx:1047`) → làm nổi bật voucher sắp hết lượt |
| Loyalty tier row | count | Số thành viên hạng đó (`memberCount` đã có `LoyaltyPage.tsx:655`) → highlight hạng sắp đủ điều kiện thăng |
| Tab bar mobile | total | Tổng badge tất cả tab (cart + orders + account) cho biểu tượng tổng quan |

---

## 5. Kỹ thuật triển khai (đề xuất)

### 5.1. Backend — API count tập trung
- Thay vì mỗi page tự query count, tạo **1 endpoint `/admin/notifications/summary`** trả về object:
  ```json
  {
    "ordersPending": 3,
    "ordersReturnRequested": 1,
    "supportOpen": 2,
    "reviewsPending": 5,
    "lowStockVariants": 8,
    "expiringCoupons": 1
  }
  ```
- Admin frontend poll endpoint này mỗi **30-60s** (hoặc SSE/websocket nếu realtime cần).
- Filter theo permission: staff chỉ thấy count vùng có quyền (`canAccessRoute`).

### 5.2. Frontend admin
- Thêm `useNotificationSummary()` hook lưu vào context, render badge trên `AdminLayout.tsx:260-278` (nav item):
  ```tsx
  <span className="admin-nav-badge-count">{count > 99 ? '99+' : count}</span>
  ```
- Badge chỉ hiện khi `count > 0`, ẩn khi 0 (tránh noise).
- Bell icon topbar (`AdminLayout.tsx:293`) hiển thị tổng + dropdown panel liệt kê chi tiết.

### 5.3. Mobile
- Tab bar badge: dùng `react-navigation` `tabBarBadge` cho tab Cart/Orders/Account.
- Notification state trong store (Redux/Zustand), sync qua API/SSE.
- Dot cho tab khi chưa mở (chỉ tín hiệu mới), count khi mở rồi (biết số cụ thể).

### 5.4. Đồng bộ "đã xem"
- Badge count giảm khi user **vào trang xử lý** (VD vào Orders page → `ordersPending` reset về 0 sau khi load).
- Cần đánh dấu "lastSeen" timestamp per user per section (lưu `User.lastSeenOrders`, `lastSeenSupport`...) để query "mới kể từ lastSeen" cho dot mode.
- Badge ≠ "đã xử lý xong" — VD đơn chờ = 5, admin vào xem vẫn 5 nếu chưa duyệt. Badge count đếm **việc tồn đọng**, không phải "mới chưa xem". Dot mới đếm "mới chưa xem".

---

## 6. Quy tắc UX cho badge

1. **Màu sắc ngữ nghĩa**:
   - Đỏ = cần action gấp (đơn chờ, ticket mở).
   - Cam/vàng = cần theo dõi (hết hạn sắp, tồn kho thấp).
   - Xanh = thông tin mới (voucher mới, báo cáo).
   - Xám = trạng thái, không ưu tiên.
2. **Vị trí**: góc trên bên phải icon (tab bar/mobile) hoặc bên phải label nav item (admin sidebar).
3. **Kích thước**: tối thiểu 16px, số 1-2 chữ số, "99+" nếu lớn hơn.
4. **Animation**: pulse nhẹ 1 lần khi badge mới xuất hiện để thu hút — không pulse liên tục (gây khó chịu).
5. **Accessibility**: badge cần `aria-label` (VD `aria-label="3 đơn hàng chờ xử lý"`), không chỉ màu (color-blind).
6. **Không lạm dụng**: badge chỉ cho việc **thực sự cần user**. Badge quá nhiều = noise = bỏ qua hết.
7. **Hết hạn badge**: voucher sắp hết hạn → badge biến mất khi hết hạn (không còn chạy).

---

## 7. Ưu tiên triển khai

| # | Mức | Tính năng | Ai hưởng lợi |
|---|-----|----------|------------|
| 1 | P0 | API `/admin/notifications/summary` + poll | nền tảng cho mọi badge |
| 2 | P0 | Badge đơn hàng cần action (pending/packed/return) trên sidebar admin | staff xử lý đơn |
| 3 | P0 | Badge support ticket mở trên sidebar | CSKH |
| 4 | P0 | Badge review chờ duyệt trên sidebar | quản trị nội dung |
| 5 | P1 | Bell icon topbar hiển thị tổng + dropdown chi tiết | admin tổng quan |
| 6 | P1 | Dot kho sắp hết trên sidebar | quản lý tồn kho |
| 7 | P1 | Mobile tab bar cart count | khách mua sắm |
| 8 | P1 | Mobile dot đơn hàng có cập nhật mới | khách theo dõi đơn |
| 9 | P2 | Dot voucher sắp hết hạn, dot loyalty, phân màu badge | tinh chỉnh |
| 10 | P2 | Mobile notification inbox screen (nếu làm hệ thống notification) | dài hạn |

---

## 8. Tóm tắt

- "Chấm đỏ kèm số" = **notification badge** (badge count / dot indicator).
- Hệ thống này **chưa có** notification badge count thật sự (chỉ có pill status badge).
- **Cần nhất**: badge đơn hàng/support/review cần xử lý trên admin sidebar (P0) — đây là "nhiệm vụ" mà staff không thể bỏ sót.
- Triển khai qua 1 API summary tập trung + poll, render lên `AdminLayout` nav item + Bell icon.
- Mobile: tab bar cart count + dot đơn hàng cập nhật.
- Nguyên tắc: badge = việc cần làm (count) hoặc có mới (dot), màu ngữ nghĩa, có aria-label, không lạm dụng.

---

## 9. Kết quả triển khai 2026-06-20

### Đã hoàn thành trong phạm vi web admin

- `[x]` API tập trung `GET /admin/notifications/summary`, lọc dữ liệu theo quyền của admin/staff.
- `[x]` Count đơn cần xử lý theo trạng thái thật của hệ thống: `confirmed`, `packed`, `return_requested`; có tách tổng, COD và online.
- `[x]` Dot tồn kho thấp (gom theo product/variant/color, ngưỡng còn tối đa 5 sản phẩm).
- `[x]` Dot voucher đang chạy và sẽ hết hạn trong 3 ngày.
- `[x]` Count tài khoản staff đang tắt, chỉ trả cho admin.
- `[x]` Poll mỗi 45 giây, tự refresh khi tab hoạt động trở lại và giữ dữ liệu cũ nếu refresh lỗi.
- `[x]` Badge sidebar có giới hạn `99+`, màu theo mức độ, animation một lần, `aria-label` và hỗ trợ reduced motion.
- `[x]` Bell topbar hiển thị tổng không trùng lặp; dropdown phân loại, làm mới thủ công, trạng thái rỗng/lỗi và điều hướng tới trang xử lý.
- `[x]` Responsive QA desktop + 390×844: không overflow, panel không bị cắt; click notification điều hướng đúng.
- `[x]` Unit test backend cho tổng hợp count/quyền và Playwright test cho badge/dropdown/navigation.

### Chưa áp dụng vì hệ thống chưa có nguồn dữ liệu

- `SupportTicket`, review moderation, loyalty approval và báo cáo định kỳ chưa có model/workflow tương ứng. API trả capability `false` và count `0`, không dựng số giả.
- Mobile và web shop giữ nguyên đúng ghi chú phạm vi đầu tài liệu.
