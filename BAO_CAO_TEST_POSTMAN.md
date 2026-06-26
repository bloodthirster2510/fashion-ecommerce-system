# Báo cáo hướng dẫn test Postman cho ứng dụng Fashion Ecommerce

Ngày lập: 26/06/2026  
Phạm vi: kiểm thử API backend local bằng Postman, ưu tiên luồng có sẵn trong collection `Fashion Ecommerce - Shipping Flow`.

## 1. Mục tiêu kiểm thử

Báo cáo này mô tả cách dùng Postman để kiểm thử các API chính của ứng dụng Fashion Ecommerce trên môi trường local:

- Đăng nhập tài khoản quản trị.
- Lấy và chuẩn bị đơn hàng để giao.
- Cập nhật trạng thái thanh toán khi cần.
- Giả lập luồng giao hàng: đóng gói, sẵn sàng giao, đã lấy hàng, đang giao, đã giao, hoàn tất.
- Kiểm thử tạo, đồng bộ, hủy vận đơn GHN nếu đã cấu hình GHN.
- Kiểm thử webhook giao hàng mô phỏng.

## 2. Tài nguyên Postman hiện có

Trong thư mục `postman/` có 2 file:

| File | Vai trò |
| --- | --- |
| `postman/fashion-shipping-flow.postman_collection.json` | Collection test luồng vận chuyển, thanh toán và webhook cho đơn hàng. |
| `postman/fashion-local.postman_environment.json` | Environment local chứa `base_url`, tài khoản admin, token, `order_id`, trạng thái đơn, trạng thái giao hàng và webhook secret. |

Collection đang dùng base URL:

```text
http://localhost:5000/api
```

## 3. Điều kiện chuẩn bị

### 3.1. Backend local

Backend cần chạy ở port `5000`.

```bash
cd backend
npm install
npm run dev
```

Các biến môi trường quan trọng trong `backend/.env`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/fashion-ecommerce
JWT_ACCESS_SECRET=replace-with-a-long-random-access-secret
JWT_REFRESH_SECRET=replace-with-a-long-random-refresh-secret
OTP_HASH_SECRET=replace-with-a-long-random-otp-secret
ADMIN_INITIAL_PASSWORD=your-known-admin-password
SHIPPING_WEBHOOK_SECRET=replace-with-a-long-random-simulated-webhook-secret
```

Nếu test GHN thật, cần thêm:

```env
GHN_BASE_URL=...
GHN_TOKEN=...
GHN_SHOP_ID=...
GHN_WEBHOOK_SECRET=...
SHOP_NAME=...
SHOP_PHONE=...
SHOP_ADDRESS=...
SHOP_DISTRICT_ID=...
SHOP_WARD_CODE=...
```

### 3.2. Dữ liệu admin

Seeder tạo admin mặc định:

```text
admin@fashion.com
```

Lưu ý: mật khẩu admin seed không được in ra console. Để test ổn định, nên đặt `ADMIN_INITIAL_PASSWORD` trước khi seed DB hoặc dùng mật khẩu admin đã biết trong database local.

Chạy seed nếu cần:

```bash
cd backend
npm run seed
```

### 3.3. Dữ liệu đơn hàng

Luồng shipping yêu cầu có ít nhất một đơn hàng ở trạng thái `confirmed` hoặc biết trước `orderCode`/`order_id`.

Nếu chưa có đơn:

- Tạo đơn từ frontend/mobile bằng tài khoản khách hàng.
- Hoặc gọi API khách hàng `/api/orders/preview` và `/api/orders` sau khi login user.
- Sau khi có đơn, admin có thể tìm đơn trong Postman bằng `order_keyword` hoặc lấy đơn `confirmed` đầu tiên.

## 4. Cách import và cấu hình Postman

1. Mở Postman.
2. Import collection:

```text
postman/fashion-shipping-flow.postman_collection.json
```

3. Import environment:

```text
postman/fashion-local.postman_environment.json
```

4. Chọn environment `Fashion Local`.
5. Cập nhật các biến sau trong environment:

| Biến | Giá trị cần nhập |
| --- | --- |
| `base_url` | `http://localhost:5000/api` |
| `admin_identifier` | `admin@fashion.com` hoặc email staff/admin khác |
| `admin_password` | Mật khẩu admin/staff local |
| `webhook_secret` | Trùng với `SHIPPING_WEBHOOK_SECRET` trong backend nếu test public webhook |
| `order_keyword` | Mã đơn hàng cần tìm, nếu không muốn lấy đơn `confirmed` đầu tiên |
| `actual_provider_cost` | Chi phí giao hàng thực tế, mặc định `25000` |
| `shipping_provider` | Mặc định `GHN` |

Không cần nhập thủ công `admin_token`, `order_id`, `tracking_code`, `order_status`, `payment_status`, `shipping_status` nếu chạy đúng thứ tự, vì collection tự lưu các biến này.

## 5. Luồng test chính trong collection

### 5.1. Nhóm `00 - Auth`

#### Admin Login

Endpoint:

```http
POST {{base_url}}/auth/admin/login
```

Body:

```json
{
  "identifier": "{{admin_identifier}}",
  "password": "{{admin_password}}"
}
```

Kỳ vọng:

- HTTP `200`.
- Response có `data.accessToken`.
- Postman tự lưu token vào `admin_token`.
- Các request sau dùng Bearer token `{{admin_token}}`.

Nếu lỗi:

- `401`: sai email/mật khẩu hoặc tài khoản không phải admin/staff.
- `429`: bị rate limit auth, chờ hết window hoặc giảm số lần gọi.

### 5.2. Nhóm `01 - Prepare Order`

#### List Confirmed Orders - Save First order_id

Endpoint:

```http
GET {{base_url}}/admin/orders?status=confirmed&page=1&limit=10
```

Kỳ vọng:

- HTTP `200`.
- Response có `data.items`.
- Nếu có đơn, Postman tự lưu `order_id`, `order_code`, `order_user_id`, `order_status`, `payment_method`, `payment_status`, `tracking_code`.

Trường hợp không có đơn:

- Tạo đơn mới trước.
- Hoặc nhập mã đơn vào `order_keyword` rồi chạy request tìm kiếm bên dưới.

#### Find Order by order_keyword - Save order_id

Endpoint:

```http
GET {{base_url}}/admin/orders?keyword={{order_keyword}}&page=1&limit=10
```

Kỳ vọng:

- HTTP `200`.
- Nếu `order_keyword` có giá trị, `data.items.length` phải lớn hơn `0`.
- Postman tự lưu thông tin đơn đầu tiên tìm được.

#### Get Current Order

Endpoint:

```http
GET {{base_url}}/admin/orders/{{order_id}}
```

Kỳ vọng:

- HTTP `200`.
- Response trả về chi tiết đơn hiện tại.
- Environment được refresh lại theo trạng thái mới nhất.

#### Only Online - Mark Current Order Paid

Endpoint:

```http
PATCH {{base_url}}/admin/payments/orders/{{order_id}}/payment-status
```

Body:

```json
{
  "paymentStatus": "paid",
  "reason": "Postman shipping flow setup"
}
```

Kỳ vọng:

- HTTP `200`.
- `payment_status = paid`.

Lưu ý:

- Request này tự skip nếu `payment_method = COD`.
- Với COD, thanh toán nên giữ `pending` cho đến khi giao thành công.

#### Move Current Order To Packed

Endpoint:

```http
PATCH {{base_url}}/admin/orders/{{order_id}}/status
```

Body:

```json
{
  "status": "packed",
  "reason": "Packed from Postman before shipping"
}
```

Kỳ vọng:

- HTTP `200`.
- `order_status = packed`.
- Đây là trạng thái cần có trước khi bắt đầu giao hàng.

### 5.3. Nhóm `02 - Shipping Simulation`

#### Update Shipping Info

Endpoint:

```http
PATCH {{base_url}}/admin/orders/{{order_id}}/shipping
```

Body:

```json
{
  "provider": "{{shipping_provider}}",
  "status": "ready",
  "trackingCode": "{{tracking_code}}",
  "labelUrl": "{{shipping_label_url}}",
  "actualProviderCost": {{actual_provider_cost}},
  "reason": "Assigned test tracking from Postman"
}
```

Kỳ vọng:

- HTTP `200`.
- `shipping_status = ready`.
- `tracking_code` được sinh dạng `TEST-<timestamp>` nếu chưa có.

#### Simulate Picked

Endpoint:

```http
POST {{base_url}}/admin/orders/{{order_id}}/shipping-webhook-simulation
```

Body:

```json
{
  "status": "picked",
  "provider": "{{shipping_provider}}",
  "trackingCode": "{{tracking_code}}",
  "reason": "Carrier picked the parcel"
}
```

Kỳ vọng:

- HTTP `200`.
- `order_status = shipping`.

#### Simulate Shipping

Endpoint:

```http
POST {{base_url}}/admin/orders/{{order_id}}/shipping-webhook-simulation
```

Body:

```json
{
  "status": "shipping",
  "provider": "{{shipping_provider}}",
  "trackingCode": "{{tracking_code}}",
  "reason": "Carrier is delivering the parcel"
}
```

Kỳ vọng:

- HTTP `200`.
- `shipping_status = shipping`.

#### Simulate Delivered

Endpoint:

```http
POST {{base_url}}/admin/orders/{{order_id}}/shipping-webhook-simulation
```

Body:

```json
{
  "status": "delivered",
  "provider": "{{shipping_provider}}",
  "trackingCode": "{{tracking_code}}",
  "deliveredAt": "{{$isoTimestamp}}",
  "reason": "Carrier delivered the parcel"
}
```

Kỳ vọng:

- HTTP `200`.
- `order_status = delivered`.
- `shipping_status = delivered`.
- Nếu đơn là COD, `payment_status = paid` sau khi delivered.

#### Mark Completed - Simulate Customer Received

Endpoint:

```http
PATCH {{base_url}}/admin/orders/{{order_id}}/status
```

Body:

```json
{
  "status": "completed",
  "reason": "Postman simulate customer received parcel"
}
```

Kỳ vọng:

- HTTP `200`.
- `order_status = completed`.
- Response có `receivedAt`.

Ghi chú nghiệp vụ:

- Trong app thật, khách hàng xác nhận đã nhận bằng:

```http
PATCH /api/orders/:id/confirm-received
```

- Request trong collection là shortcut admin để test nhanh.

### 5.4. Nhóm `03 - Optional GHN Real Shipment`

Chỉ chạy nhóm này khi backend đã cấu hình GHN và địa chỉ nhận có mapping GHN hợp lệ.

#### Create GHN Shipment

Endpoint:

```http
POST {{base_url}}/admin/orders/{{order_id}}/ghn-shipment
```

Kỳ vọng:

- HTTP `200`.
- Đơn có `shipping.trackingCode`.
- `shipping_status` được cập nhật từ GHN.

#### Sync GHN Shipment

Endpoint:

```http
POST {{base_url}}/admin/orders/{{order_id}}/ghn-shipment/sync
```

Kỳ vọng:

- HTTP `200`.
- Backend lấy trạng thái mới nhất từ GHN theo tracking code và áp dụng vào đơn.

#### Cancel GHN Shipment

Endpoint:

```http
POST {{base_url}}/admin/orders/{{order_id}}/ghn-shipment/cancel
```

Body:

```json
{
  "reason": "Cancelled from Postman"
}
```

Kỳ vọng:

- HTTP `200`.
- Vận đơn bị hủy nếu trạng thái GHN còn cho phép.

### 5.5. Nhóm `04 - Optional Public Webhook`

#### Public Simulated Shipping Webhook

Endpoint:

```http
POST {{base_url}}/shipping/webhooks/simulated
```

Header:

```http
x-webhook-secret: {{webhook_secret}}
```

Body:

```json
{
  "orderId": "{{order_id}}",
  "status": "shipping",
  "provider": "{{shipping_provider}}",
  "trackingCode": "{{tracking_code}}",
  "reason": "External simulated webhook from Postman"
}
```

Kỳ vọng:

- HTTP `200` nếu `webhook_secret` khớp `SHIPPING_WEBHOOK_SECRET`.
- HTTP `401` hoặc `403` nếu thiếu/sai secret.

## 6. Checklist chạy test đề xuất

| Bước | Request | Kết quả mong đợi |
| --- | --- | --- |
| 1 | `Admin Login` | Có `admin_token`. |
| 2 | `List Confirmed Orders` hoặc `Find Order by order_keyword` | Có `order_id`. |
| 3 | `Get Current Order` | Xác nhận đúng đơn cần test. |
| 4 | `Only Online - Mark Current Order Paid` | Chỉ dùng cho đơn online, không dùng COD. |
| 5 | `Move Current Order To Packed` | `order_status = packed`. |
| 6 | `Update Shipping Info` | `shipping_status = ready`. |
| 7 | `Simulate Picked` | `order_status = shipping`. |
| 8 | `Simulate Shipping` | `shipping_status = shipping`. |
| 9 | `Simulate Delivered` | `order_status = delivered`; COD chuyển `paid`. |
| 10 | `Mark Completed` | `order_status = completed`, có `receivedAt`. |

## 7. Các endpoint liên quan ngoài collection

Các route được mount dưới `/api`:

| Nhóm | Endpoint chính | Ghi chú |
| --- | --- | --- |
| Auth | `/auth/login`, `/auth/admin/login`, `/auth/register`, `/auth/refresh-token` | Đăng nhập user/admin và lấy token. |
| Customer orders | `/orders/preview`, `/orders`, `/orders/me`, `/orders/:id`, `/orders/:id/cancel`, `/orders/:id/confirm-received`, `/orders/:id/request-return` | Cần Bearer token user. |
| Admin orders | `/admin/orders`, `/admin/orders/:id`, `/admin/orders/:id/status`, `/admin/orders/:id/shipping` | Cần admin/staff và permission phù hợp. |
| Payments | `/payments/vnpay/orders/:orderId/create-payment-url`, `/payments/orders/:orderId/status`, `/payments/vnpay/return`, `/payments/vnpay/ipn` | VNPay return/ipn không yêu cầu auth vì cổng thanh toán gọi trực tiếp. |
| Admin payments | `/admin/payments/orders/:orderId/payment-status`, `/admin/payments/expire-stale` | Dùng cho điều chỉnh/truy vết thanh toán. |
| Shipping | `/shipping/rates`, `/shipping/webhooks/ghn`, `/shipping/webhooks/simulated` | `rates` cần auth; webhook public cần secret. |
| GHN | `/ghn/provinces`, `/ghn/districts`, `/ghn/wards`, `/ghn/services`, `/ghn/fee` | Một số endpoint GHN cần auth và cấu hình GHN. |

## 8. Cách đọc response chuẩn

Backend thường trả response theo dạng:

```json
{
  "success": true,
  "message": "...",
  "data": {}
}
```

Khi test Postman nên kiểm tra:

- HTTP status đúng: `200`, `201`, `400`, `401`, `403`, `404`, `409`.
- `success` đúng với tình huống.
- `data` có đủ field nghiệp vụ như `accessToken`, `_id`, `orderCode`, `status`, `paymentStatus`, `shipping.status`, `shipping.trackingCode`.
- Environment variables sau mỗi request đã được cập nhật đúng.

## 9. Test case lỗi nên chạy thêm

| Tình huống | Cách test | Kỳ vọng |
| --- | --- | --- |
| Sai mật khẩu admin | Đổi `admin_password` thành sai | HTTP `401`. |
| Thiếu token | Xóa `admin_token` rồi gọi `/admin/orders` | HTTP `401`. |
| User thường gọi API admin | Dùng token user cho `/admin/orders` | HTTP `403`. |
| `order_id` sai | Nhập ObjectId không tồn tại | HTTP `404`. |
| Chuyển trạng thái sai thứ tự | Gọi delivered khi đơn chưa packed/shipping | Backend từ chối hoặc không cập nhật sai nghiệp vụ. |
| Webhook sai secret | Đổi `webhook_secret` thành sai | HTTP `401`/`403`. |
| COD bị mark paid thủ công | Chạy request online payment với COD | Collection tự skip request. |
| GHN thiếu cấu hình | Gọi Create GHN Shipment khi thiếu env GHN | Response lỗi cấu hình hoặc lỗi GHN rõ ràng. |

## 10. Lỗi thường gặp và cách xử lý

| Lỗi | Nguyên nhân thường gặp | Cách xử lý |
| --- | --- | --- |
| `ECONNREFUSED` | Backend chưa chạy hoặc sai port | Chạy `npm run dev`, kiểm tra `PORT=5000`. |
| `401 Unauthorized` | Token thiếu/hết hạn/sai mật khẩu | Chạy lại `Admin Login`. |
| `403 Forbidden` | Tài khoản không có role/permission phù hợp | Dùng admin/staff đúng quyền. |
| Không tìm thấy đơn `confirmed` | Chưa có đơn phù hợp | Tạo đơn mới hoặc dùng `order_keyword`. |
| `order_id` rỗng | Chưa chạy bước tìm/lấy đơn | Chạy `List Confirmed Orders` hoặc nhập `order_id` thủ công. |
| GHN lỗi service/fee | Thiếu GHN env hoặc địa chỉ chưa mapping | Kiểm tra `GHN_*`, `SHOP_*`, `ghnDistrictId`, `ghnWardCode`. |
| Webhook simulated bị từ chối | `webhook_secret` không khớp backend | Copy đúng `SHIPPING_WEBHOOK_SECRET` vào environment. |

## 11. Có thể chạy tự động bằng Newman

Nếu muốn chạy collection qua terminal:

```bash
npx newman run postman/fashion-shipping-flow.postman_collection.json \
  -e postman/fashion-local.postman_environment.json \
  --env-var admin_password=your-admin-password \
  --env-var webhook_secret=your-shipping-webhook-secret
```

Lưu ý:

- Newman cần backend và MongoDB đang chạy.
- Nếu chưa có đơn `confirmed`, luồng sẽ dừng ở bước lấy đơn.
- Không nên commit file environment đã điền secret thật.

## 12. Kịch bản test các module khác

Phần collection hiện có đang test sâu luồng vận chuyển. Các module còn lại nên tạo thêm folder trong Postman theo checklist dưới đây. Nên dùng 2 token:

- `user_token`: lấy từ `POST /api/auth/login`.
- `admin_token`: lấy từ `POST /api/auth/admin/login`.

### 12.1. Auth

| Bước | Endpoint | Auth | Kỳ vọng |
| --- | --- | --- | --- |
| Đăng ký khách hàng | `POST /api/auth/register` | Không | Tạo user mới hoặc báo lỗi email/phone trùng. |
| Đăng nhập user | `POST /api/auth/login` | Không | HTTP `200`, có `data.accessToken`; lưu vào `user_token`. |
| Đăng nhập admin | `POST /api/auth/admin/login` | Không | HTTP `200`, có `data.accessToken`; lưu vào `admin_token`. |
| Refresh token | `POST /api/auth/refresh-token` | Cookie/refresh token | Trả access token mới nếu refresh token hợp lệ. |
| Đổi mật khẩu | `POST /api/auth/change-password` | User/Admin | Mật khẩu đổi thành công, token cũ nên được kiểm tra lại. |
| Logout | `POST /api/auth/logout` | Không hoặc có refresh cookie | Xóa refresh token/session phía server. |

Test lỗi nên có:

- Sai password trả `401`.
- User thường gọi `/auth/admin/login` trả lỗi không đủ quyền.
- Password đăng ký dưới 8 ký tự trả `400`.

### 12.2. Locations và GHN tra cứu

| Bước | Endpoint | Auth | Kỳ vọng |
| --- | --- | --- | --- |
| Danh sách tỉnh/thành local | `GET /api/locations/provinces` | Không | Trả danh sách province. |
| Danh sách phường/xã | `GET /api/locations/provinces/:provinceCode/wards` | Không | Trả wards theo province. |
| Tìm địa chỉ | `GET /api/locations/search?q=...` | Không | Trả kết quả phù hợp keyword. |
| Tỉnh GHN | `GET /api/ghn/provinces` | Không | Trả danh sách tỉnh từ GHN hoặc cache. |
| Quận/huyện GHN | `GET /api/ghn/districts?province_id=...` | Không | Trả district theo province. |
| Phường/xã GHN | `GET /api/ghn/wards?district_id=...` | Không | Trả ward theo district. |
| Tính phí GHN | `POST /api/ghn/fee` | User/Admin | Trả phí nếu cấu hình GHN hợp lệ. |

### 12.3. Catalog: Brand, Category, Product

Public catalog:

| Bước | Endpoint | Auth | Kỳ vọng |
| --- | --- | --- | --- |
| List brands | `GET /api/brands` | Không | Trả brand active. |
| List categories | `GET /api/categories` | Không | Trả cây/danh sách category active. |
| Category template | `GET /api/categories/:id/product-template` | Không | Trả template size/fit nếu có. |
| List products | `GET /api/products?page=1&limit=12` | Không | Trả danh sách sản phẩm public. |
| Product filters | `GET /api/products/filters` | Không | Trả bộ lọc catalog. |
| Product detail | `GET /api/products/:id` | Không | Trả chi tiết sản phẩm. |

Admin catalog:

| Bước | Endpoint | Auth | Kỳ vọng |
| --- | --- | --- | --- |
| Quản lý brand | `GET /api/admin/brands/management` | Admin/Staff có `catalog.read` | Trả danh sách có cả trạng thái quản trị. |
| Tạo brand | `POST /api/admin/brands` | `catalog.write` | Tạo brand mới; có thể dùng `multipart/form-data` cho `image`. |
| Cập nhật/xóa brand | `PUT /api/admin/brands/:id`, `DELETE /api/admin/brands/:id` | `catalog.write` | Update hoặc soft delete thành công. |
| Quản lý category | `GET /api/admin/categories/management` | `catalog.read` | Trả category cho admin. |
| Tạo/cập nhật category | `POST /api/admin/categories`, `PUT /api/admin/categories/:id` | `catalog.write` | Validate tên, parent, gender, image. |
| Quản lý product | `GET /api/admin/products` | `products.read` | Trả danh sách sản phẩm admin. |
| Tạo product | `POST /api/admin/products` | `products.write` | Tạo sản phẩm; dùng `multipart/form-data` cho ảnh. |
| Cập nhật/xóa product | `PUT /api/admin/products/:id`, `DELETE /api/admin/products/:id` | `products.write` | Update hoặc soft delete thành công. |

Test lỗi nên có:

- Tạo category trùng tổ hợp `name + parent + gender` trả `409`.
- Tạo/cập nhật image không thuộc host Cloudinary được phép trả `400`.
- Xóa vĩnh viễn category/product còn dependency phải bị chặn.

### 12.4. Cart và Checkout

| Bước | Endpoint | Auth | Kỳ vọng |
| --- | --- | --- | --- |
| Lấy giỏ hàng | `GET /api/cart` | User | Trả cart hiện tại. |
| Thêm sản phẩm | `POST /api/cart/items` | User | Thêm item, tăng quantity hoặc tạo item mới. |
| Sửa quantity/variant | `PUT /api/cart/items/:itemId` | User | Cập nhật item hợp lệ. |
| Chọn item | `PATCH /api/cart/items/:itemId/selected` | User | Cập nhật selected. |
| Chọn tất cả | `PATCH /api/cart/select-all` | User | Tất cả item đổi trạng thái selected. |
| Xóa item | `DELETE /api/cart/items/:itemId` | User | Item biến mất khỏi cart. |
| Preview checkout | `POST /api/orders/preview` | User | Trả tổng tiền, phí ship, giảm giá, tồn kho. |
| Tạo đơn | `POST /api/orders` | User | Tạo order, cart item liên quan được xử lý. |

Data cần lưu vào environment:

- `product_id`, `variant_id`, `variant_detail_id` hoặc dữ liệu tương ứng theo response sản phẩm.
- `cart_item_id`.
- `user_order_id` sau khi tạo đơn.

### 12.5. Customer Orders

| Bước | Endpoint | Auth | Kỳ vọng |
| --- | --- | --- | --- |
| Danh sách đơn của tôi | `GET /api/orders/me` | User | Trả đơn của user đang login. |
| Chi tiết đơn | `GET /api/orders/:id` | User | Chỉ xem được đơn của chính user. |
| Hủy đơn | `PATCH /api/orders/:id/cancel` | User | Hủy được khi trạng thái còn cho phép. |
| Xác nhận đã nhận | `PATCH /api/orders/:id/confirm-received` | User | Đơn chuyển `completed`, có `receivedAt`. |
| Yêu cầu trả hàng | `PATCH /api/orders/:id/request-return` | User | Tạo return request khi đơn đủ điều kiện. |

Test lỗi nên có:

- User A xem đơn User B trả `403`/`404`.
- Hủy đơn đã shipping/delivered phải bị chặn.
- Confirm received trước khi delivered phải bị chặn.

### 12.6. Payments và Payment Methods

Payments:

| Bước | Endpoint | Auth | Kỳ vọng |
| --- | --- | --- | --- |
| Tạo URL VNPay | `POST /api/payments/vnpay/orders/:orderId/create-payment-url` | User | Trả URL thanh toán cho đơn online hợp lệ. |
| Xem trạng thái thanh toán | `GET /api/payments/orders/:orderId/status` | User | Trả `paymentStatus`. |
| VNPay return | `GET /api/payments/vnpay/return?...` | Không | Backend xác thực callback và redirect/response phù hợp. |
| VNPay IPN | `GET /api/payments/vnpay/ipn?...` | Không | Trả kết quả theo chuẩn VNPay. |
| Admin chỉnh payment | `PATCH /api/admin/payments/orders/:orderId/payment-status` | Admin/Staff có `payments.adjust` | Cập nhật trạng thái payment có audit log. |
| Expire stale payment | `POST /api/admin/payments/expire-stale` | `orders.update` | Hết hạn các attempt quá hạn. |

Payment methods:

| Bước | Endpoint | Auth | Kỳ vọng |
| --- | --- | --- | --- |
| List phương thức của tôi | `GET /api/payment-methods` | User | Trả danh sách payment method. |
| Tạo phương thức | `POST /api/payment-methods` | User | Tạo bank/card/wallet theo schema. |
| Cập nhật | `PATCH /api/payment-methods/:id` | User | Update thông tin được phép. |
| Đặt mặc định | `PATCH /api/payment-methods/:id/default` | User | Chỉ một default. |
| Xóa | `DELETE /api/payment-methods/:id` | User | Soft delete hoặc remove theo service. |
| Admin xem payment methods user | `GET /api/admin/users/:userId/payment-methods` | `customers.read` | Trả danh sách của user. |
| Admin đổi trạng thái | `PATCH /api/admin/payment-methods/:id/status` | `customers.manage` | Active/inactive method. |
| Admin reveal account | `POST /api/admin/payment-methods/:id/reveal-account` | `payments.adjust` | Trả số tài khoản đã giải mã nếu được phép. |

### 12.7. Coupons, Promotions, Loyalty

Coupons:

| Bước | Endpoint | Auth | Kỳ vọng |
| --- | --- | --- | --- |
| Coupon khả dụng | `POST /api/coupons/available` | User | Trả mã phù hợp cart/order preview. |
| Validate coupon | `POST /api/coupons/validate` | User | Trả discount hoặc lý do không hợp lệ. |
| Admin list coupon | `GET /api/admin/coupons` | `promotions.read` | Trả danh sách mã. |
| Check code | `GET /api/admin/coupons/check-code?code=...` | `promotions.read` | Trả code còn dùng được hay không. |
| Tạo coupon | `POST /api/admin/coupons` | `promotions.write` | Tạo coupon hợp lệ. |
| Preview coupon | `POST /api/admin/coupons/preview` | `promotions.write` | Xem tác động coupon trước khi lưu. |
| Duplicate/update/status/delete | `/api/admin/coupons/:id...` | `promotions.write` | Thao tác quản trị thành công. |

Promotion campaigns:

| Bước | Endpoint | Auth | Kỳ vọng |
| --- | --- | --- | --- |
| List campaign | `GET /api/admin/promotion-campaigns` | `promotions.read` | Trả danh sách campaign. |
| Tạo campaign | `POST /api/admin/promotion-campaigns` | `promotions.write` | Campaign áp dụng cho product/category hợp lệ. |
| Update/delete campaign | `PUT/DELETE /api/admin/promotion-campaigns/:id` | `promotions.write` | Cập nhật/xóa thành công. |
| Analytics | `GET /api/admin/promotion-analytics` | `promotions.read` | Trả doanh thu, discount, campaign stats. |

Loyalty:

| Bước | Endpoint | Auth | Kỳ vọng |
| --- | --- | --- | --- |
| Membership của tôi | `GET /api/users/me/membership` | User | Trả hạng hiện tại và điểm. |
| List ranking | `GET /api/admin/membership-rankings` | `loyalty.read` | Trả các hạng loyalty. |
| Tạo/sửa/xóa ranking | `POST/PUT/DELETE /api/admin/membership-rankings...` | `loyalty.write` | Validate ngưỡng điểm và thứ tự. |
| Loyalty rules | `GET/POST/PUT/DELETE /api/admin/membership-rankings/rules...` | `loyalty.read/write` | Quản lý rule cộng điểm. |
| Điều chỉnh điểm | `POST /api/admin/membership-rankings/point-adjustments` | `loyalty.write` | Điểm user thay đổi, có lịch sử. |
| Lịch sử điểm | `GET /api/admin/membership-rankings/point-history` | `loyalty.read` | Trả lịch sử theo filter. |

### 12.8. Reviews

| Bước | Endpoint | Auth | Kỳ vọng |
| --- | --- | --- | --- |
| Review public của product | `GET /api/reviews/products/:productId` | Không | Trả review đã duyệt. |
| Kiểm tra đủ điều kiện | `GET /api/reviews/eligibility?productId=...&orderId=...&orderItemId=...` | User | Chỉ eligible nếu đã mua và đơn completed/paid. |
| List item có thể review | `GET /api/reviews/eligible-items` | User | Trả order items đủ điều kiện. |
| Review của tôi | `GET /api/reviews/me` | User | Trả review user đã tạo. |
| Tạo review | `POST /api/reviews` | User | Tạo review, có thể upload tối đa 5 ảnh. |
| Helpful vote | `POST /api/reviews/:id/helpful` | User | Toggle vote. |
| Update/delete review | `PATCH/DELETE /api/reviews/:id` | User | Chỉ owner thao tác được. |
| Admin list/detail | `GET /api/admin/reviews`, `GET /api/admin/reviews/:id` | `reviews.read` | Trả review quản trị. |
| Moderation | `PATCH /api/admin/reviews/:id/status`, `PATCH /api/admin/reviews/bulk-status` | `reviews.moderate` | Duyệt/từ chối nhiều review. |
| Reply | `PUT /api/admin/reviews/:id/reply` | `reviews.reply` | Admin phản hồi review. |

### 12.9. Users, Customers, Staff Accounts

Customer profile:

| Bước | Endpoint | Auth | Kỳ vọng |
| --- | --- | --- | --- |
| Profile của tôi | `GET /api/users/me` | User | Trả thông tin user. |
| Cập nhật profile | `PUT /api/users/me` | User | Update tên, phone, ngày sinh, giới tính... |
| Upload avatar | `POST /api/users/me/avatar` | User | Avatar cập nhật. |
| List địa chỉ | `GET /api/users/me/addresses` | User | Trả danh sách địa chỉ. |
| Thêm/sửa/xóa địa chỉ | `POST/PUT/DELETE /api/users/me/addresses...` | User | Validate địa chỉ và GHN mapping nếu có. |
| Đặt địa chỉ mặc định | `PATCH /api/users/me/addresses/:addressId/default` | User | Chỉ một địa chỉ default. |

Admin customers:

| Bước | Endpoint | Auth | Kỳ vọng |
| --- | --- | --- | --- |
| List customer | `GET /api/admin/users` | `customers.read` | Trả danh sách/filter user. |
| Detail customer | `GET /api/admin/users/:id` | `customers.read` | Trả chi tiết. |
| Khóa/mở tài khoản | `PATCH /api/admin/users/:id/status` | `customers.manage` | Cập nhật `isActive`. |
| Đổi role | `PATCH /api/admin/users/:id/role` | Admin only | Role đổi đúng, không làm mất admin cuối nếu service chặn. |
| Force reset password | `POST /api/admin/users/:id/force-password-reset` | `customers.manage` | Reset session/password flow. |

Staff accounts:

| Bước | Endpoint | Auth | Kỳ vọng |
| --- | --- | --- | --- |
| List account | `GET /api/admin/accounts` | Admin only | Trả admin/staff accounts. |
| Tạo staff | `POST /api/admin/accounts/staff` | Admin only | Tạo staff với permissions. |
| Đổi status | `PATCH /api/admin/accounts/:id/status` | Admin only | Active/inactive staff. |
| Đổi permissions | `PATCH /api/admin/accounts/:id/permissions` | Admin only | Permission mới áp dụng sau login lại nếu cần. |
| Reset password staff | `POST /api/admin/accounts/:id/reset-password` | Admin only | Trả/ghi nhận temporary password theo service. |

### 12.10. Inventory

| Bước | Endpoint | Auth | Kỳ vọng |
| --- | --- | --- | --- |
| List tồn kho | `GET /api/admin/inventory` | `inventory.read` | Trả inventory theo product/variant/size. |
| Low stock | `GET /api/admin/inventory/low-stock` | `inventory.read` | Trả dòng sắp hết hàng. |
| List phiếu nhập | `GET /api/admin/inventory/imports` | `inventory.read` | Trả import history. |
| Tạo phiếu nhập | `POST /api/admin/inventory/imports` | `inventory.write` | Tăng tồn kho đúng số lượng. |
| Detail/xóa phiếu nhập | `GET/DELETE /api/admin/inventory/imports/:id` | `inventory.read/write` | Đọc hoặc rollback/xóa theo rule. |
| Điều chỉnh tồn | `PATCH /api/admin/inventory/:id/adjust` | `inventory.write` | Tồn kho thay đổi có reason. |
| Reserve/release/commit/expire | `POST /api/admin/inventory/reserve`, `/release`, `/commit`, `/expire` | `inventory.write` | Reservation thay đổi đúng vòng đời. |

### 12.11. Support và Notifications

Customer support:

| Bước | Endpoint | Auth | Kỳ vọng |
| --- | --- | --- | --- |
| Public FAQ | `GET /api/support/faqs` | Không | Trả FAQ published. |
| Vote FAQ | `POST /api/support/faqs/:id/vote` | User | Ghi nhận vote. |
| Guest feedback | `POST /api/support/guest-feedback` | Không | Tạo feedback, có rate limit. |
| Ticket của tôi | `GET /api/support/tickets` | User | Trả ticket của user. |
| Tạo ticket | `POST /api/support/tickets` | User | Tạo ticket, upload tối đa 3 attachments. |
| Nhắn tin ticket | `POST /api/support/tickets/:id/messages` | User | Thêm message. |
| Read/reopen/close | `PATCH /api/support/tickets/:id/read`, `/reopen`, `/close` | User | Đổi trạng thái ticket. |
| Summary | `GET /api/support/summary` | User | Trả số ticket/chưa đọc. |
| Push token | `POST/DELETE /api/support/push-token` | User | Đăng ký/hủy push token. |

Admin support:

| Bước | Endpoint | Auth | Kỳ vọng |
| --- | --- | --- | --- |
| Summary/tickets | `GET /api/admin/support/summary`, `/tickets` | `support.reply` | Trả hàng đợi hỗ trợ. |
| Reply ticket | `POST /api/admin/support/tickets/:id/messages` | `support.reply` | Admin gửi phản hồi. |
| Update/read ticket | `PATCH /api/admin/support/tickets/:id`, `/read` | `support.reply` | Cập nhật trạng thái/đã đọc. |
| Analytics | `GET /api/admin/support/analytics` | `support.manage` | Trả thống kê support. |
| Canned responses | `GET/POST/PATCH/DELETE /api/admin/support/canned-responses...` | `support.manage` | CRUD mẫu trả lời. |
| FAQs | `GET/POST/PATCH/DELETE /api/admin/support/faqs...` | `support.manage` | CRUD FAQ và reorder. |

Notifications:

| Bước | Endpoint | Auth | Kỳ vọng |
| --- | --- | --- | --- |
| Customer notification summary | `GET /api/notifications/summary` | User | Trả badge/count thông báo của user. |
| Admin notification summary | `GET /api/admin/notifications/summary` | Admin/Staff | Trả badge/count cho admin nếu route summary đang bật. |

### 12.12. Audit Logs

| Bước | Endpoint | Auth | Kỳ vọng |
| --- | --- | --- | --- |
| List audit logs | `GET /api/admin/audit-logs` | Admin/Staff có `audit.read` | Trả log thao tác như order status, shipping, payment adjust. |

Nên chạy sau khi đã thực hiện các thao tác admin như đổi trạng thái đơn, update shipping, chỉnh payment hoặc reveal payment method để kiểm tra log được ghi đúng.

### 12.13. Thứ tự tạo collection Postman đầy đủ

Thứ tự folder đề xuất:

1. `00 - Auth`: login user/admin, lưu token.
2. `01 - Public Catalog`: locations, brands, categories, products, reviews public.
3. `02 - Customer Profile`: profile, addresses, payment methods.
4. `03 - Cart Checkout`: cart, preview order, create order.
5. `04 - Customer Orders`: list/detail/cancel/confirm/return.
6. `05 - Payments`: VNPay URL, payment status, admin adjust.
7. `06 - Shipping`: dùng collection hiện có.
8. `07 - Promotions Loyalty`: coupon, campaign, loyalty.
9. `08 - Reviews`: create/update/moderate/reply.
10. `09 - Support Notifications`: ticket, FAQ, push token, summaries.
11. `10 - Admin Catalog Inventory`: CRUD catalog và tồn kho.
12. `11 - Admin Users Accounts`: customer/staff/permissions.
13. `12 - Audit Logs`: kiểm tra log sau các thao tác nhạy cảm.

## 13. Kết luận

Collection Postman hiện tại phù hợp để kiểm thử end-to-end luồng xử lý đơn hàng sau khi đơn đã được tạo: đăng nhập admin, lấy đơn, chuẩn bị thanh toán, đóng gói, cập nhật vận chuyển, giả lập webhook và hoàn tất đơn.

Để test đầy đủ hơn toàn ứng dụng, nên bổ sung thêm collection riêng cho:

- Auth khách hàng: đăng ký, đăng nhập, refresh token, đổi mật khẩu.
- Catalog: brands, categories, products.
- Cart và checkout: thêm giỏ hàng, preview order, tạo order.
- Payment methods và VNPay.
- Coupon, promotion, loyalty.
- Review, support ticket, notifications.
- Admin CRUD: sản phẩm, danh mục, tồn kho, khách hàng, nhân viên.
