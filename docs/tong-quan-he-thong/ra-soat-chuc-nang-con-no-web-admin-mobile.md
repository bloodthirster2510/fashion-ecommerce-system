# Rà soát chức năng còn nợ — Web Admin & Mobile

Ngày rà soát: 29/07/2026
Phạm vi: `web_frontend` khu vực `/admin`, ứng dụng `mobile`, API/backend và các tích hợp trực tiếp phục vụ hai bề mặt này.

Ngoài phạm vi:

- MoMo đã được loại khỏi kế hoạch; phạm vi thanh toán hiện tại chỉ gồm COD và VNPay.
- Tìm kiếm sản phẩm bằng hình ảnh được tách thành hạng mục riêng để nghiên cứu và triển khai sau, không tính vào backlog hiện tại.

## 1. Kết luận nhanh

Hệ thống hiện không còn ở trạng thái “chỉ có giao diện”. Phần lớn module admin và hành trình mua hàng mobile đã gọi API thật. Các lệnh build, typecheck, lint và unit test đều qua.

Thiếu credential bên thứ ba không tự nó được xem là lỗi chặn chạy local. Mục tiêu là mỗi integration có chế độ `auto`: đủ nhóm biến môi trường thì dùng provider thật, thiếu thì chạy mock/fallback có kiểm soát.

Kết quả triển khai ngày 29/07/2026:

- **P0-04 đã hoàn tất:** helper E2E dùng chung đã theo route `/admin/dashboard`; Playwright xanh 11/11.
- **P0-01 đã hoàn tất phần code và test tự động:** có resolver `auto`, adapter `mock`/Twilio/eSMS, timeout/retry/lỗi chuẩn hóa và UI phân biệt `mock`/`real`. Còn thiếu smoke test bằng credential sandbox và thiết bị thật.
- **P0-02 đã hoàn tất phần code và test tự động:** email có `auto`/mock/SMTP, mock token và outbox, deep link mobile, rollback khi gửi lỗi và guard bắt buộc đổi mật khẩu. Còn thiếu smoke test SMTP thật.
- **P0-03 đã hoàn tất phần code, test tự động và GHN sandbox smoke:** có collection/import/review/backfill mapping, queue riêng trên admin, form sửa mapping theo đơn và guard không cho gọi tạo vận đơn khi địa chỉ chưa xác minh. Còn phải import bộ mapping production cho toàn bộ vùng bán hàng trước khi mở thật.
- **P1-01 đã hoàn tất phần code và test tự động:** social login dùng resolver `auto`, ẩn provider thiếu cấu hình và có redirect scheme cho development build. Còn thiếu credential cùng device smoke thật.
- **P1-02 đã hoàn tất phần code và test tự động:** push có resolver `auto`, opt-in/cài đặt chung, preference theo loại, token refresh/revoke và deep-link foreground/background/killed. Còn thiếu EAS device smoke thật.
- **P1-03 đã hoàn tất phần code và test tự động:** search history được dedupe theo event, đồng bộ guest/account và giữ tối đa 10 từ khóa giữa server với SecureStore. Còn thiếu smoke nhiều thiết bị/offline.
- **P1-04 đã hoàn tất phần code và test tự động:** admin khách hàng có dữ liệu thật cho đơn hàng, timeline và ghi chú nội bộ, kèm permission và audit.
- **P1-05 đã hoàn tất phần code và test tự động:** cấu hình runtime phối đồ ảo có permission ghi riêng, optimistic concurrency, audit, rollback và không đưa secret vào DB/frontend.
- **P1-06 đã hoàn tất phần code và test tự động:** image validation có resolver `auto`, production luôn fail-closed, không còn localhost ngầm định, health được đưa lên admin/mobile và các lỗi policy/provider/nhiều người đều bị chặn. Còn thiếu smoke provider thật cùng bộ ảnh thực tế.
- **P1-07 đã hoàn tất bộ API-backed E2E:** test khởi động HTTP server, MongoDB replica set và realtime gateway thật; phủ login/cart/checkout/order, VNPay, GHN, virtual try-on và support hai chiều. Provider ngoài được mock tại adapter boundary.
- **P2-01 đã hoàn tất phần code và test tự động:** orders admin chọn nhiều đơn theo trang, bulk status/GHN trả kết quả riêng từng đơn, mở nhãn vận chuyển và xuất CSV theo toàn bộ bộ lọc.

Các khoản nợ còn ưu tiên:

1. Seed mapping GHN trong repo vẫn chỉ có 12 phường/xã; cần import bộ mapping production đã đối chiếu qua công cụ mới trước khi mở toàn bộ 34 tỉnh, thành.
2. OTP SMS cần smoke test sandbox cho cả đăng ký và khôi phục trước khi chốt production-ready.
3. Email reset cần smoke test bằng SMTP thật và xác nhận deep link trên development build/thiết bị thật.
4. Social login và push notification đã hoàn tất guard/config trong code; còn phải cấu hình OAuth thật và chạy smoke test push trên Android/iOS development build.
5. Image validation phối đồ ảo đã hoàn thiện resolver, fail-closed và hard-block trong code; còn phải deploy/smoke provider thật, hiệu chỉnh threshold bằng bộ ảnh thực tế.
6. Các tích hợp quan trọng đã có API-backed E2E cô lập; vẫn cần smoke credential/provider thật và permission/concurrency trên staging.

## 2. Quy ước ưu tiên

| Mức | Ý nghĩa |
|---|---|
| **P0** | Chặn nghiệm thu hoặc có thể làm luồng chính báo thành công sai/thất bại với người dùng. |
| **P1** | Tính năng đã xuất hiện trong UI hoặc có nền backend nhưng chưa dùng trọn vẹn. |
| **P2** | Nợ vận hành, khả năng mở rộng, báo cáo hoặc trải nghiệm quản trị. |

### 2.1 Nguyên tắc tích hợp bên thứ ba

Chế độ mặc định là `auto`, xét theo **đủ cả nhóm biến môi trường** chứ không chỉ một key:

| Tích hợp | Khi đủ `.env` | Khi thiếu `.env` |
|---|---|---|
| SMS OTP | Gửi qua eSMS/Twilio và chỉ xác nhận sau khi provider nhận request. | Dùng mock OTP trong dev/test; mã lấy qua mock outbox/log bảo vệ hoặc mã cố định cấu hình cho QA. |
| SMTP email | Gửi email thật. | Ghi thư vào mock outbox để lấy link/token và hoàn tất luồng local. |
| Google/Facebook | Hiện nút và chạy OAuth thật khi cả mobile client ID lẫn backend credential hợp lệ. | Ẩn nút ở bản thường; E2E có thể dùng mock auth được bật riêng cho test. |
| Expo push | Gửi remote push khi mobile có EAS project ID và backend đủ cấu hình. | Vẫn tạo thông báo trong app; bỏ qua remote push và không xin quyền thiết bị. |
| GHN | Quote, tạo vận đơn và đồng bộ trạng thái thật. | Dùng phí cố định, vận hành giao hàng thủ công/mock và gắn trạng thái `fallback`. |
| VNPay | Tạo URL/callback theo sandbox hoặc production đã cấu hình. | Chỉ cho COD; mock thanh toán chỉ được bật rõ ràng trong dev/test, không tự báo thanh toán thành công ở production. |
| Phối đồ/kiểm tra ảnh | Gọi provider được cấu hình. | Tự chọn provider `mock` để toàn bộ hành trình UI vẫn chạy được. |

Quy tắc an toàn:

- `development`/`test`: thiếu credential thì tự dùng mock/fallback.
- `production`: không giả lập thành công cho đăng nhập, OTP, email hay thanh toán. Integration thiếu cấu hình phải bị vô hiệu hóa hoặc dùng fallback nghiệp vụ đã công bố như COD/phí giao hàng cố định.
- Capabilities/admin diagnostics cần hiển thị `real`, `mock`, `fallback` hoặc `disabled`; không để người vận hành phải đoán mode hiện tại.
- Không đưa secret ra frontend và không ghi OTP/token thật vào log production.

## 3. Phần đã nối và có thể giữ nguyên

### 3.1 Web Admin

| Nhóm | Trạng thái hiện tại |
|---|---|
| Đăng nhập & RBAC | Có session, refresh token, đổi mật khẩu bắt buộc cho admin/staff, permission theo module. |
| Dashboard | Lấy overview thật từ `/admin/dashboard/overview`; dữ liệu demo chỉ dùng khi bấm “Xem bố cục demo” trong môi trường dev. |
| Nhân sự | Danh sách, tạo staff, khóa/mở, sửa quyền, reset mật khẩu tạm thời. |
| Sản phẩm, danh mục, thương hiệu | CRUD, soft/permanent delete, biến thể, size, số đo, ảnh và trạng thái bán. |
| Kho hàng | Tồn kho, lô nhập, phiếu nhập nháp/xác nhận/hủy và lịch sử nhập. |
| Loyalty | Hạng thành viên, sắp xếp/batch, user theo hạng, lịch sử/điều chỉnh điểm và rule. |
| Khuyến mãi | Voucher, kiểm tra mã, preview, usage, bulk action, CSV, campaign và analytics. |
| Đơn hàng | Danh sách vận hành/tra cứu, lọc ngày/sort/saved view, realtime, drawer chi tiết, trạng thái, trả hàng, GHN, VNPay, refund và audit log. |
| Mapping GHN | Queue “Cần mapping GHN”, sửa/xác minh ngay trong đơn, lưu confidence/ngày kiểm tra, import/review/backfill qua API admin. |
| Đánh giá | Lọc, duyệt/ẩn, bulk status, phản hồi và xóa. |
| Hỗ trợ | Inbox ticket, phân công/trả lời, FAQ, canned response, analytics và realtime. |
| Phối đồ ảo | Danh sách job, retry/cancel/hide, retry video, prompt rule và khóa/mở tài khoản. |
| Cài đặt cửa hàng | Tên, avatar, mô tả, liên hệ và mạng xã hội; mobile đọc lại cấu hình này. |

### 3.2 Mobile

| Nhóm | Trạng thái hiện tại |
|---|---|
| Catalog | Trang chủ, danh mục, tìm kiếm chữ, filter/sort, chi tiết sản phẩm và gợi ý tương tự. |
| Mua hàng | Yêu thích, giỏ hàng, voucher, checkout preview, tạo đơn có idempotency. |
| Thanh toán | COD và VNPay đã có luồng tạo URL, deep link `fashion-ecommerce://payment-return` và kiểm tra lại trạng thái. |
| Tài khoản | Hồ sơ, avatar, địa chỉ, đổi mật khẩu, hạng thành viên và phương thức nhận hoàn tiền. |
| Đơn hàng | Danh sách/chi tiết, realtime, hủy, xác nhận đã nhận, yêu cầu trả hàng và ảnh minh chứng. |
| Đánh giá | Xem đánh giá sản phẩm, tạo/sửa/xóa đánh giá của tôi, đánh dấu hữu ích. |
| Hỗ trợ | FAQ, tạo/xem/trả lời/đóng/mở lại ticket và attachment. |
| Thông báo trong app | Summary, danh sách, đọc từng mục/đọc tất cả, polling và Socket.IO. |
| Gợi ý sản phẩm | Cá nhân hóa, similar/cart recommendation, impression/click và tracking giỏ hàng/mua hàng ở backend. |
| Phối đồ ảo | Upload/chụp ảnh, chọn outfit, validate ảnh, tạo job, realtime/polling, lịch sử, kết quả ảnh/video, tải/chia sẻ/thêm lại vào giỏ. |

## 4. Backlog P0

### P0-01 — OTP SMS real/mock

**Trạng thái: đã triển khai code và test tự động; chờ sandbox smoke test**

**Đã làm ngày 29/07/2026**

- Tách resolver và adapter `mock`, `twilio`, `esms`; `SMS_PROVIDER=auto` chọn provider thật khi đủ trọn nhóm credential.
- Development/test tự về `mock`; production thiếu credential trả lỗi cấu hình và không giả lập gửi thành công.
- Mock dùng mã cấu hình `SMS_MOCK_OTP` (mặc định `123456` ngoài production), có mock outbox phục vụ test.
- Twilio/eSMS có timeout, retry giới hạn và chuẩn hóa `SmsDeliveryError`; nếu gửi lỗi thì xóa OTP vừa lưu.
- Với số có thể đăng ký hoặc tài khoản khôi phục tồn tại, API chỉ xác nhận gửi sau khi adapter chấp nhận request; response công khai không chứa provider message ID. Trường hợp cần chống dò tài khoản dùng thông báo có điều kiện, không khẳng định SMS chắc chắn đã gửi.
- Web và mobile hiển thị rõ chế độ mock/real. Luồng quên mật khẩu giữ thông báo trung tính để không làm lộ tài khoản có tồn tại hay không.
- Bổ sung unit test cho resolver, mock outbox, Twilio/eSMS, retry, service và controller.

**Bằng chứng**

- `backend/src/utils/sms-provider.ts`
- `backend/src/utils/sms.ts`
- `backend/src/utils/__tests__/sms-provider.test.ts`
- `backend/src/utils/__tests__/sms.test.ts`
- `backend/src/modules/auth/__tests__/auth.controller.test.ts`
- `backend/src/modules/auth/__tests__/auth.service.test.ts`
- `web_frontend/src/features/auth/components/RegisterModal.tsx`
- `mobile/src/features/auth/screens/RegisterScreen.tsx`
- `mobile/src/features/auth/screens/ForgotPasswordScreen.tsx`

**Còn lại**

- Điền credential sandbox cho provider được chọn.
- Smoke test OTP đăng ký và khôi phục trên thiết bị thật.
- Xác nhận sender/brand name, template và quota với tài khoản nhà cung cấp thực tế.

**Definition of Done**

- [x] Dev/test có mock OTP khi `.env` trống.
- [ ] Khi đủ `.env`, thiết bị thật nhận được OTP đăng ký và OTP khôi phục.
- [x] API/UI phân biệt rõ `mock` và `real`; provider thật lỗi thì không báo đã gửi thành công.

### P0-02 — Khôi phục/ép đổi mật khẩu

**Trạng thái: đã triển khai code và test tự động; chờ SMTP/device smoke test**

**Đã làm ngày 29/07/2026**

- Thêm resolver `EMAIL_PROVIDER=auto|mock|smtp`; đủ nhóm SMTP thì gửi thật, thiếu credential ngoài production thì dùng mock, production thiếu cấu hình trả lỗi.
- Mock email dùng token cố định ngoài production, ghi nội dung/link vào outbox bộ nhớ và trả token/link có điều kiện giống nhau dù tài khoản có tồn tại hay không.
- Email SMTP chỉ được tính thành công khi provider trả message ID và có ít nhất một địa chỉ được chấp nhận; có timeout cấu hình.
- `forgotPassword` và admin force reset rollback reset token/trạng thái xác thực nếu email delivery thất bại.
- Email reset chứa deep link `fashion-ecommerce://reset-password`; mobile parse `identifier`/`token`, mở đúng màn và điền sẵn token.
- `SessionUser` mobile đã có `mustChangePassword`; navigator chỉ cho vào màn đổi mật khẩu hoặc khôi phục khi cờ này bật.
- Admin ép reset làm mất refresh token, đánh dấu thời điểm thu hồi credential và middleware từ chối access token cũ. Token đăng nhập mới chỉ được dùng cho đổi mật khẩu/logout đến khi hoàn tất.
- Web Admin hiển thị rõ mock token hoặc trạng thái SMTP đã tiếp nhận.

**Bằng chứng**

- `backend/src/utils/email-provider.ts`
- `backend/src/utils/email.ts`
- `backend/src/middlewares/auth.middleware.ts`
- `backend/src/modules/auth/auth.service.ts`
- `backend/src/modules/users/user.service.ts`
- `mobile/src/features/auth/passwordResetLink.ts`
- `mobile/src/features/auth/screens/ForgotPasswordScreen.tsx`
- `mobile/src/features/auth/screens/ForceChangePasswordScreen.tsx`
- `mobile/src/navigation/AppNavigator.tsx`

**Còn lại**

- Điền credential SMTP staging và gửi thử tới hộp thư thật.
- Xác nhận custom scheme/deep link trên Android và iOS development build.
- Nếu triển khai trang reset cho web khách hàng, điền `PASSWORD_RESET_WEB_URL`; mặc định hiện chỉ gửi link mobile để tránh liên kết web chưa tồn tại.

**Definition of Done**

- [x] Quên mật khẩu qua email chạy trọn luồng bằng mock token/outbox khi `.env` trống.
- [ ] Hộp thư thật nhận được link hợp lệ khi SMTP được cấu hình.
- [x] Admin ép reset làm access/refresh token cũ mất hiệu lực và lần đăng nhập tiếp theo không thể bỏ qua bước đặt mật khẩu mới.

### P0-03 — GHN chưa phủ địa chỉ mà mobile cho phép chọn

**Trạng thái: đã hoàn tất code, test tự động và sandbox smoke; chờ dữ liệu mapping production**

**Đã làm ngày 29/07/2026**

- Tạo collection `ShippingAreaMapping`, unique theo provider/tỉnh/phường; lưu `confidence`, trạng thái review, `verifiedAt`, `verifiedBy` và ghi chú.
- Thêm API admin:
  - `GET /api/admin/shipping-area-mappings` để tra cứu/review backlog mapping.
  - `GET /api/admin/shipping-area-mappings/coverage` để đo coverage theo 34 tỉnh và chặn production khi chưa đạt 100%.
  - `POST /api/admin/shipping-area-mappings/import` để upsert tối đa 1.000 mapping/lần và backfill order/user address.
  - `PATCH /api/admin/shipping-area-mappings/:id/review` để verify/disable và backfill sau review.
- Quote chỉ gọi GHN khi có bộ mã đã xác minh; thiếu mapping/config/provider thì giữ `FIXED_FALLBACK`.
- Order lưu snapshot mapping gồm nguồn, confidence và ngày xác minh. Vận đơn chỉ được tạo qua `POST /api/admin/orders/:id/ghn-shipment`; route tạo GHN thô đã được gỡ để không bypass guard.
- Backend trả `GHN_MAPPING_REQUIRED` và tuyệt đối không gọi `GHNService.createShippingOrder` khi mapping thiếu/chưa xác minh.
- Web Admin có queue “Cần mapping GHN”, số đếm từ backend, cảnh báo trong drawer và form nhập `ProvinceID/DistrictID/WardCode`; mapping đã duyệt được áp dụng lại cho địa chỉ cùng mã tỉnh/phường.
- Mobile tiếp tục checkout được bằng phí tạm tính và truyền metadata mapping trong snapshot; không báo GHN thật khi chỉ đang fallback.
- Unit test phủ seed/managed mapping, import + backfill, quote fallback không gọi GHN và create shipment bị chặn. Playwright phủ queue và điều kiện mở nút tạo vận đơn.
- GHN sandbox thật đã quote thành công Hà Nội (38.500đ) và Cần Thơ (20.900đ), tạo vận đơn sandbox rồi hủy thành công.
- Coverage report trên database hiện tại: **12/3.321 phường/xã (0,36%)**, thiếu 3.309; `readyForProduction=false`.

**Bằng chứng**

- `backend/src/database/models/shipping-area-mapping.model.ts`
- `backend/src/modules/shipping/shipping-area-mapping.service.ts`
- `backend/src/modules/shipping/shipping-area-mapping.controller.ts`
- `backend/src/modules/orders/order.service.ts`
- `backend/src/modules/shipping/shipping-area-mapping.data.ts`
- `web_frontend/src/features/admin/modules/orders/components/OrderShippingPanel.tsx`
- `web_frontend/src/features/admin/modules/orders/utils/orderQueue.ts`
- `web_frontend/e2e/order-payment.spec.ts`

**Còn lại trước production**

- Chuẩn bị/import bộ mapping đã đối chiếu cho toàn bộ tỉnh/phường thuộc phạm vi bán hàng; seed 12 dòng chỉ dùng làm dữ liệu khởi đầu, không được hiểu là đã phủ 34/34 tỉnh.
- Chạy báo cáo coverage sau import và chỉ bật vùng bán hàng khi 100% địa chỉ trong vùng có mapping `verified`.

**Definition of Done**

- [x] Thiếu mapping dùng phí cố định, vào queue riêng và không thể gọi tạo vận đơn GHN.
- [x] Admin biết chính xác đơn nào đang dùng fallback và có thể sửa/lưu lại mapping trước khi bàn giao.
- [x] Quote, tạo và hủy vận đơn chạy thật trên GHN sandbox ở nhiều tỉnh.
- [ ] Bộ mapping production phủ 100% địa chỉ trong phạm vi bán hàng.

### P0-04 — Bộ E2E admin

**Trạng thái: hoàn tất ngày 29/07/2026**

- Trước sửa: **7 passed, 4 failed** do test vẫn chờ `/admin/orders`, trong khi route mặc định là `/admin/dashboard`.
- Đã tách helper đăng nhập demo dùng chung tại `web_frontend/e2e/helpers/admin.ts`.
- Đã cập nhật loyalty/voucher/campaign và notification badge dùng helper mới.
- Sau sửa: `npm run test:e2e` **11 passed, 0 failed**.

**Bằng chứng**

- `web_frontend/e2e/loyalty-voucher.spec.ts:8`
- `web_frontend/e2e/notification-badge.spec.ts:9`
- `web_frontend/src/features/admin/config/adminRoutes.ts:45`

**Definition of Done**

- [x] `npm run test:e2e` xanh 11/11 trước khi tiếp tục refactor admin.

## 5. Backlog P1

### P1-01 — Google/Facebook social login trên mobile

**Đã thực hiện**

- [x] Thêm resolver `auto`: chỉ mount và hiển thị từng provider khi public client ID đúng định dạng; thiếu hoặc còn placeholder thì ẩn toàn bộ phần social login.
- [x] Có `EXPO_PUBLIC_SOCIAL_AUTH_MODE=disabled` để tắt chủ động theo môi trường; không có đường mock hoặc tự tạo tài khoản giả trong production.
- [x] Khai báo public ID trong `.env.example`; mỗi EAS environment dùng giá trị riêng nhưng cùng tên biến.
- [x] Đăng ký scheme `com.fashionshop.app` cho Google và thêm động `fb{APP_ID}` cho Facebook qua `app.config.ts`.
- [x] Dùng redirect URI native cố định theo development build; nhận token từ cả `params` và kết quả code exchange của Expo AuthSession.
- [x] Không khởi tạo OAuth hook với client ID rỗng; nút bị khóa trong lúc request chưa sẵn sàng và chống xử lý lặp cùng token.
- [x] Có unit test cho thiếu cấu hình, placeholder, từng provider, redirect URI và chế độ `disabled`.

**Còn lại trước production**

- [ ] Cấu hình `EXPO_PUBLIC_GOOGLE_CLIENT_ID` và `EXPO_PUBLIC_FACEBOOK_APP_ID` thật trong từng EAS environment; Google client ID phải khớp `GOOGLE_CLIENT_ID` và Facebook app phải khớp `FACEBOOK_APP_ID` ở backend.
- [ ] Khai báo redirect URI tương ứng trong Google/Facebook console và smoke test đăng nhập trên Android/iOS development build. OAuth custom scheme không được nghiệm thu bằng Expo Go.

### P1-02 — Push notification chung trên mobile

**Đã thực hiện**

- [x] Resolver `auto` đọc EAS Project ID từ env hoặc Expo config; `disabled`, web, Expo Go hoặc thiếu project ID đều bỏ qua remote push mà không ảnh hưởng notification center/realtime.
- [x] Chuyển opt-in khỏi màn Hỗ trợ sang màn `Cài đặt thông báo`, truy cập được từ Tài khoản và Trung tâm thông báo.
- [x] Lưu opt-in và preference theo thiết bị trong SecureStore; hỗ trợ sáu nhóm `order`, `promotion`, `support`, `account`, `virtual_try_on`, `system`.
- [x] Backend lưu preference trên từng Expo token và lọc trước khi gửi; endpoint chung là `POST/DELETE /api/notifications/push-token`, alias cũ của support vẫn tương thích.
- [x] Tự lấy lại token khi app active, nghe sự kiện Expo đổi token, đăng ký token mới trước rồi vô hiệu token cũ; logout vẫn vô hiệu toàn bộ token đang active.
- [x] Không tự xin quyền trong silent refresh. Chỉ hành động opt-in rõ ràng của người dùng mới mở permission prompt.
- [x] Tạo Android notification channel trước khi xin quyền/đăng ký token.
- [x] Push tap được ánh xạ tập trung sang support ticket, order detail và virtual try-on; response lúc navigation chưa ready được giữ lại, cold-start response được clear và identifier được chống xử lý lặp.
- [x] Unit test cover resolver, preference filtering, token validation, silent permission, live response và killed-state response.

**Còn lại trước production**

- [ ] Xác nhận EAS project/credential push cho từng development/preview/production environment. Chỉ thêm `EXPO_ACCESS_TOKEN` ở backend nếu dự án bật Expo Push Security.
- [ ] Smoke test nhận push và mở đúng màn trên Android/iOS development build ở foreground, background và killed; Expo Go không dùng để nghiệm thu.

### P1-03 — Search history đã có tracking nhưng chưa đồng bộ và chống đếm lặp

**Đã thực hiện**

- [x] Mỗi thao tác tìm kiếm mới trên mobile tạo một `searchEventId` và gắn `searchSource` (`mobile_manual`, `mobile_history`, `mobile_suggestion`) vào request catalog.
- [x] Filter, sort, refetch và retry giữ nguyên event ID; backend có unique partial index theo `eventId` để cùng một ý định chỉ được ghi một lần.
- [x] Client cũ chưa gửi event ID được chống ghi lặp theo người dùng/session, loại tìm kiếm, source, từ khóa chuẩn hóa và cửa sổ `SEARCH_HISTORY_DEDUPE_WINDOW_MS` (mặc định 30 giây).
- [x] Tracking vẫn chạy best-effort sau khi catalog trả kết quả; lỗi ghi lịch sử không làm lỗi request sản phẩm hoặc chặn navigation.
- [x] Khi đăng nhập, `POST /api/search-history/sync` gắn lịch sử guest session vào tài khoản, trả danh sách từ khóa distinct mới nhất và mobile merge với tối đa 10 từ khóa trong SecureStore.
- [x] Xóa một từ khóa hoặc toàn bộ lịch sử trên mobile đã đăng nhập cũng gọi `DELETE /api/search-history/me`, tránh dữ liệu server xuất hiện lại ở lần sync sau.
- [x] Có unit test cho unique event ID, dedupe window, migrate guest session, merge local/server không phân biệt hoa thường và giới hạn 10 mục.

**Còn lại trước production**

- [ ] Chạy smoke test trên Android/iOS với guest → đăng nhập, nhiều thiết bị, filter/sort/refetch và trạng thái offline; xác nhận số event analytics không tăng lặp.

### P1-04 — Admin khách hàng còn ba tab giữ chỗ

**Đã thực hiện**

- [x] `GET /api/admin/users/:id/insights` trả tổng đơn, đơn thành công, tổng chi tiêu từ các đơn đã thanh toán và năm đơn gần nhất.
- [x] Link “Tra cứu đơn” mở workspace đơn hàng với mã đơn trên query string; màn tra cứu đọc query này và áp dụng ngay vào bộ lọc.
- [x] Timeline có pagination, hợp nhất đăng ký/đăng nhập gần nhất, đơn hàng, support, review, interaction/recommendation, virtual try-on và audit theo thời gian.
- [x] Thêm model `CustomerNote` với customer, nội dung, người tạo/cập nhật và timestamp; có API list/create/update/delete.
- [x] `customers.read` được xem insights/notes; `customers.manage` mới được CRUD note. Mọi create/update/delete note, khóa/mở tài khoản và yêu cầu reset mật khẩu đều ghi audit theo target khách hàng.
- [x] Ba tab trong drawer đã dùng dữ liệu thật, có loading/error/empty state, phân trang timeline và form sửa/xóa note.
- [x] Có unit test cho schema note, validation, audit khi tạo note và timeline hợp nhất nhiều nguồn.

**Còn lại trước production**

- [ ] Smoke test quyền admin/staff (`customers.read` so với `customers.manage`) và dữ liệu khách có lịch sử lớn trên staging.

### P1-05 — Quyền “cấu hình phối đồ ảo” chưa có tác dụng

**Đã thực hiện**

- [x] Chốt ranh giới cấu hình: DB chỉ lưu công tắc runtime, quota ảnh/video và chính sách prompt; provider, model, endpoint, workflow và API key tiếp tục do env/deployment secret quản lý.
- [x] Thêm singleton `VirtualTryOnSettings` có version và tối đa 20 snapshot; `PATCH /api/admin/virtual-try-on/settings` dùng optimistic concurrency, validate đầy đủ và ghi audit.
- [x] Thêm `POST /api/admin/virtual-try-on/settings/rollback`; rollback một snapshot luôn tạo version mới và ghi audit, không sửa lịch sử tại chỗ.
- [x] Hai API ghi yêu cầu riêng permission `virtual_try_on.settings`; quyền đọc vẫn chỉ cần `virtual_try_on.read`.
- [x] Runtime setting được áp dụng vào upload/validate ảnh nguồn, tạo/retry job ảnh và video, quota theo user, độ dài/ngưỡng vi phạm prompt, capability trả về mobile và resume video sau restart.
- [x] Trang admin có form bật/tắt và chỉnh quota, hiển thị version, hỗ trợ rollback; các secret chỉ hiện trạng thái đã/chưa cấu hình, không có giá trị thật trong response hay form.
- [x] Có unit test cho schema/range, mặc định env, create/update conflict, rollback/audit và prompt max length runtime.

**Còn lại trước production**

- [ ] Smoke test trên staging với admin, staff chỉ có `virtual_try_on.read`, staff có `virtual_try_on.settings`, hai trình duyệt cùng sửa để xác nhận conflict `409`, rollback và mobile đang mở khi công tắc bị tắt/bật.
- [ ] Xác nhận deployment secret thật cho provider/endpoint/workflow ở staging; kiểm tra response và log không lộ API key.

### P1-06 — Image validation của phối đồ ảo đang suy giảm

**Đã thực hiện**

- [x] Thêm resolver `IMAGE_VALIDATION_PROVIDER=auto`: dùng `custom_model` khi có URL; dev/test thiếu URL mới rơi về `mock`; production thiếu URL giữ trạng thái cấu hình lỗi và fail-closed.
- [x] Bỏ mặc định ngầm `127.0.0.1:7001`; adapter `custom_model` yêu cầu URL HTTP(S) rõ ràng.
- [x] Production luôn fail-closed kể cả khi vô tình đặt `IMAGE_VALIDATION_FAIL_OPEN=true`; fail-open chỉ còn là lựa chọn có chủ ý ngoài production.
- [x] Kiểm tra `/health` của provider với timeout riêng; trả provider/resolver/latency/reason qua admin settings và mobile capabilities.
- [x] Khi provider bắt buộc nhưng unavailable, capability tạo ảnh bị tắt với lý do `IMAGE_VALIDATION_UNAVAILABLE`.
- [x] Backend hard-block `IMAGE_POLICY_BLOCKED`, `VALIDATION_PROVIDER_FAILED`, `MULTIPLE_PEOPLE_DETECTED` cùng các lỗi ảnh nguồn cũ; upload lỗi policy/provider xóa lại asset Cloudinary vừa tải.
- [x] Không còn nhánh kiểm tra độ phù hợp cơ thể ghi đè kết quả policy/safety thành hợp lệ.
- [x] Mobile chặn chọn asset/tạo job cho lỗi terminal, không còn thông báo “vẫn có thể tiếp tục”; admin hiển thị trạng thái kiểm tra ảnh nguồn.
- [x] Thêm unit/integration test cho resolver, URL, health, fail-open/fail-closed, policy, nhiều người, dọn asset và capability outage.

**Còn lại trước production**

- [ ] Deploy image validation service trên staging, cấu hình URL/health URL bằng deployment secret và smoke từ backend container tới `/health` cùng `/validate-image`.
- [ ] Chạy bộ ảnh thật gồm ảnh hợp lệ, không có người, nhiều người, thiếu vùng cơ thể, ảnh mờ/tối và ảnh vi phạm; hiệu chỉnh threshold trước khi mở production.
- [ ] Device smoke Android/iOS cho trạng thái provider down, ảnh bị policy block và luồng chọn/chụp lại ảnh.

### P1-07 — E2E thật cho các tích hợp quan trọng

**Đã thực hiện**

- [x] Thêm harness dùng HTTP server Express thật, MongoDB Memory replica set và Socket.IO gateway; request đi qua middleware auth/permission/controller/service/model như production.
- [x] Login → cart API → preview/checkout → admin chuyển `confirmed → packed → shipping → delivered` → khách đọc lại trạng thái đơn.
- [x] VNPay tạo payment URL → IPN có chữ ký thật → reconcile → hủy đơn → full refund; chỉ mock QueryDr/refund ở adapter gateway.
- [x] GHN lấy quote → xác minh mapping → tạo vận đơn → sync → hủy vận đơn; chỉ mock các response sandbox ở `GHNService`.
- [x] Virtual try-on upload multipart → validate → job ảnh → job ảnh + video → retry riêng ảnh và video; chạy queue/provider mock thật, chỉ mock Cloudinary boundary.
- [x] Support customer tạo ticket và admin trả lời qua HTTP; Socket.IO client xác nhận event realtime đến đúng admin/customer scope.
- [x] Thêm `socket.io-client` ở devDependency của backend để test gateway thật, không đưa vào runtime production.
- [x] Thêm browser E2E riêng dùng MongoDB Memory + Express thật: seed admin/customer/order, đăng nhập qua form admin, tải order từ API và bulk update `confirmed → packed`; Playwright không intercept request trong suite này.

**Còn lại trước production**

- [ ] Chạy lại các hành trình trên staging với VNPay/GHN sandbox, Cloudinary và AI provider thật; E2E trong CI cố ý mock đúng adapter boundary để ổn định và không tiêu tốn credential/quota.

## 6. Backlog P2

### P2-01 — Orders admin thiếu thao tác vận hành hàng loạt

**Đã thực hiện**

- [x] Thêm checkbox từng dòng/chọn toàn bộ trang, giữ selection đồng bộ với dữ liệu đang hiển thị và cho phép bỏ chọn rõ ràng.
- [x] Thêm bulk status tối đa 100 đơn/lượt; bắt buộc `reason`, dùng transition/payment guard hiện có và ghi audit riêng cho từng đơn thành công.
- [x] Thêm batch tạo lại hoặc đồng bộ GHN tối đa 20 đơn/lượt và xử lý tuần tự để không dồn tải lên provider.
- [x] Bulk API trả `requestedCount`, `succeededCount`, `failedCount` cùng kết quả/lỗi theo từng `orderId`; một đơn lỗi không rollback phần đã thành công.
- [x] Xuất CSV phía server theo toàn bộ filter/sort, tối đa 5.000 dòng, có cờ truncated, UTF-8 BOM và chống CSV formula injection.
- [x] Mở/in các `labelUrl` HTTP(S) hợp lệ của các đơn đã chọn; UI báo rõ trường hợp chưa có nhãn và popup bị trình duyệt chặn.
- [x] Permission giữ nguyên ranh giới: export/nhãn dùng `orders.read`, bulk status/GHN dùng `orders.update`.
- [x] Chuyển transaction giao hàng/hoàn điểm sang wrapper của Mongoose để giữ change-tracking khi Mongo retry, tránh batch báo thành công nhưng đơn vẫn ở trạng thái cũ.
- [x] Thêm unit test partial success/audit/CSV và browser E2E cho chọn đơn → bulk status → tải CSV → mở nhãn.

### P2-02 — Notification admin chưa phủ hết module

**Đã thực hiện**

- [x] Xóa `inactiveAccounts` và các capability placeholder `accounts`, `loyaltyApprovals`, `reports` khỏi response/type/demo vì hiện không có workflow phê duyệt tương ứng.
- [x] Giữ capability cho đúng năm hàng chờ có nguồn dữ liệu thật: orders, inventory, promotions, support và reviews.
- [x] Bổ sung badge sidebar và mục trong chuông cho đánh giá chờ duyệt; nguồn đếm là `moderationStatus=pending`, quyền xem `reviews.read`, route đích `/admin/reviews`.
- [x] Tổng số việc tiếp tục cộng từ các hàng chờ đã lọc theo quyền; sửa dữ liệu demo để tổng được tính từ các nhóm con, tránh lệch badge.
- [x] Bổ sung unit test xác nhận contract không còn field giả và browser E2E cho badge/điều hướng review.

### P2-03 — Một số danh sách mobile đang tải cố định tối đa 100 mục

**Đã thực hiện**

- [x] Chuẩn hóa API support ticket, FAQ và đánh giá cá nhân nhận `page/limit`; màn hình tải 20 mục/trang, gộp theo `_id` để không trùng dữ liệu.
- [x] Thêm tải thêm và pull-to-refresh cho danh sách ticket, FAQ, đánh giá cá nhân và lịch sử phối đồ; lỗi tải thêm không làm mất trang đã có.
- [x] Phân trang kho ảnh phòng phối đồ và bộ chọn sản phẩm; các giới hạn còn lại chỉ dùng cho khối preview có chủ ý như sản phẩm gợi ý hoặc 8 job gần nhất.
- [x] Bỏ request eligibility `page=1&limit=100` ở chi tiết đơn; chỉ kiểm tra đúng các item thuộc đơn hiện tại, đồng thời vẫn nhận diện review đã có khi sản phẩm ngừng bán.
- [x] Thêm helper gộp trang/kiểm tra trang kế tiếp cùng unit test và test contract query phân trang của mobile API.

### P2-04 — Thiếu test ở lớp UI

**Đã thực hiện**

- [x] Tận dụng Playwright hiện có làm runner unit TypeScript cho admin, có config/script riêng và không khởi động web server hoặc thêm dependency.
- [x] Đặt unit test cùng module orders admin, phủ nhãn hành động/trạng thái, thông báo bước kế tiếp, ưu tiên hiển thị yêu cầu trả bị từ chối và giá trị mặc định form vận chuyển.
- [x] Tách logic nhiều nhánh khỏi mobile screen thành helper production cho đăng ký, checkout, push/settings, support, review và navigation guard; screen/provider dùng lại chính các helper này.
- [x] Bổ sung 6 suite/22 test mobile cho ngày sinh/độ tuổi, điều kiện đặt hàng/trạng thái phí giao hàng, khôi phục push preference, validation/reopen support, review và force-change-password guard.
- [x] Không dùng snapshot toàn trang; test tập trung vào nhánh quyết định ổn định, còn UI vẫn được kiểm tra bằng typecheck/build và E2E hiện có.

## 7. Kết quả kiểm tra kỹ thuật

| Lệnh | Kết quả |
|---|---|
| `web_frontend: npm run build` | Qua |
| `web_frontend: npm run lint` | Qua |
| `web_frontend: npm run test:unit` | 4/4 qua |
| `web_frontend: npm run test:e2e` | 14/14 qua |
| `web_frontend: npm run test:e2e:backend` | 1/1 browser E2E với Express/MongoDB seed thật qua |
| `mobile: npm run typecheck` | Qua |
| `mobile: npm test` | 18 suite, 76 test qua |
| `backend: npm run build` | Qua |
| `backend: npm run lint` | Qua |
| `backend: npm test` | 83 suite, 754 test qua |
| `backend: npm run test:e2e` | 2 suite, 5 test API-backed qua |
| `ai_services/image-validation: python -m pytest` | 25 test qua |

Ghi chú: build/test xanh không chứng minh SMTP, SMS, VNPay, Expo Push hay AI provider hoạt động ngoài đời. GHN đã smoke qua sandbox; SMS vẫn cần credential sandbox, email vẫn cần SMTP thật và deep-link device test.

**Trạng thái chốt code local — 30/07/2026**

- Backlog triển khai code P0, P1 và P2 đã hoàn tất; build, lint, unit test, API-backed E2E và browser E2E backend-seeded đều đã có lệnh kiểm tra riêng.
- Các checkbox còn mở được hoãn sang giai đoạn nghiệm thu production/staging vì cần credential, deployment secret, dữ liệu mapping production, sandbox/provider ngoài hoặc thiết bị Android/iOS thật.
- Các mục production được giữ nguyên trong tài liệu để thực hiện sau và không được hiểu là phần code local còn thiếu. Chỉ đánh dấu hoàn tất khi có bằng chứng smoke test từ đúng môi trường tương ứng.

## 8. Thứ tự thực hiện đề xuất

### Đợt 1 — Khóa các luồng báo sai hoặc chặn nghiệm thu

1. [x] P0-04 sửa E2E admin và đưa CI về xanh.
2. [x] P0-01 triển khai adapter real/mock cho OTP SMS.
3. [ ] P0-01 chạy sandbox smoke test trên thiết bị thật.
4. [x] P0-02 email mock outbox, deep link và reset/force reset password.
5. [ ] P0-02 chạy SMTP/deep-link smoke test trên thiết bị thật.
6. [x] P0-03 hoàn thiện code filter/queue, collection/import/review/backfill và guard GHN.
7. [ ] P0-03 import bộ mapping production phủ toàn bộ vùng bán hàng.

### Đợt 2 — Hoàn tất tích hợp mobile đang lộ trên UI

1. [x] Resolver `auto` cho social login.
2. [x] Resolver `auto` cho push notification chung.
3. [x] Search tracking, dedupe và đồng bộ lịch sử từ khóa.
4. [x] Khôi phục image validation service trong code, thêm resolver/health/fail-closed và hard-block; còn smoke provider thật trên staging.

### Đợt 3 — Hoàn thiện vận hành admin

1. [x] Customer orders/activity/notes.
2. [x] Virtual try-on settings.
3. [x] Bulk/export/print cho orders.
4. [x] Notification badge cho toàn bộ hàng chờ có nguồn dữ liệu thật.

### Đợt 4 — Tăng độ tin cậy

1. [x] API-backed E2E cho auth, order, payment, shipping, support và try-on.
2. [x] Pagination/load more mobile.
3. [x] Unit/helper test cho các nhánh UI quan trọng trên admin và mobile.

## 9. Tiêu chí đóng toàn bộ backlog

- Thiếu credential trong dev/test thì hành trình vẫn hoàn tất bằng mock/fallback; đủ nhóm `.env` thì tự dùng provider thật.
- Không có nút/tùy chọn xuất hiện nhưng chắc chắn thất bại do thiếu cấu hình.
- API phản hồi đúng mode: `real` chỉ báo gửi/xử lý sau khi provider nhận request; `mock` phải được nhận diện rõ trong dev/test.
- Production không tự giả lập đăng nhập, OTP, email hoặc thanh toán thành công.
- Mọi action admin nhạy cảm có permission, reason và audit log.
- Mobile xử lý đủ loading, empty, retry, offline/timeout và session hết hạn.
- Các luồng thanh toán/vận chuyển có idempotency và reconcile.
- CI xanh cho build, lint, unit test và E2E.
- Có checklist smoke test trên thiết bị Android/iOS và môi trường staging trước nghiệm thu.
