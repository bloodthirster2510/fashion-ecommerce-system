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

Các khoản nợ còn ưu tiên:

1. Seed mapping GHN trong repo vẫn chỉ có 12 phường/xã; cần import bộ mapping production đã đối chiếu qua công cụ mới trước khi mở toàn bộ 34 tỉnh, thành.
2. OTP SMS cần smoke test sandbox cho cả đăng ký và khôi phục trước khi chốt production-ready.
3. Email reset cần smoke test bằng SMTP thật và xác nhận deep link trên development build/thiết bị thật.
4. Social login và push notification đã hoàn tất guard/config trong code; còn phải cấu hình OAuth thật và chạy smoke test push trên Android/iOS development build.
5. Search mobile đã được backend tự ghi nhận qua API catalog, nhưng lịch sử local chưa đồng bộ với tài khoản và số liệu có thể bị đếm lặp khi filter/sort tải lại trang đầu.
6. Admin khách hàng còn ba tab giữ chỗ; cấu hình provider/quota phối đồ ảo mới chỉ đọc, chưa sửa được.

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

- Search history hiển thị trên mobile hiện chỉ lưu tối đa 10 từ khóa trong SecureStore.
- Mobile không cần gọi trực tiếp `POST /api/search-history`: request catalog luôn gửi `X-Session-Id`, gửi thêm access token khi đăng nhập, và `GET /api/products?keyword=...` tự ghi `SearchHistory` ở backend cho trang đầu.
- Vì tracking gắn với request trang đầu, các lần đổi filter/sort hoặc refetch có thể ghi lặp cùng một ý định tìm kiếm.
- Lịch sử server chưa được tải về/merge với SecureStore khi người dùng đăng nhập, nên chưa có trải nghiệm lịch sử đa thiết bị.

**Cần làm**

- Giữ tracking best-effort hiện tại nhưng thêm `source`, `eventId`/dedupe window và phân biệt tìm kiếm mới với filter/sort/refetch.
- Đồng bộ lịch sử server khi đăng nhập nhưng vẫn giữ local history để phản hồi nhanh/offline.
- Không để lỗi tracking chặn navigation sang kết quả tìm kiếm.

### P1-04 — Admin khách hàng còn ba tab giữ chỗ

| Tab | Thiếu |
|---|---|
| Đơn hàng | Đơn gần nhất, tổng chi tiêu, trạng thái và link sang tra cứu đơn. |
| Tương tác | Timeline auth, đơn hàng, support, review, recommendation/try-on và audit. |
| Ghi chú nội bộ | Model ghi chú, CRUD, tác giả, thời gian, permission và audit log. |

**Bằng chứng**

- `web_frontend/src/features/admin/modules/customers/components/CustomerDetailDrawer.tsx:154`
- `web_frontend/src/features/admin/modules/customers/customer.service.ts`

**Cần làm**

- Bổ sung endpoint customer overview hoặc hỗ trợ filter order chính xác theo `userId`.
- Tạo timeline tổng hợp có pagination.
- Tạo customer note model; không lưu note vào localStorage.

### P1-05 — Quyền “cấu hình phối đồ ảo” chưa có tác dụng

- Permission `virtual_try_on.settings` có trong model, màn phân quyền và UI.
- Backend chỉ có `GET /admin/virtual-try-on/settings`, không có API cập nhật.
- Trang admin chỉ hiển thị provider/quota; dòng mô tả nói người có quyền có thể chỉnh nhưng không có form lưu.

**Cần làm**

- Chốt cấu hình nào được phép lưu DB và cấu hình nào bắt buộc qua secret/env.
- Thêm API update có validate, audit log, optimistic concurrency và rollback.
- Secret/API key chỉ nhập dạng masked/rotate; không trả ngược giá trị thật về frontend.

### P1-06 — Image validation của phối đồ ảo đang suy giảm

**Trạng thái local khi rà soát**

- Provider được chọn là `custom_model` dù nhóm cấu hình custom model chưa hoàn chỉnh.
- URL riêng chưa cấu hình nên backend dùng mặc định `127.0.0.1:7001/validate-image`.
- Cổng validation hiện không reachable.
- Mobile chỉ hard-block `NO_PERSON_DETECTED`, `BODY_NOT_VISIBLE` và `PERSON_TOO_SMALL`. Lỗi provider, `MULTIPLE_PEOPLE_DETECTED` và cả `IMAGE_POLICY_BLOCKED` hiện vẫn là cảnh báo mềm cho phép tiếp tục.
- ComfyUI tạo ảnh hiện reachable và các workflow path ảnh/video đều tồn tại khi resolve từ thư mục backend.

**Cần làm**

- Resolver `auto` phải rơi về `mock` trong dev/test nếu custom model URL không được cấu hình; khi đủ `.env` thì dùng `custom_model`.
- Khởi động/deploy image validation service và thêm health check vào capabilities/admin dashboard.
- Chốt fail-open hay fail-closed theo môi trường; production không nên âm thầm coi lỗi provider hoặc `IMAGE_POLICY_BLOCKED` là ảnh hợp lệ.
- Thêm test ảnh hợp lệ, không có người, nhiều người, thiếu vùng cơ thể và ảnh vi phạm.

### P1-07 — Chưa có E2E thật cho các tích hợp quan trọng

Cần có ít nhất một kịch bản seed + API thật cho:

- Admin xử lý đơn từ confirmed → packed → shipping → delivered.
- VNPay create URL → return/IPN → reconcile → refund.
- GHN quote → create shipment → webhook/sync → cancel.
- Mobile đăng ký/login → cart → checkout → theo dõi đơn.
- Virtual try-on upload → validate → ảnh; ảnh + video; retry từng phần.
- Support mobile ↔ admin realtime.

Các E2E admin hiện tại chủ yếu dùng demo layout; năm test order-payment chỉ kiểm tra utility thuần, chưa gọi browser/backend.

## 6. Backlog P2

### P2-01 — Orders admin thiếu thao tác vận hành hàng loạt

Đã có queue, filter, saved view và action theo từng đơn, nhưng chưa có:

- chọn nhiều đơn;
- chuyển trạng thái hàng loạt;
- xuất CSV theo bộ lọc;
- in/mở nhãn vận chuyển từ `labelUrl`;
- batch retry/sync GHN có kiểm soát.

Các action hàng loạt phải trả kết quả theo từng đơn, không rollback cả batch khi một đơn lỗi.

### P2-02 — Notification admin chưa phủ hết module

Backend đang cố định:

- `inactiveAccounts = 0`;
- capability `accounts = false`;
- `loyaltyApprovals = false`;
- `reports = false`.

Nếu chưa có workflow phê duyệt tương ứng thì bỏ badge/field khỏi UI. Nếu giữ, cần định nghĩa nguồn đếm, quyền xem và route đích.

### P2-03 — Một số danh sách mobile đang tải cố định tối đa 100 mục

Các màn support ticket, review của tôi và một số picker gọi `page=1&limit=100`, chưa có cursor/load more/pull-to-refresh đồng nhất. Dữ liệu nhỏ vẫn chạy, nhưng sẽ mất mục cũ khi tài khoản dùng lâu.

### P2-04 — Thiếu test ở lớp UI

- Admin có khoảng 178 file trong feature nhưng không có unit/component test đặt cùng module.
- Mobile có 32 screen nhưng 9 test file hiện chủ yếu phủ API failover, auth/push config, presentation/settings và helper phối đồ.
- Chưa có test screen cho auth, checkout, push, support, review và navigation guard.

Ưu tiên test reducer/helper/component có nhiều nhánh; không cần snapshot toàn trang.

## 7. Kết quả kiểm tra kỹ thuật

| Lệnh | Kết quả |
|---|---|
| `web_frontend: npm run build` | Qua |
| `web_frontend: npm run lint` | Qua |
| `web_frontend: npm run test:e2e` | 13/13 qua |
| `mobile: npm run typecheck` | Qua |
| `mobile: npm test` | 9 suite, 47 test qua |
| `backend: npm run build` | Qua |
| `backend: npm test` | 77 suite, 714 test qua |

Ghi chú: build/test xanh không chứng minh SMTP, SMS, VNPay, Expo Push hay AI provider hoạt động ngoài đời. GHN đã smoke qua sandbox; SMS vẫn cần credential sandbox, email vẫn cần SMTP thật và deep-link device test.

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
3. Search tracking từ khóa.
4. Khôi phục image validation service.

### Đợt 3 — Hoàn thiện vận hành admin

1. Customer orders/activity/notes.
2. Virtual try-on settings.
3. Bulk/export/print cho orders.
4. Notification badge còn thiếu.

### Đợt 4 — Tăng độ tin cậy

1. API-backed E2E cho auth, order, payment, shipping, support và try-on.
2. Pagination/load more mobile.
3. Component/screen tests cho các nhánh lỗi và permission.

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
