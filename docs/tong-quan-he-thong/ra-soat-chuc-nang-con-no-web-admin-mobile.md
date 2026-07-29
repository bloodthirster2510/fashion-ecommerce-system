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

Các khoản nợ còn ưu tiên:

1. Khôi phục/ép đổi mật khẩu qua email chưa có mock outbox/deep link và mobile còn bỏ qua cờ `mustChangePassword`.
2. Mapping địa chỉ hành chính 2025 sang GHN mới có 12 phường/xã thuộc 2/34 tỉnh, thành.
3. OTP SMS cần smoke test sandbox cho cả đăng ký và khôi phục trước khi chốt production-ready.
4. Đăng nhập Google/Facebook có UI nhưng mobile thiếu client ID; push notification đã có EAS Project ID nhưng điểm đăng ký token còn quá hẹp.
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

### P0-02 — Khôi phục/ép đổi mật khẩu chưa kín luồng

**Hiện trạng**

- SMTP hiện chưa cấu hình. `sendEmail` trả `false`, nhưng chưa ghi email vào mock outbox; `forgotPassword` và `forcePasswordReset` cũng không kiểm tra kết quả giao email.
- Mobile vẫn thông báo token đã được gửi.
- Email reset tạo link về `FRONTEND_URL/reset-password`; mobile lại yêu cầu người dùng tự nhập token.
- Admin có nút ép reset mật khẩu khách hàng. Backend đã trả `mustChangePassword` trong session, nhưng `SessionUser` mobile không khai báo trường này và mobile không ép người dùng vào màn đổi/reset mật khẩu.

**Bằng chứng**

- `backend/src/utils/email.ts:15`
- `backend/src/modules/auth/auth.service.ts:325`
- `backend/src/modules/users/user.service.ts:483`
- `mobile/src/features/auth/types.ts:45`
- `mobile/src/features/auth/screens/ForgotPasswordScreen.tsx`

**Cần làm**

- Thêm email adapter `auto`: đủ SMTP thì gửi thật, thiếu SMTP trong dev/test thì ghi mock outbox chứa link/token.
- Bắt buộc kiểm tra kết quả theo đúng mode; production không được báo “đã gửi” nếu SMTP không nhận request.
- Chọn một luồng thống nhất cho mobile: universal/deep link mở thẳng màn reset, hoặc email hiển thị mã ngắn có thể nhập.
- Thêm `mustChangePassword` vào session mobile và guard navigation.
- Với khách bị admin ép reset, cho phép hoàn tất bằng reset token; không yêu cầu mật khẩu cũ.

**Definition of Done**

- Quên mật khẩu qua email chạy trọn luồng bằng mock outbox khi `.env` trống và bằng email thật khi SMTP được cấu hình.
- Admin ép reset thì session cũ mất hiệu lực và lần đăng nhập tiếp theo không thể bỏ qua bước đặt mật khẩu mới.

### P0-03 — GHN chưa phủ địa chỉ mà mobile cho phép chọn

**Hiện trạng**

- Mobile/backend dùng danh mục hành chính 2025 gồm 34 tỉnh, thành.
- Bảng mapping GHN chỉ có 12 phường/xã, thuộc mã tỉnh `01` và `92`.
- Các địa chỉ còn lại rơi vào `fixed_fallback`: checkout vẫn tạo được đơn với phí tạm tính nhưng tạo vận đơn GHN có thể không đủ `DistrictID/WardCode`.
- Metadata nói mapping là `admin_managed`, nhưng chưa có collection hay màn admin để quản lý/import mapping.
- `fixed_fallback` là hành vi hợp lệ cho local/dev khi thiếu GHN; khoản nợ chỉ nằm ở khả năng vận hành thật và quan sát đơn cần xử lý thủ công.
- Fallback không hoàn toàn ẩn: order lưu provider `FIXED`, status `fallback` và admin hiển thị “Phí cố định”. Phần còn thiếu là filter/queue riêng và công cụ sửa mapping.

**Bằng chứng**

- `backend/src/modules/locations/location.service.ts:49`
- `backend/src/modules/shipping/shipping-area-mapping.data.ts`
- `backend/src/modules/shipping/shipping-quote.service.ts:365`
- `mobile/src/features/checkout/CheckoutScreen.tsx:391`

**Cần làm**

- Tạo collection mapping GHN và công cụ admin import/review.
- Backfill toàn bộ tỉnh/phường đang phục vụ; lưu confidence và ngày kiểm tra.
- Khi thiếu cấu hình/mapping, giữ phí cố định và đưa đơn vào queue giao hàng thủ công/mock; không gọi tạo vận đơn GHN.
- Thêm smoke test báo giá và tạo/hủy vận đơn trên nhiều tỉnh.

**Definition of Done**

- Địa chỉ trong phạm vi bán hàng đều nhận quote GHN thật.
- Admin biết chính xác đơn nào đang dùng fallback và có thể sửa mapping trước khi bàn giao.

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

### P1-01 — Google/Facebook có nút nhưng mobile thiếu cấu hình

- Hai nút social login luôn hiển thị.
- Backend đã có Google/Facebook credential, nhưng `mobile/.env` hiện thiếu `EXPO_PUBLIC_GOOGLE_CLIENT_ID` và `EXPO_PUBLIC_FACEBOOK_APP_ID`.
- Cần thêm cấu hình theo dev/staging/prod, redirect URI và test trên development build.
- Resolver `auto` chỉ hiện nút và chạy OAuth thật khi đủ nhóm credential; nếu thiếu thì ẩn nút. Mock social auth chỉ bật trong test, không tự tạo tài khoản giả ở bản production.

### P1-02 — Push notification chưa sẵn sàng và điểm đăng ký quá hẹp

- `EXPO_PUBLIC_EAS_PROJECT_ID` không có trong `.env`, nhưng `mobile/app.json` đã có `extra.EAS_PROJECT_ID` và `extra.eas.projectId`; code hiện đọc cả hai fallback này.
- `EXPO_ACCESS_TOKEN` backend hiện thiếu, nhưng code chỉ cần token này khi dự án Expo bật Push Security; không nên xem việc thiếu token là lỗi mặc định.
- Việc xin quyền/đăng ký push chỉ xảy ra khi người dùng vào màn Hỗ trợ và bấm “Bật thông báo phản hồi”.
- Vì token dùng chung cho support, shipping, payment deadline và virtual try-on, người không vào Hỗ trợ sẽ không nhận các push còn lại.

**Cần làm**

- Thêm resolver `auto`: thiếu EAS config thì bỏ qua đăng ký remote push nhưng vẫn giữ notification center/realtime trong app; đủ config thì bật remote push.
- Xác nhận EAS project theo từng môi trường; chỉ cấu hình Expo access token khi Push Security được bật.
- Chuyển opt-in push sang onboarding/cài đặt thông báo chung.
- Cho phép bật/tắt theo loại thông báo và xử lý refresh token push.
- Test nhận push + mở đúng màn từ trạng thái foreground/background/killed.

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
- Mobile có 31 screen nhưng 6 test file hiện chỉ phủ API failover, presentation/settings và helper phối đồ.
- Chưa có test screen cho auth, checkout, push, support, review và navigation guard.

Ưu tiên test reducer/helper/component có nhiều nhánh; không cần snapshot toàn trang.

## 7. Kết quả kiểm tra kỹ thuật

| Lệnh | Kết quả |
|---|---|
| `web_frontend: npm run build` | Qua |
| `web_frontend: npm run lint` | Qua |
| `web_frontend: npm run test:e2e` | 11/11 qua |
| `mobile: npm run typecheck` | Qua |
| `mobile: npm test` | 6 suite, 35 test qua |
| `backend: npm run build` | Qua |
| `backend: npm test` | 73 suite, 691 test qua |

Ghi chú: build/test xanh không chứng minh SMTP, SMS, VNPay, GHN, Expo Push hay AI provider hoạt động ngoài đời. Riêng SMS hiện mới giả lập response provider trong unit test; vẫn cần smoke test sandbox bằng credential thật.

## 8. Thứ tự thực hiện đề xuất

### Đợt 1 — Khóa các luồng báo sai hoặc chặn nghiệm thu

1. [x] P0-04 sửa E2E admin và đưa CI về xanh.
2. [x] P0-01 triển khai adapter real/mock cho OTP SMS.
3. [ ] P0-01 chạy sandbox smoke test trên thiết bị thật.
4. [ ] P0-02 email mock outbox và reset/force reset password.
5. [ ] P0-03 hoàn thiện filter/queue fallback và mapping GHN cho môi trường chạy thật.

### Đợt 2 — Hoàn tất tích hợp mobile đang lộ trên UI

1. Resolver `auto` cho social login.
2. Resolver `auto` cho push notification chung.
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
