# Thiết kế database

## 1. Tổng quan

Database sử dụng MongoDB, vì vậy các thực thể chính được tổ chức dưới dạng collection. Dữ liệu được thiết kế để phục vụ hệ thống thương mại điện tử bán hàng thời trang gồm web, mobile app, trang quản trị và các tính năng Machine Learning.

Các collection chính:

- `User`
- `Membership Ranking`
- `Category`
- `Brand`
- `Product`
- `Import`
- `Cart`
- `Favorites`
- `Order`
- `Transaction`
- `Reviews`
- `Feedback`
- `Virtual Try on Room`
- `Coupon`
- `User Coupon`
- `Home Banner`
- `Search History`
- `Product Interaction`
- `Return Request`
- `Payment Method`
- `FAQ`
- `Notification`
- `Flash Sale`
- `Audit Log`
- `System Setting`

## 2. Collection User

Lưu thông tin tài khoản khách hàng, nhân viên và quản trị viên.

| Field | Kiểu dữ liệu | Ràng buộc / mô tả |
|---|---|---|
| `_id` | ObjectId | Required |
| `name` | String | Required |
| `email` | String | Required, unique |
| `password` | String | Required |
| `role` | String | Required, enum: `admin`, `staff`, `user`, default: `user` |
| `phone` | String | Required |
| `gender` | String | Required, enum: `male`, `female` |
| `dateOfBirth` | Date | Required |
| `address` | Array\<Object\> | Required |
| `address.customerName` | String | Required |
| `address.province` | String | Required |
| `address.district` | String | Required |
| `address.ward` | String | Required |
| `address.streetName` | String | Required |
| `address.phoneNumber` | String | Required |
| `address.isDefault` | Boolean | Default: `false` |
| `membership` | ObjectId | Reference: `Membership Ranking` |
| `loyaltyPoint` | Number | Default: `0`, điểm tích lũy từ đơn hàng đã hoàn thành |
| `membershipUpdatedAt` | Date | Default: `null`, thời điểm cập nhật hạng gần nhất |
| `refreshToken` | String | Default: `null` |
| `authProviders` | Array\<Object\> | Default: `[]`, danh sách provider đăng nhập mạng xã hội |
| `authProviders.provider` | String | Enum: `google`, `facebook`, `apple` |
| `authProviders.providerId` | String | Id người dùng từ provider |
| `resetPasswordToken` | String | Default: `null`, nên lưu dạng hash |
| `resetPasswordExpires` | Date | Default: `null` |
| `avatarImage` | String | Default: `null` |
| `isActive` | Boolean | Default: `false`; set thành `true` ngay khi đăng ký thành công, không yêu cầu xác thực email |
| `createdAt` | Date | Ngày tạo |
| `updatedAt` | Date | Ngày cập nhật |

## 3. Collection Membership Ranking

Lưu hạng thành viên, ngưỡng điểm tích lũy và mức giảm giá tương ứng.

| Field | Kiểu dữ liệu | Ràng buộc / mô tả |
|---|---|---|
| `_id` | ObjectId | Required |
| `name` | String | Required |
| `level` | Number | Required, thứ tự hạng |
| `minPoint` | Number | Required, điểm tối thiểu để đạt hạng |
| `maxPoint` | Number | Default: `null`, điểm tối đa của hạng; `null` nghĩa là không giới hạn |
| `discountPercent` | Number | Required |
| `benefitDescription` | String | Mô tả quyền lợi, ví dụ giảm giá hoặc đổi voucher |
| `cardColor` | String | Default: `#5b788a`, màu nền thẻ hạng trên app khách hàng |
| `textColor` | String | Default: `#ffffff`, màu chữ hiển thị trên thẻ hạng |
| `badgeColor` | String | Default: `#5b788a`, màu badge/nhãn hạng |
| `iconName` | String | Default: `star`, tên icon MaterialCommunityIcons dùng cho hạng |
| `isActive` | Boolean | Default: `true` |
| `createdAt` | Date | Ngày tạo |
| `updatedAt` | Date | Ngày cập nhật |

## 4. Collection Category

Lưu danh mục sản phẩm. Category có thể phân cấp bằng `parent_id`.

| Field | Kiểu dữ liệu | Ràng buộc / mô tả |
|---|---|---|
| `_id` | ObjectId | Required |
| `name` | String | Required, trim |
| `parent_id` | ObjectId | Reference: `Category` |
| `level` | Number | Required |
| `gender` | String | Required, enum: `male`, `female` |
| `image` | String | Required |
| `bannerImage` | String | Default: `null`, URL ảnh banner rộng cho trang danh mục |
| `description` | String | Required |
| `isActive` | Boolean | Default: `false` |
| `createdAt` | Date | Ngày tạo |
| `updatedAt` | Date | Ngày cập nhật |

## 5. Collection Brand

Lưu thông tin thương hiệu sản phẩm.

| Field | Kiểu dữ liệu | Ràng buộc / mô tả |
|---|---|---|
| `_id` | ObjectId | Required |
| `name` | String | Required, trim, match |
| `image` | String | Required |
| `isActive` | Boolean | Default: `true` |
| `createdAt` | Date | Ngày tạo |
| `updatedAt` | Date | Ngày cập nhật |

## 6. Collection Product

Lưu thông tin sản phẩm, biến thể sản phẩm, thông tin size, hình ảnh, giá bán và dữ liệu phục vụ tìm kiếm bằng hình ảnh.

| Field | Kiểu dữ liệu | Ràng buộc / mô tả |
|---|---|---|
| `_id` | ObjectId | Required |
| `category_id` | ObjectId | Reference: `Category`, required |
| `name` | String | Required |
| `brand_id` | ObjectId | Reference: `Brand`, required |
| `version` | Array\<Object\> | Danh sách biến thể sản phẩm |
| `version._id` | ObjectId | Required |
| `version.sku` | String | Required, unique theo biến thể |
| `version.color` | String | Required |
| `version.fitType` | String | Required |
| `version.size_spec` | Array\<Object\> | Required |
| `version.size_spec.size` | String | Required |
| `version.size_spec.shoulder` | Number | Required |
| `version.size_spec.chest` | Number | Required |
| `version.size_spec.length` | Number | Required |
| `version.size_spec.weight` | Number | Required |
| `version.size_spec.stock_quantity` | Number | Tồn kho khả dụng (denormalized từ bảng Import) |
| `version.version_image` | String | Required |
| `version.image_embedding` | Array\<Number\> | Vector đặc trưng (Dùng MongoDB Atlas Vector Search) |
| `version.price` | Number | Required |
| `version.discount` | Number | Required |
| `version.isAvailable` | Boolean | Trạng thái còn hàng |
| `version.import` | Array\<ObjectId\> | Reference: `Import` |
| `description` | String | Required |
| `product_image` | String | Required |
| `isActive` | Boolean | Default: `true` |
| `sold_quantity` | Number | Default: `0` |
| `averageRating` | Number | Default: `0`, min: `0`, max: `5` |
| `reviewCount` | Number | Default: `0` |
| `createdAt` | Date | Ngày tạo |
| `updatedAt` | Date | Ngày cập nhật |

## 7. Collection Import

Lưu thông tin nhập kho theo sản phẩm, biến thể và size.

| Field | Kiểu dữ liệu | Ràng buộc / mô tả |
|---|---|---|
| `_id` | String | Required, trim, match |
| `productId` | ObjectId | Reference: `Product`, required |
| `versionId` | ObjectId | Reference: `Product.version`, required |
| `detail` | Array\<Object\> | Required |
| `detail.size` | String | Required |
| `detail.quantity` | Number | Required |
| `detail.remaining_quantity` | Number | Required |
| `remaining_quantity` | Number | Required |
| `createdAt` | Date | Ngày tạo |
| `updatedAt` | Date | Ngày cập nhật |

## 8. Collection Cart

Lưu giỏ hàng của người dùng đã đăng nhập.

Ghi chú: Khách chưa đăng nhập sẽ lưu giỏ hàng tạm ở `localStorage` trên frontend. Khi đăng nhập, frontend gọi API để đồng bộ giỏ hàng tạm lên database. Collection này chỉ phục vụ người dùng đã đăng nhập, `user_id` là bắt buộc.

| Field | Kiểu dữ liệu | Ràng buộc / mô tả |
|---|---|---|
| `_id` | ObjectId | Required |
| `user_id` | ObjectId | Reference: `User`, required |
| `product_list` | Array\<Object\> | Required, default: `[]` |
| `product_list._id` | ObjectId | Mã dòng sản phẩm trong giỏ hàng, dùng để cập nhật/xóa/chọn item |
| `product_list.product_id` | ObjectId | Reference: `Product`, required |
| `product_list.version_id` | ObjectId | Reference: `Product.version`, required |
| `product_list.size` | String | Required |
| `product_list.quantity` | Number | Min: `1`, default: `1`, required |
| `product_list.priceAtAddedTime` | Number | Giá tại thời điểm thêm vào giỏ hàng, required |
| `product_list.isSelected` | Boolean | Default: `true`, đánh dấu item đang được chọn để thanh toán |
| `createdAt` | Date | Ngày tạo |
| `updatedAt` | Date | Ngày cập nhật |

## 9. Collection Favorites

Lưu danh sách sản phẩm yêu thích của người dùng.

| Field | Kiểu dữ liệu | Ràng buộc / mô tả |
|---|---|---|
| `_id` | ObjectId | Required |
| `user_id` | ObjectId | Reference: `User`, required |
| `product_id` | ObjectId | Reference: `Product`, required |
| `createdAt` | Date | Ngày tạo |
| `updatedAt` | Date | Ngày cập nhật |

Ghi chú truy vấn:

- Màn danh sách yêu thích có thể lọc/sắp xếp bằng cách populate sang `Product`, không cần tạo collection mới.
- `createdAt` dùng để sắp xếp sản phẩm mới được yêu thích gần đây nhất.
- Nên tạo index `{ user_id: 1, createdAt: -1 }` để lấy danh sách yêu thích theo người dùng nhanh hơn.

## 10. Collection Order

Lưu thông tin đơn hàng, danh sách sản phẩm đã mua, phí vận chuyển, tổng tiền, trạng thái đơn hàng và địa chỉ giao hàng.

| Field | Kiểu dữ liệu | Ràng buộc / mô tả |
|---|---|---|
| `_id` | ObjectId | Required |
| `orderCode` | String | Required, unique, mã đơn hàng hiển thị cho người dùng |
| `invoiceCode` | String | Default: `null`, mã hóa đơn |
| `user_id` | ObjectId | Reference: `User`, required |
| `order_list` | Array\<Object\> | Required |
| `order_list.product_id` | ObjectId | Reference: `Product`, required |
| `order_list.version_id` | ObjectId | Reference: `Product.version`, required |
| `order_list.size` | String | Required |
| `order_list.name` | String | Required, snapshot tên sản phẩm tại thời điểm đặt hàng |
| `order_list.sku` | String | Snapshot SKU biến thể tại thời điểm đặt hàng |
| `order_list.color` | String | Snapshot màu sắc biến thể tại thời điểm đặt hàng |
| `order_list.image` | String | Snapshot URL ảnh biến thể tại thời điểm đặt hàng |
| `order_list.quantity` | Number | Min: `1`, default: `1` |
| `order_list.priceAtPurchased` | Number | Min: `1`, default: `1` |
| `subTotal` | Number | Required, tổng tiền hàng trước giảm giá và phí vận chuyển |
| `shippingFee` | Number | Required, tự động tính qua API GHN/GHTK hoặc theo bảng giá cố định |
| `couponCode` | String | Default: `null` |
| `couponId` | ObjectId | Reference: `Coupon`, default: `null` |
| `userCouponId` | ObjectId | Reference: `User Coupon`, default: `null` |
| `couponDiscountAmount` | Number | Default: `0` |
| `shippingDiscountAmount` | Number | Default: `0` |
| `membershipDiscountAmount` | Number | Default: `0` |
| `taxAmount` | Number | Default: `0` |
| `totalAmount` | Number | Required, số tiền cuối cùng cần thanh toán |
| `status` | String | Enum: `confirmed`, `packed`, `shipping`, `delivered`, `cancelled`, `return_requested`, `returned`; default: `confirmed` |
| `tracking` | Array\<Object\> | Timeline trạng thái đơn hàng |
| `tracking.status` | String | Enum giống `status` |
| `tracking.title` | String | Tiêu đề hiển thị, ví dụ `Đã xác nhận` |
| `tracking.description` | String | Default: `null` |
| `tracking.time` | Date | Thời điểm cập nhật |
| `paymentMethod` | String | Enum: `COD`, `VNPAY`, `MOMO`, `CARD`, `BANK`; default: `COD` |
| `paymentMethodId` | ObjectId | Reference: `Payment Method`, default: `null` |
| `paymentStatus` | String | Enum: `pending`, `paid`, `failed`, `refunded`; default: `pending` |
| `shipping` | Object | |
| `shipping.provider` | String | Enum: `GHN`, `GHTK`, `VIETTEL_POST` |
| `shipping.trackingCode` | String | Mã vận đơn |
| `shipping.shippingLabel` | String | Default: `null`, URL tem dán kiện hàng / mã vạch mã vận đơn |
| `shipping.estimatedDeliveryDate` | Date | |
| `shippingAddress` | Object | Required |
| `shippingAddress.customerName` | String | Required |
| `shippingAddress.province` | String | Required |
| `shippingAddress.district` | String | Required |
| `shippingAddress.ward` | String | Required |
| `shippingAddress.streetName` | String | Required |
| `shippingAddress.phoneNumber` | String | Required |
| `orderNote` | String | Default: `null` |
| `deliveredAt` | Date | Default: `null` |
| `cancelledAt` | Date | Default: `null` |
| `cancelReason` | String | Default: `null` |
| `createdAt` | Date | Ngày tạo |
| `updatedAt` | Date | Ngày cập nhật |

## 11. Collection Transaction

Lưu thông tin giao dịch thanh toán của đơn hàng.

| Field | Kiểu dữ liệu | Ràng buộc / mô tả |
|---|---|---|
| `_id` | ObjectId | Required |
| `user_id` | ObjectId | Reference: `User`, required |
| `order_id` | ObjectId | Reference: `Order`, required |
| `amount` | Number | Required |
| `paymentMethod` | String | Required, enum: `COD`, `VNPAY`, `MOMO`, `CARD`, `BANK` |
| `paymentMethodId` | ObjectId | Reference: `Payment Method`, default: `null` |
| `gatewayTransactionId` | String | Default: `null` |
| `gatewayProvider` | String | Default: `null`, ví dụ `vnpay`, `momo`, `stripe` |
| `paymentDetail` | Object | Default: `{}` |
| `status` | String | Required, enum: `pending`, `success`, `failed`; default: `pending` |
| `createdAt` | Date | Ngày tạo |
| `updatedAt` | Date | Ngày cập nhật |

## 12. Collection Reviews

Lưu đánh giá và bình luận của người dùng về sản phẩm.

| Field | Kiểu dữ liệu | Ràng buộc / mô tả |
|---|---|---|
| `_id` | ObjectId | Required |
| `user_id` | ObjectId | Reference: `User`, required |
| `orderId` | ObjectId | Reference: `Order`, required |
| `product_id` | ObjectId | Reference: `Product`, required |
| `version_id` | ObjectId | Reference: `Product.version`, required |
| `size` | String | Required |
| `rating` | Number | Required, min: `1`, max: `5` |
| `criteriaRatings` | Object | Điểm đánh giá chi tiết theo tiêu chí |
| `criteriaRatings.fabricQuality` | Number | Chất lượng vải, min: `1`, max: `5` |
| `criteriaRatings.descriptionMatch` | Number | Đúng với mô tả, min: `1`, max: `5` |
| `criteriaRatings.fit` | Number | Form áo chuẩn, min: `1`, max: `5` |
| `criteriaRatings.colorDurability` | Number | Độ bền màu, min: `1`, max: `5` |
| `content` | String | Trim |
| `images` | Array\<String\> | Default: `[]`, URL ảnh đánh giá |
| `adminReply` | Object | Default: `null`, phản hồi của cửa hàng |
| `adminReply.userId` | ObjectId | Reference: `User`, nhân viên/quản trị viên phản hồi |
| `adminReply.content` | String | Nội dung phản hồi |
| `adminReply.createdAt` | Date | Thời điểm phản hồi |
| `isVerifiedPurchase` | Boolean | Required, default: `false` |
| `status` | String | Enum: `visible`, `hidden`; default: `visible` |
| `createdAt` | Date | Ngày tạo |
| `updatedAt` | Date | Ngày cập nhật |

## 13. Collection Feedback

Lưu phản hồi, khiếu nại hoặc yêu cầu hỗ trợ của người dùng.

| Field | Kiểu dữ liệu | Ràng buộc / mô tả |
|---|---|---|
| `_id` | ObjectId | Required |
| `userId` | ObjectId | Required |
| `orderId` | ObjectId | Reference: `Order`, default: `null`, dùng khi phản hồi liên quan đơn hàng |
| `name` | String | Required |
| `email` | String | Required |
| `category` | String | Enum: `order`, `shipping`, `return`, `payment`, `account`, `membership`, `other`; default: `other` |
| `subject` | String | Default: "Yêu cầu hỗ trợ", Tiêu đề phản hồi |
| `message` | String | Required |
| `status` | String | Enum: `new`, `read`, `replied`, `closed`; default: `new` |
| `adminReply` | String | Default: `null`, required khi `status` là `replied` hoặc `closed` |
| `createdAt` | Date | Ngày tạo |
| `updatedAt` | Date | Ngày cập nhật |

## 14. Collection Virtual Try on Room

Lưu lịch sử phòng phối đồ ảo của người dùng.

| Field | Kiểu dữ liệu | Ràng buộc / mô tả |
|---|---|---|
| `_id` | ObjectId | Required |
| `userId` | ObjectId | Required |
| `productId` | Array\<ObjectId\> | Reference: `Product`, required |
| `versionId` | Array\<ObjectId\> | Reference: `Product.version`, required |
| `userImage` | Array\<String\> | Required, URL ảnh người dùng |
| `generatedImage` | String | Required |
| `createdAt` | Date | Ngày tạo |
| `updatedAt` | Date | Ngày cập nhật |


## 15. Collection Coupon

Lưu mã giảm giá dùng trong giỏ hàng và thanh toán.

| Field | Kiểu dữ liệu | Ràng buộc / mô tả |
|---|---|---|
| `_id` | ObjectId | Required |
| `code` | String | Required, unique, uppercase, trim |
| `name` | String | Required |
| `description` | String | Default: `null` |
| `discountType` | String | Required, enum: `percent`, `fixed`, `free_shipping` |
| `discountValue` | Number | Required |
| `maxDiscountAmount` | Number | Default: `null`, dùng khi `discountType` là `percent` |
| `minOrderAmount` | Number | Default: `0` |
| `usageLimit` | Number | Default: `null` |
| `usedCount` | Number | Default: `0` |
| `perUserLimit` | Number | Default: `1`, số lần một người dùng được dùng coupon |
| `isPublic` | Boolean | Default: `true`, voucher có tự hiển thị cho mọi người dùng phù hợp hay không |
| `eligibleUserTypes` | Array\<String\> | Default: `['all']`, enum: `all`, `new_user`, `member` |
| `eligibleMembershipRanks` | Array\<ObjectId\> | Reference: `Membership Ranking`, default: `[]`, neu co gia tri thi duoc kiem tra doc lap voi `eligibleUserTypes` |
| `applicableProducts` | Array\<ObjectId\> | Reference: `Product`, default: `[]` |
| `applicableCategories` | Array\<ObjectId\> | Reference: `Category`, default: `[]` |
| `startAt` | Date | Ngày bắt đầu hiệu lực |
| `endAt` | Date | Ngày hết hiệu lực |
| `isActive` | Boolean | Default: `true` |
| `createdAt` | Date | Ngày tạo |
| `updatedAt` | Date | Ngày cập nhật |

### 15.1 Collection User Coupon

Lưu trạng thái voucher theo từng người dùng, phục vụ màn `Voucher của bạn` và kiểm soát việc sử dụng voucher.

| Field | Kiểu dữ liệu | Ràng buộc / mô tả |
|---|---|---|
| `_id` | ObjectId | Required |
| `userId` | ObjectId | Reference: `User`, required |
| `couponId` | ObjectId | Reference: `Coupon`, required |
| `status` | String | Enum: `available`, `used`, `expired`, `disabled`; default: `available` |
| `assignedAt` | Date | Thời điểm voucher được gán/lưu vào tài khoản |
| `usedAt` | Date | Default: `null`, thời điểm sử dụng |
| `orderId` | ObjectId | Reference: `Order`, default: `null`, đơn hàng đã dùng voucher |
| `createdAt` | Date | Ngày tạo |
| `updatedAt` | Date | Ngày cập nhật |

## 16. Collection Home Banner

Lưu banner và các khu quảng bá trên trang chủ như banner bộ sưu tập mới, banner phòng thử đồ và banner tìm kiếm bằng hình ảnh.

| Field | Kiểu dữ liệu | Ràng buộc / mô tả |
|---|---|---|
| `_id` | ObjectId | Required |
| `title` | String | Required |
| `subtitle` | String | Default: `null` |
| `description` | String | Default: `null` |
| `image` | String | Required, URL ảnh banner |
| `position` | String | Required, enum: `home_hero`, `virtual_try_on`, `image_search`, `home_promotion` |
| `ctaText` | String | Default: `null` |
| `ctaLink` | String | Default: `null` |
| `displayOrder` | Number | Default: `0` |
| `isActive` | Boolean | Default: `true` |
| `startAt` | Date | Default: `null` |
| `endAt` | Date | Default: `null` |
| `createdAt` | Date | Ngày tạo |
| `updatedAt` | Date | Ngày cập nhật |

## 17. Collection Search History

Lưu lịch sử tìm kiếm bằng từ khóa và hình ảnh, phục vụ thống kê và cải thiện gợi ý sản phẩm.

| Field | Kiểu dữ liệu | Ràng buộc / mô tả |
|---|---|---|
| `_id` | ObjectId | Required |
| `userId` | ObjectId | Reference: `User`, default: `null` |
| `sessionId` | String | Default: `null`, dùng cho khách chưa đăng nhập |
| `searchType` | String | Required, enum: `keyword`, `image` |
| `keyword` | String | Default: `null`, dùng khi tìm kiếm bằng từ khóa |
| `imageUrl` | String | Default: `null`, dùng khi tìm kiếm bằng hình ảnh |
| `resultProducts` | Array\<Object\> | Default: `[]` |
| `resultProducts.productId` | ObjectId | Reference: `Product` |
| `resultProducts.versionId` | ObjectId | Reference: `Product.version` |
| `resultProducts.score` | Number | Điểm tương đồng hoặc điểm xếp hạng |
| `createdAt` | Date | Ngày tạo |

## 18. Collection Product Interaction

Lưu hành vi của người dùng với sản phẩm để phục vụ thống kê, bán chạy và gợi ý sản phẩm.

| Field | Kiểu dữ liệu | Ràng buộc / mô tả |
|---|---|---|
| `_id` | ObjectId | Required |
| `userId` | ObjectId | Reference: `User`, default: `null` |
| `sessionId` | String | Default: `null`, dùng cho khách chưa đăng nhập |
| `productId` | ObjectId | Reference: `Product`, required |
| `versionId` | ObjectId | Reference: `Product.version`, default: `null` |
| `action` | String | Required, enum: `view`, `click`, `favorite`, `add_to_cart`, `purchase`, `search_result_click`, `recommendation_click`, `try_on` |
| `source` | String | Enum: `home`, `category`, `search`, `image_search`, `detail`, `recommendation`, `virtual_try_on` |
| `metadata` | Object | Default: `{}` |
| `createdAt` | Date | Ngày tạo |

## 19. Collection Return Request

Lưu yêu cầu trả hàng/hoàn tiền của người dùng sau khi đặt hàng.

| Field | Kiểu dữ liệu | Ràng buộc / mô tả |
|---|---|---|
| `_id` | ObjectId | Required |
| `orderId` | ObjectId | Reference: `Order`, required |
| `userId` | ObjectId | Reference: `User`, required |
| `items` | Array\<Object\> | Danh sách sản phẩm yêu cầu trả |
| `items.productId` | ObjectId | Reference: `Product`, required |
| `items.versionId` | ObjectId | Reference: `Product.version`, required |
| `items.size` | String | Required |
| `items.quantity` | Number | Required |
| `reason` | String | Required |
| `images` | Array\<String\> | Default: `[]`, ảnh minh chứng |
| `status` | String | Enum: `pending`, `approved`, `rejected`, `refunded`; default: `pending` |
| `adminNote` | String | Default: `null` |
| `processedBy` | ObjectId | Reference: `User`, nhân viên/quản trị viên xử lý; default: `null` |
| `processedAt` | Date | Thời điểm duyệt/từ chối/hoàn tiền; default: `null` |
| `refundTransactionId` | ObjectId | Reference: `Transaction`, giao dịch hoàn tiền nếu có; default: `null` |
| `returnShippingCode` | String | Default: `null`, mã vận chuyển chiều trả hàng nếu có |
| `createdAt` | Date | Ngày tạo |
| `updatedAt` | Date | Ngày cập nhật |

## 20. Collection Payment Method

Lưu phương thức thanh toán đã lưu của người dùng nếu hệ thống cho quản lý ví/thẻ/tài khoản thanh toán.

| Field | Kiểu dữ liệu | Ràng buộc / mô tả |
|---|---|---|
| `_id` | ObjectId | Required |
| `userId` | ObjectId | Reference: `User`, required |
| `type` | String | Enum: `MOMO`, `VNPAY`, `BANK`, `CARD` |
| `provider` | String | Nhà cung cấp (VD: `Visa`, `MasterCard`, `Momo`) |
| `displayName` | String | Tên hiển thị (VD: `Ví Momo`, `Thẻ Visa ****1234`) |
| `maskedInfo` | String | Thông tin bị che (VD: `******1234`, `09****123`) |
| `isDefault` | Boolean | Default: `false` |
| `status` | String | Enum: `active`, `inactive`; default: `active` |
| `cardBrand` | String | Default: `null`, dùng khi type là CARD |
| `last4` | String | Default: `null`, 4 số cuối của thẻ |
| `expiryMonth` | String | Default: `null`, tháng hết hạn thẻ |
| `expiryYear` | String | Default: `null`, năm hết hạn thẻ |
| `updatedAt` | Date | Ngày cập nhật |

Lưu ý: không lưu số thẻ đầy đủ, CVV, OTP, mật khẩu ví/ngân hàng hoặc dữ liệu nhạy cảm trong collection này. COD không cần lưu trong `Payment Method` vì không có token liên kết.

## 21. Collection FAQ

Lưu danh sách câu hỏi thường gặp phục vụ màn hình hỗ trợ khách hàng.

| Field | Kiểu dữ liệu | Ràng buộc / mô tả |
|---|---|---|
| `_id` | ObjectId | Required |
| `question` | String | Required, trim |
| `answer` | String | Required, trim |
| `category` | String | Enum: `order`, `shipping`, `return`, `membership`, `other`; default: `other` |
| `displayOrder` | Number | Default: `0`, dùng để sắp xếp thứ tự hiển thị |
| `isActive` | Boolean | Default: `true` |
| `createdAt` | Date | Ngày tạo |
| `updatedAt` | Date | Ngày cập nhật |

## 22. Collection Notification

Lưu trữ thông báo trong ứng dụng (In-app Notifications) cho người dùng. Khách hàng nhấn vào biểu tượng "Quả chuông 🔔" để đọc lại các thông báo cũ.

| Field | Kiểu dữ liệu | Ràng buộc / mô tả |
|---|---|---|
| `_id` | ObjectId | Required |
| `userId` | ObjectId | Reference: `User`, required |
| `title` | String | Required |
| `content` | String | Required |
| `type` | String | Enum: `order`, `promotion`, `system`; default: `system` |
| `isRead` | Boolean | Default: `false` |
| `status` | String | Enum: `active`, `inactive`; default: `active` |
| `metadata` | Object | Dữ liệu kèm theo (ví dụ: `orderId`, `couponId`, `url`) |
| `createdAt` | Date | Ngày tạo |
| `updatedAt` | Date | Ngày cập nhật |

## 23. Collection Flash Sale

Lưu trữ thông báo chương trình Flash Sale (giờ vàng giá sốc) và danh sách sản phẩm giới hạn tham gia.

| Field | Kiểu dữ liệu | Ràng buộc / mô tả |
|---|---|---|
| `_id` | ObjectId | Required |
| `name` | String | Required, ví dụ: "Siêu Sale Giờ Vàng 12h" |
| `startTime` | Date | Required, thời gian bắt đầu |
| `endTime` | Date | Required, thời gian kết thúc |
| `status` | String | Enum: `upcoming`, `active`, `ended` |
| `products` | Array\<Object\> | Danh sách sản phẩm tham gia |
| `products.productId` | ObjectId | Reference: `Product`, required |
| `products.versionId` | ObjectId | Reference: `Product.version`, required |
| `products.flashSalePrice` | Number | Required, giá bán trong khung giờ Flash Sale |
| `products.quantity` | Number | Required, số lượng bán tối đa trong sự kiện |
| `products.sold` | Number | Default: `0`, số lượng đã bán (Xử lý concurrency bằng Redis) |
| `isActive` | Boolean | Default: `true` |
| `createdAt` | Date | Ngày tạo |
| `updatedAt` | Date | Ngày cập nhật |

## 24. Collection Audit Log

Lưu lịch sử thao tác quan trọng của admin/nhân viên để truy vết khi có thay đổi dữ liệu nhạy cảm như đổi quyền, khóa tài khoản, sửa giá, xóa sản phẩm, duyệt hoàn tiền hoặc thay đổi cấu hình hệ thống.

| Field | Kiểu dữ liệu | Ràng buộc / mô tả |
|---|---|---|
| `_id` | ObjectId | Required |
| `actorId` | ObjectId | Reference: `User`, admin/staff thực hiện thao tác |
| `actorRole` | String | Enum: `admin`, `staff` |
| `action` | String | Required, ví dụ `user.change_role`, `product.update_price`, `return.approve` |
| `targetType` | String | Required, ví dụ `User`, `Product`, `Order`, `Return Request`, `Setting` |
| `targetId` | ObjectId | Id bản ghi bị tác động, có thể `null` nếu thao tác cấp hệ thống |
| `before` | Object | Snapshot dữ liệu trước khi thay đổi, chỉ lưu field cần thiết |
| `after` | Object | Snapshot dữ liệu sau khi thay đổi, chỉ lưu field cần thiết |
| `ipAddress` | String | Default: `null` |
| `userAgent` | String | Default: `null` |
| `createdAt` | Date | Ngày tạo |

## 25. Collection System Setting

Lưu cấu hình vận hành có thể chỉnh từ trang admin như thông tin cửa hàng, quy tắc tích điểm, chính sách đổi trả, ngưỡng cảnh báo tồn kho và cấu hình hiển thị.

| Field | Kiểu dữ liệu | Ràng buộc / mô tả |
|---|---|---|
| `_id` | ObjectId | Required |
| `key` | String | Required, unique, ví dụ `store_info`, `loyalty_rule`, `return_policy`, `low_stock_threshold` |
| `value` | Object | Required, dữ liệu cấu hình theo từng key |
| `description` | String | Default: `null` |
| `updatedBy` | ObjectId | Reference: `User`, admin cập nhật gần nhất |
| `createdAt` | Date | Ngày tạo |
| `updatedAt` | Date | Ngày cập nhật |

## 26. Quan hệ giữa các collection

Các quan hệ chính trong database:

| Collection nguồn | Field | Collection đích | Ý nghĩa |
|---|---|---|---|
| `User` | `membership` | `Membership Ranking` | Người dùng thuộc một hạng thành viên |
| `Category` | `parent_id` | `Category` | Danh mục cha - con |
| `Product` | `category_id` | `Category` | Sản phẩm thuộc một danh mục |
| `Product` | `brand_id` | `Brand` | Sản phẩm thuộc một thương hiệu |
| `Product.version.import` | `import` | `Import` | Biến thể sản phẩm có thông tin nhập kho |
| `Import` | `productId` | `Product` | Phiếu nhập thuộc một sản phẩm |
| `Import` | `versionId` | `Product.version` | Phiếu nhập thuộc một biến thể sản phẩm |
| `Cart` | `user_id` | `User` | Giỏ hàng thuộc về người dùng |
| `Cart.product_list` | `product_id` | `Product` | Sản phẩm trong giỏ hàng |
| `Favorites` | `user_id` | `User` | Người dùng yêu thích sản phẩm |
| `Favorites` | `product_id` | `Product` | Sản phẩm được yêu thích |
| `Order` | `user_id` | `User` | Đơn hàng thuộc về người dùng |
| `Order.order_list` | `product_id` | `Product` | Sản phẩm trong đơn hàng |
| `Order` | `couponId` | `Coupon` | Coupon được áp dụng cho đơn hàng |
| `Order` | `userCouponId` | `User Coupon` | Bản ghi voucher người dùng đã dùng cho đơn hàng |
| `Order` | `paymentMethodId` | `Payment Method` | Phương thức thanh toán đã lưu được dùng cho đơn hàng |
| `Transaction` | `user_id` | `User` | Giao dịch của người dùng |
| `Transaction` | `order_id` | `Order` | Giao dịch thuộc về đơn hàng |
| `Transaction` | `paymentMethodId` | `Payment Method` | Phương thức thanh toán đã lưu liên quan đến giao dịch |
| `Reviews` | `user_id` | `User` | Người dùng đánh giá sản phẩm |
| `Reviews` | `orderId` | `Order` | Đánh giá được tạo từ một đơn hàng đã mua |
| `Reviews` | `product_id` | `Product` | Đánh giá thuộc về sản phẩm |
| `Reviews` | `version_id` | `Product.version` | Đánh giá thuộc về biến thể sản phẩm đã mua |
| `Feedback` | `userId` | `User` | Phản hồi được gửi bởi người dùng |
| `Feedback` | `orderId` | `Order` | Đơn hàng liên quan đến yêu cầu hỗ trợ, nếu có |
| `Virtual Try on Room` | `userId` | `User` | Lịch sử phối đồ của người dùng |
| `Coupon` | `applicableProducts` | `Product` | Mã giảm giá áp dụng cho sản phẩm cụ thể |
| `Coupon` | `applicableCategories` | `Category` | Mã giảm giá áp dụng cho danh mục cụ thể |
| `Coupon` | `eligibleMembershipRanks` | `Membership Ranking` | Voucher chỉ áp dụng cho một số hạng thành viên |
| `User Coupon` | `userId` | `User` | Voucher thuộc về người dùng |
| `User Coupon` | `couponId` | `Coupon` | Trạng thái sử dụng của một voucher cụ thể |
| `User Coupon` | `orderId` | `Order` | Đơn hàng đã sử dụng voucher |
| `Search History` | `userId` | `User` | Lịch sử tìm kiếm của người dùng đăng nhập |
| `Search History.resultProducts` | `productId` | `Product` | Sản phẩm xuất hiện trong kết quả tìm kiếm |
| `Product Interaction` | `userId` | `User` | Hành vi sản phẩm của người dùng đăng nhập |
| `Product Interaction` | `productId` | `Product` | Sản phẩm được tương tác |
| `Return Request` | `orderId` | `Order` | Yêu cầu trả hàng thuộc về đơn hàng |
| `Return Request` | `userId` | `User` | Người dùng gửi yêu cầu trả hàng |
| `Return Request` | `processedBy` | `User` | Nhân viên/quản trị viên xử lý yêu cầu |
| `Return Request` | `refundTransactionId` | `Transaction` | Giao dịch hoàn tiền liên quan nếu có |
| `Payment Method` | `userId` | `User` | Phương thức thanh toán thuộc về người dùng |
| `FAQ` | - | - | Bản ghi FAQ không có khóa ngoại, quản lý tập trung |
| `Notification` | `userId` | `User` | Thông báo gửi đến người dùng |
| `Flash Sale` | `products.productId` | `Product` | Sản phẩm tham gia Flash Sale |
| `Flash Sale` | `products.versionId` | `Product.version` | Biến thể tham gia Flash Sale |
| `Audit Log` | `actorId` | `User` | Admin/nhân viên thực hiện thao tác |
| `System Setting` | `updatedBy` | `User` | Admin cập nhật cấu hình |

## 27. Các điểm đã chuẩn hóa

So với sơ đồ ban đầu, tài liệu database đã được chuẩn hóa lại một số điểm để phù hợp hơn khi triển khai bằng MongoDB và Mongoose:

- `Reviews` chỉ giữ một field `product_id`.
- `Import` chỉ giữ một field `versionId`.
- `Favorites` đã bổ sung `_id`.
- `Favorites.createdAt` được dùng để sắp xếp danh sách yêu thích theo thời điểm lưu; các bộ lọc như danh mục, thương hiệu, giá, còn hàng lấy từ `Product` khi populate.
- `Membership Ranking.minSpend` đổi thành `minPoint`/`maxPoint` để khớp giao diện hạng thẻ thành viên tính theo điểm tích lũy.
- Bổ sung `User.loyaltyPoint` và `membershipUpdatedAt` để lưu điểm tích lũy, tự động xác định hạng hiện tại và tiến trình lên hạng.
- `Product.version.price` đổi từ `String` sang `Number` để thuận tiện tính toán giá, giảm giá và thanh toán.
- `Product.version.image_embedding` đổi sang `Array<Number>` để lưu vector đặc trưng. Đã thống nhất sử dụng **MongoDB Atlas Vector Search** để truy vấn trực tiếp thay vì xử lý dưới Backend/ML.
- Bổ sung `version.size_spec.stock_quantity` để tăng tốc độ truy xuất số lượng tồn kho khả dụng hiện tại trên giao diện.
- `User.isActive` và `Category.isActive` dùng default là `false`.
- `Transaction.paymentMethod` và `Order.paymentMethod` hỗ trợ `COD`, `VNPAY`, `MOMO`, `CARD`, `BANK` để khớp giao diện thanh toán.
- Các field tham chiếu sản phẩm và biến thể trong `Cart` và `Order` dùng `ObjectId` thay vì `String`.
- `Feedback.adminReply` không bắt buộc khi phản hồi mới được tạo; chỉ bắt buộc khi nhân viên hoặc quản trị viên đã trả lời.
- `Virtual Try on Room.productId` và `versionId` dùng `Array<ObjectId>`, `userImage` dùng `Array<String>` để lưu URL ảnh.
- Bỏ `Reviews.count` vì số lượng đánh giá đã được lưu ở `Product.reviewCount`.
- Bổ sung `Coupon` để khớp chức năng áp dụng mã giảm giá khi thanh toán.
- Bổ sung `User Coupon` để khớp màn `Voucher của bạn`, lưu trạng thái voucher theo từng người dùng như còn dùng được, đã dùng hoặc hết hạn.
- Bổ sung `Home Banner`, `Search History` và `Product Interaction` để phục vụ trang chủ, tìm kiếm bằng hình ảnh và gợi ý sản phẩm.
- Bổ sung `Category.bannerImage` để hiển thị banner rộng ở trang danh mục như `Áo nam`.
- Bổ sung `Product.isActive` để hỗ trợ ẩn/hiện sản phẩm thay vì xóa cứng.
- Bổ sung `Reviews.images` và `Reviews.adminReply` để khớp giao diện đánh giá có ảnh và phản hồi từ cửa hàng.
- Bổ sung `Reviews.criteriaRatings`, `version_id` và `size` để khớp modal viết đánh giá theo biến thể đã mua.
- Bổ sung `Reviews.status` để hỗ trợ ẩn/hiện đánh giá khi cần kiểm duyệt.
- Bổ sung `Product.version.sku` để hiển thị mã sản phẩm/biến thể trên trang chi tiết.
- Bổ sung `User.authProviders`, `resetPasswordToken` và `resetPasswordExpires` để hỗ trợ social login và khôi phục mật khẩu.
- Xem `User.email` là định danh đăng nhập chính trên giao diện tài khoản; nếu cho người dùng đổi email thì cần luồng xác thực email mới trước khi cập nhật.
- Bổ sung `User.dateOfBirth` để khớp form đăng ký có ngày/tháng/năm sinh.
- Chuẩn hóa địa chỉ người dùng và địa chỉ giao hàng theo cấu trúc `province`, `district`, `ward`, `streetName`, `phoneNumber`.
- Bổ sung `Cart.product_list.size` và `Order.order_list.size` để lưu size người dùng đã chọn.
- Bổ sung `Cart.product_list._id` và `Cart.product_list.isSelected` để khớp màn hình giỏ hàng trong tài khoản: chọn từng sản phẩm, chọn tất cả, tính tổng theo sản phẩm đã chọn.
- Bổ sung các field giảm giá trong `Order`: `subTotal`, `couponCode`, `couponId`, `userCouponId`, `couponDiscountAmount`, `shippingDiscountAmount`, `membershipDiscountAmount`.
- Mở rộng `Coupon.discountType` thêm `free_shipping` để hỗ trợ voucher miễn phí vận chuyển.
- Bổ sung `Coupon.perUserLimit`, `isPublic`, `eligibleUserTypes`, `eligibleMembershipRanks` để xác định voucher nào được hiển thị cho từng người dùng.
- Bổ sung `Order.orderCode`, `invoiceCode`, `taxAmount`, `tracking`, `paymentStatus`, `estimatedDeliveryDate` để khớp giao diện chi tiết đơn hàng.
- Bổ sung `Return Request` để hỗ trợ mục trả hàng trong trang chi tiết đơn hàng.
- Bổ sung `Payment Method` để khớp mục phương thức thanh toán trong trang tài khoản, gồm ví điện tử, VNPay/ngân hàng và thẻ tín dụng/ghi nợ. COD không lưu vào collection này.
- Bổ sung `Order.paymentMethodId`, `Transaction.paymentMethodId`, `Transaction.gatewayProvider` để liên kết đơn/giao dịch với phương thức thanh toán đã lưu và cổng thanh toán xử lý.
- Bổ sung `FAQ` để lưu trữ danh sách câu hỏi thường gặp động phục vụ giao diện Hỗ trợ khách hàng.
- Bổ sung `Feedback.orderId` và `Feedback.category` để hỗ trợ lọc/phân loại yêu cầu hỗ trợ trong trang admin.
- Bổ sung `Notification` để lưu trữ thông báo in-app (quả chuông 🔔) cho người dùng.
- Bổ sung `Flash Sale` để cấu hình chương trình giờ vàng giá sốc, quản lý số lượng tồn kho tách biệt nhằm áp dụng giải pháp concurrency (tránh bán âm kho) bằng Redis.
- Cập nhật `Order.shipping` bổ sung `shippingLabel` và làm rõ cách tính `shippingFee` qua API GHN/GHTK để khớp thực tế vận chuyển.
- Bổ sung các field xử lý trong `Return Request`: `processedBy`, `processedAt`, `refundTransactionId`, `returnShippingCode` để khớp luồng duyệt/từ chối/hoàn tiền.
- Bổ sung `Audit Log` để truy vết thao tác admin/staff trên dữ liệu nhạy cảm.
- Bổ sung `System Setting` để quản lý cấu hình cửa hàng, quy tắc điểm, chính sách đổi trả và ngưỡng cảnh báo tồn kho.

## 28. Quy định validation đề xuất

Các quy định sau dùng để triển khai Mongoose schema, giúp dữ liệu hợp lệ hơn và hạn chế nhập liệu quá ngắn, quá dài hoặc sai định dạng.

### 28.1 Quy định chung

| Nhóm dữ liệu | Quy định đề xuất |
|---|---|
| String thông thường | Nên `trim: true`, không cho chuỗi chỉ chứa khoảng trắng |
| Tên người, tên sản phẩm, tên danh mục | Không chứa ký tự điều khiển, không vượt quá giới hạn hiển thị trên UI |
| Email | Chuyển về chữ thường, `trim`, tối đa 254 ký tự |
| Số điện thoại Việt Nam | Nên kiểm tra số bắt đầu bằng `0` hoặc `+84`, tiếp theo là đầu số di động hợp lệ và đủ 10 chữ số theo định dạng Việt Nam |
| URL hình ảnh | Tối đa 500 ký tự, nên kiểm tra bắt đầu bằng `http://` hoặc `https://` |
| ObjectId tham chiếu | Bắt buộc kiểm tra tồn tại dữ liệu ở collection liên quan khi cần |
| Số tiền | Dùng `Number`, đơn vị VND, không dùng `String` |
| Phần trăm | Giá trị từ `0` đến `100` |
| Ngày tạo, ngày cập nhật | Dùng `timestamps: true` của Mongoose |

### 28.2 User

| Field | Validation đề xuất |
|---|---|
| `name` | String, trim, minLength: `2`, maxLength: `60` |
| `email` | String, trim, lowercase, unique, maxLength: `254`, đúng định dạng email; nếu dùng làm tên đăng nhập thì chỉ cho đổi sau khi xác thực email mới |
| `password` | Nếu là mật khẩu đầu vào: minLength `8`, maxLength `72`; nếu lưu hash: maxLength `255` |
| `role` | Enum: `admin`, `staff`, `user`; default: `user` |
| `phone` | String, trim, theo regex số điện thoại Việt Nam |
| `gender` | Enum: `male`, `female` |
| `dateOfBirth` | Date, required; tuổi hợp lệ đề xuất từ `13` đến `100` |
| `address` | Array, min `1`, max `5` địa chỉ |
| `address.customerName` | String, trim, minLength: `2`, maxLength: `60` |
| `address.province` | String, trim, minLength: `2`, maxLength: `80` |
| `address.district` | String, trim, minLength: `2`, maxLength: `80` |
| `address.ward` | String, trim, minLength: `2`, maxLength: `80` |
| `address.streetName` | String, trim, minLength: `5`, maxLength: `150` |
| `address.phoneNumber` | String, trim, theo regex số điện thoại Việt Nam |
| `address.isDefault` | Boolean, default: `false`; nên có đúng một địa chỉ mặc định |
| `refreshToken` | String hoặc null, maxLength: `1000` |
| `authProviders` | Array, max `5` provider |
| `authProviders.provider` | Enum: `google`, `facebook`, `apple` |
| `authProviders.providerId` | String, trim, minLength: `3`, maxLength: `200` |
| `resetPasswordToken` | String hoặc null, maxLength: `255`, nên lưu dạng hash |
| `resetPasswordExpires` | Date hoặc null |
| `avatarImage` | String hoặc null, maxLength: `500`, định dạng URL |
| `loyaltyPoint` | Number nguyên, min: `0`, max: `100000000`, default: `0` |
| `membershipUpdatedAt` | Date hoặc null |
| `isActive` | Boolean, default: `false` |

### 28.3 Membership Ranking

| Field | Validation đề xuất |
|---|---|
| `name` | String, trim, unique, minLength: `2`, maxLength: `30` |
| `level` | Number nguyên, min: `1`, max: `20`, unique |
| `minPoint` | Number nguyên, min: `0`, max: `100000000` |
| `maxPoint` | Number nguyên hoặc null; nếu có giá trị thì phải lớn hơn `minPoint` |
| `discountPercent` | Number, min: `0`, max: `100` |
| `benefitDescription` | String, trim, minLength: `2`, maxLength: `200` |
| `cardColor` | String, mã màu hex `#RRGGBB`, default: `#5b788a` |
| `textColor` | String, mã màu hex `#RRGGBB`, default: `#ffffff` |
| `badgeColor` | String, mã màu hex `#RRGGBB`, default: `#5b788a` |
| `iconName` | String, lowercase/kebab-case, default: `star` |
| `isActive` | Boolean, default: `true` |

Gợi ý dữ liệu ban đầu:

| Hạng | level | minPoint | maxPoint | discountPercent | cardColor | iconName | benefitDescription |
|---|---:|---:|---:|---:|---|---|---|
| Member | 1 | 0 | 1999 | 0 | `#5b788a` | `star` | Tích điểm đổi quà/voucher |
| Silver | 2 | 2000 | 4999 | 5 | `#8fa3ad` | `shield-star` | Giảm 5% trên mỗi hóa đơn |
| Gold | 3 | 5000 | 9999 | 7 | `#cf9f2e` | `crown` | Giảm 7% trên mỗi hóa đơn |
| Platinum | 4 | 10000 | null | 10 | `#1c1c1c` | `diamond-stone` | Giảm 10% trên mỗi hóa đơn |

### 28.4 Category

| Field | Validation đề xuất |
|---|---|
| `name` | String, trim, minLength: `2`, maxLength: `80` |
| `parent_id` | ObjectId hoặc null; nếu có thì tham chiếu `Category` |
| `level` | Number nguyên, min: `1`, max: `5` |
| `gender` | Enum: `male`, `female`; có thể thêm `unisex` nếu có danh mục dùng chung |
| `image` | String, maxLength: `500`, định dạng URL |
| `bannerImage` | String hoặc null, maxLength: `500`, định dạng URL |
| `description` | String, trim, minLength: `10`, maxLength: `500` |
| `isActive` | Boolean, default: `false` |

### 28.5 Brand

| Field | Validation đề xuất |
|---|---|
| `name` | String, trim, unique, minLength: `2`, maxLength: `80` |
| `image` | String, maxLength: `500`, định dạng URL |
| `isActive` | Boolean, default: `true` |

Tên thương hiệu nên cho phép chữ cái, số, khoảng trắng và một số ký tự phổ biến như `.`, `&`, `-`, `'`.

### 28.6 Product

| Field | Validation đề xuất |
|---|---|
| `name` | String, trim, minLength: `3`, maxLength: `150` |
| `category_id` | ObjectId, required, tham chiếu `Category` |
| `brand_id` | ObjectId, required, tham chiếu `Brand` |
| `version` | Array, min `1`, max `20` biến thể |
| `version.sku` | String, trim, uppercase, minLength: `3`, maxLength: `40`, unique theo biến thể |
| `version.color` | String, trim, minLength: `2`, maxLength: `40` |
| `version.fitType` | String, trim, minLength: `2`, maxLength: `50` |
| `version.size_spec` | Array, min `1`, max `15` size |
| `version.size_spec.size` | String, trim, minLength: `1`, maxLength: `10` |
| `version.size_spec.shoulder` | Number, min: `0`, max: `100` |
| `version.size_spec.chest` | Number, min: `0`, max: `200` |
| `version.size_spec.length` | Number, min: `0`, max: `200` |
| `version.size_spec.weight` | Number, min: `0`, max: `200` |
| `version.version_image` | String, maxLength: `500`, định dạng URL |
| `version.image_embedding` | Array\<Number\>, nên cố định theo model, ví dụ `512` chiều nếu dùng CLIP |
| `version.price` | Number, min: `1000`, max: `100000000` |
| `version.discount` | Number, min: `0`, max: `100` |
| `version.isAvailable` | Boolean, default phụ thuộc tồn kho |
| `description` | String, trim, minLength: `20`, maxLength: `3000` |
| `product_image` | String, maxLength: `500`, định dạng URL |
| `isActive` | Boolean, default: `true` |
| `sold_quantity` | Number nguyên, min: `0`, default: `0` |
| `averageRating` | Number, min: `0`, max: `5`, default: `0` |
| `reviewCount` | Number nguyên, min: `0`, default: `0` |

Nên tạo unique index theo tổ hợp `name`, `brand_id`, `category_id` nếu muốn hạn chế trùng sản phẩm.

Các index nên có để phục vụ trang danh sách sản phẩm:

- `category_id`
- `brand_id`
- `isActive`
- `sold_quantity`
- `averageRating`
- `createdAt`
- `version.color`
- `version.fitType`
- `version.price`
- `version.discount`

### 28.7 Import

| Field | Validation đề xuất |
|---|---|
| `_id` | String, trim, minLength: `3`, maxLength: `40`, có thể dùng mã phiếu nhập như `IMP20260520001` |
| `productId` | ObjectId, required, tham chiếu `Product` |
| `versionId` | ObjectId, required, tham chiếu `Product.version` |
| `detail` | Array, min `1`, max `100` dòng nhập |
| `detail.size` | String, trim, minLength: `1`, maxLength: `10` |
| `detail.quantity` | Number nguyên, min: `1`, max: `100000` |
| `detail.remaining_quantity` | Number nguyên, min: `0`, không lớn hơn `detail.quantity` |
| `remaining_quantity` | Number nguyên, min: `0`, bằng tổng `detail.remaining_quantity` |

### 28.8 Cart

| Field | Validation đề xuất |
|---|---|
| `user_id` | ObjectId, required, unique, tham chiếu `User` |
| `product_list` | Array, min `0`, max `100` sản phẩm |
| `product_list._id` | ObjectId, required nếu dùng subdocument id để cập nhật từng dòng giỏ hàng |
| `product_list.product_id` | ObjectId, required, tham chiếu `Product` |
| `product_list.version_id` | ObjectId, required, tham chiếu `Product.version` |
| `product_list.size` | String, trim, minLength: `1`, maxLength: `10` |
| `product_list.quantity` | Number nguyên, min: `1`, max: `99` |
| `product_list.priceAtAddedTime` | Number, min: `1000`, max: `100000000` |
| `product_list.isSelected` | Boolean, default: `true` |

Trong một giỏ hàng, nên unique theo bộ `product_id`, `version_id` và `size` để tránh trùng dòng sản phẩm.

### 28.9 Favorites

| Field | Validation đề xuất |
|---|---|
| `user_id` | ObjectId, required, tham chiếu `User` |
| `product_id` | ObjectId, required, tham chiếu `Product` |

Nên tạo unique compound index theo `user_id` và `product_id` để một người dùng không yêu thích trùng một sản phẩm nhiều lần.

Nên tạo thêm index `{ user_id: 1, createdAt: -1 }` để hỗ trợ màn danh sách yêu thích và sắp xếp theo sản phẩm mới lưu.

### 28.10 Order

| Field | Validation đề xuất |
|---|---|
| `orderCode` | String, trim, unique, minLength: `6`, maxLength: `30` |
| `invoiceCode` | String hoặc null, trim, maxLength: `30` |
| `user_id` | ObjectId, required, tham chiếu `User` |
| `order_list` | Array, min `1`, max `100` sản phẩm |
| `order_list.product_id` | ObjectId, required, tham chiếu `Product` |
| `order_list.version_id` | ObjectId, required, tham chiếu `Product.version` |
| `order_list.size` | String, trim, minLength: `1`, maxLength: `10` |
| `order_list.name` | String, trim, minLength: `3`, maxLength: `150` |
| `order_list.sku` | String hoặc null, trim, maxLength: `40` |
| `order_list.color` | String hoặc null, trim, maxLength: `40` |
| `order_list.image` | String hoặc null, maxLength: `500`, định dạng URL |
| `order_list.quantity` | Number nguyên, min: `1`, max: `99` |
| `order_list.priceAtPurchased` | Number, min: `1000`, max: `100000000` |
| `subTotal` | Number, min: `1000`, max: `200000000` |
| `shippingFee` | Number, min: `0`, max: `2000000`, default: `25000` |
| `couponCode` | String hoặc null, trim, uppercase, maxLength: `30` |
| `couponId` | ObjectId hoặc null, tham chiếu `Coupon` |
| `userCouponId` | ObjectId hoặc null, tham chiếu `User Coupon` |
| `couponDiscountAmount` | Number, min: `0`, max: `200000000`, default: `0` |
| `shippingDiscountAmount` | Number, min: `0`, max: `2000000`, default: `0` |
| `membershipDiscountAmount` | Number, min: `0`, max: `200000000`, default: `0` |
| `taxAmount` | Number, min: `0`, max: `200000000`, default: `0` |
| `totalAmount` | Number, min: `1000`, max: `200000000` |
| `status` | Enum: `confirmed`, `packed`, `shipping`, `delivered`, `cancelled`, `return_requested`, `returned`; default: `confirmed` |
| `tracking` | Array, min `1`, max `20` trạng thái |
| `tracking.status` | Enum giống `status` |
| `tracking.title` | String, trim, minLength: `2`, maxLength: `80` |
| `tracking.description` | String hoặc null, trim, maxLength: `200` |
| `tracking.time` | Date |
| `paymentMethod` | Enum: `COD`, `VNPAY`, `MOMO`, `CARD`, `BANK`; default: `COD` |
| `paymentMethodId` | ObjectId hoặc null, tham chiếu `Payment Method` |
| `paymentStatus` | Enum: `pending`, `paid`, `failed`, `refunded`; default: `pending` |
| `shippingAddress.customerName` | String, trim, minLength: `2`, maxLength: `60` |
| `shippingAddress.province` | String, trim, minLength: `2`, maxLength: `80` |
| `shippingAddress.district` | String, trim, minLength: `2`, maxLength: `80` |
| `shippingAddress.ward` | String, trim, minLength: `2`, maxLength: `80` |
| `shippingAddress.streetName` | String, trim, minLength: `5`, maxLength: `150` |
| `shippingAddress.phoneNumber` | String, trim, theo regex số điện thoại Việt Nam |
| `orderNote` | String hoặc null, trim, maxLength: `500` |
| `estimatedDeliveryDate` | Date hoặc null |
| `deliveredAt` | Date hoặc null |
| `cancelledAt` | Date hoặc null |
| `cancelReason` | String hoặc null, trim, maxLength: `500` |

`totalAmount` nên được tính lại ở backend từ `subTotal`, `shippingFee`, `taxAmount`, mã giảm giá, giảm giá thành viên và miễn phí vận chuyển, không nên tin hoàn toàn dữ liệu gửi từ frontend.

### 28.11 Transaction

| Field | Validation đề xuất |
|---|---|
| `user_id` | ObjectId, required, tham chiếu `User` |
| `order_id` | ObjectId, required, tham chiếu `Order` |
| `amount` | Number, min: `1000`, max: `200000000` |
| `paymentMethod` | Enum: `COD`, `VNPAY`, `MOMO`, `CARD`, `BANK` |
| `paymentMethodId` | ObjectId hoặc null, tham chiếu `Payment Method` |
| `gatewayTransactionId` | String hoặc null, trim, maxLength: `100` |
| `gatewayProvider` | String hoặc null, trim, enum đề xuất: `vnpay`, `momo`, `stripe`, `napas`, `manual` |
| `paymentDetail` | Object, default `{}`, giới hạn dung lượng hợp lý, ví dụ dưới `20KB` |
| `status` | Enum: `pending`, `success`, `failed`; default: `pending` |

Nếu thanh toán COD, `gatewayTransactionId` có thể là `null`. Nếu thanh toán VNPay, MoMo, ngân hàng hoặc thẻ, field này nên lưu mã giao dịch trả về từ cổng thanh toán.

### 28.12 Reviews

| Field | Validation đề xuất |
|---|---|
| `user_id` | ObjectId, required, tham chiếu `User` |
| `orderId` | ObjectId, required, tham chiếu `Order` |
| `product_id` | ObjectId, required, tham chiếu `Product` |
| `version_id` | ObjectId, required, tham chiếu `Product.version` |
| `size` | String, trim, minLength: `1`, maxLength: `10` |
| `rating` | Number nguyên, min: `1`, max: `5` |
| `criteriaRatings.fabricQuality` | Number nguyên, min: `1`, max: `5` |
| `criteriaRatings.descriptionMatch` | Number nguyên, min: `1`, max: `5` |
| `criteriaRatings.fit` | Number nguyên, min: `1`, max: `5` |
| `criteriaRatings.colorDurability` | Number nguyên, min: `1`, max: `5` |
| `content` | String, trim, minLength: `10`, maxLength: `1000` |
| `images` | Array\<String\>, max `5` ảnh, mỗi URL maxLength `500` |
| `adminReply` | Object hoặc null |
| `adminReply.userId` | ObjectId, tham chiếu `User`, chỉ cho `staff` hoặc `admin` |
| `adminReply.content` | String, trim, minLength: `2`, maxLength: `1000` |
| `adminReply.createdAt` | Date |
| `isVerifiedPurchase` | Boolean, default: `false` |
| `status` | Enum: `visible`, `hidden`; default: `visible` |

Nên tạo unique compound index theo `user_id`, `product_id`, `version_id`, `size` hoặc theo `orderId + productId + versionId + size` nếu muốn mỗi lượt mua chỉ được đánh giá một lần.

### 28.13 Feedback

| Field | Validation đề xuất |
|---|---|
| `userId` | ObjectId, required, tham chiếu `User` |
| `orderId` | ObjectId hoặc null, tham chiếu `Order` |
| `name` | String, trim, minLength: `2`, maxLength: `60` |
| `email` | String, trim, lowercase, maxLength: `254`, đúng định dạng email |
| `category` | Enum: `order`, `shipping`, `return`, `payment`, `account`, `membership`, `other`; default: `other` |
| `subject` | String, trim, minLength: `5`, maxLength: `150`, default: "Yêu cầu hỗ trợ" |
| `message` | String, trim, minLength: `10`, maxLength: `2000` |
| `status` | Enum: `new`, `read`, `replied`, `closed`; default: `new` |
| `adminReply` | String hoặc null, trim, maxLength: `2000`; required khi `status` là `replied` hoặc `closed` |

### 28.14 Virtual Try on Room

| Field | Validation đề xuất |
|---|---|
| `userId` | ObjectId, required, tham chiếu `User` |
| `productId` | Array\<ObjectId\>, min `1`, max `10`, tham chiếu `Product` |
| `versionId` | Array\<ObjectId\>, min `1`, max `10`, tham chiếu `Product.version` |
| `userImage` | Array\<String\>, min `1`, max `5`, mỗi URL maxLength `500` |
| `generatedImage` | String, required, maxLength: `500`, định dạng URL |

Nên kiểm tra số lượng `productId` và `versionId` tương ứng nhau để tránh chọn sản phẩm này nhưng biến thể của sản phẩm khác.


### 28.15 Coupon

| Field | Validation đề xuất |
|---|---|
| `code` | String, trim, uppercase, unique, minLength: `3`, maxLength: `30`, chỉ gồm chữ cái, số, `_`, `-` |
| `name` | String, trim, minLength: `3`, maxLength: `100` |
| `description` | String hoặc null, trim, maxLength: `500` |
| `discountType` | Enum: `percent`, `fixed`, `free_shipping` |
| `discountValue` | Nếu `percent`: min `1`, max `100`; nếu `fixed`: min `1000`, max `50000000`; nếu `free_shipping`: có thể là `0` |
| `maxDiscountAmount` | Number hoặc null, min: `0`, max: `50000000` |
| `minOrderAmount` | Number, min: `0`, max: `200000000` |
| `usageLimit` | Number nguyên hoặc null, min: `1`, max: `1000000` |
| `usedCount` | Number nguyên, min: `0`, không lớn hơn `usageLimit` nếu có |
| `perUserLimit` | Number nguyên, min: `1`, max: `100`, default: `1` |
| `isPublic` | Boolean, default: `true` |
| `eligibleUserTypes` | Array, enum item: `all`, `new_user`, `member`, default: `['all']`; neu co `all` thi normalize ve `['all']` |
| `eligibleMembershipRanks` | Array\<ObjectId\>, tham chiếu `Membership Ranking`, có thể rỗng; neu co gia tri thi coupon chi ap dung cho cac hang duoc chon |
| `applicableProducts` | Array\<ObjectId\>, tham chiếu `Product`, có thể rỗng |
| `applicableCategories` | Array\<ObjectId\>, tham chiếu `Category`, có thể rỗng |
| `startAt` | Date, required |
| `endAt` | Date, required, phải lớn hơn `startAt` |
| `isActive` | Boolean, default: `true` |

Nếu `applicableProducts` và `applicableCategories` đều rỗng, mã giảm giá được hiểu là áp dụng toàn bộ đơn hàng.

#### User Coupon

| Field | Validation đề xuất |
|---|---|
| `userId` | ObjectId, required, tham chiếu `User` |
| `couponId` | ObjectId, required, tham chiếu `Coupon` |
| `status` | Enum: `available`, `used`, `expired`, `disabled`; default: `available` |
| `assignedAt` | Date, default là thời điểm tạo |
| `usedAt` | Date hoặc null |
| `orderId` | ObjectId hoặc null, tham chiếu `Order` |

Nên tạo unique compound index theo `userId` và `couponId` nếu mỗi người chỉ được lưu một bản ghi cho một voucher. Nếu cần cho phép nhiều lượt dùng, thêm field `usageNo` hoặc tăng `perUserLimit` và lưu lịch sử dùng riêng.

### 28.16 Home Banner

| Field | Validation đề xuất |
|---|---|
| `title` | String, trim, minLength: `3`, maxLength: `120` |
| `subtitle` | String hoặc null, trim, maxLength: `150` |
| `description` | String hoặc null, trim, maxLength: `500` |
| `image` | String, required, maxLength: `500`, định dạng URL |
| `position` | Enum: `home_hero`, `virtual_try_on`, `image_search`, `home_promotion` |
| `ctaText` | String hoặc null, trim, maxLength: `40` |
| `ctaLink` | String hoặc null, trim, maxLength: `300` |
| `displayOrder` | Number nguyên, min: `0`, max: `999` |
| `isActive` | Boolean, default: `true` |
| `startAt` | Date hoặc null |
| `endAt` | Date hoặc null, nếu có thì phải lớn hơn `startAt` |

Trang chủ chỉ nên hiển thị banner đang hoạt động và còn trong thời gian hiệu lực.

### 28.17 Search History

| Field | Validation đề xuất |
|---|---|
| `userId` | ObjectId hoặc null, tham chiếu `User` |
| `sessionId` | String hoặc null, trim, maxLength: `100` |
| `searchType` | Enum: `keyword`, `image` |
| `keyword` | String hoặc null, trim, minLength: `1`, maxLength: `100` |
| `imageUrl` | String hoặc null, maxLength: `500`, định dạng URL |
| `resultProducts` | Array, max `100` kết quả |
| `resultProducts.productId` | ObjectId, tham chiếu `Product` |
| `resultProducts.versionId` | ObjectId hoặc null, tham chiếu `Product.version` |
| `resultProducts.score` | Number, min: `0`, max: `1` nếu là điểm tương đồng chuẩn hóa |

Nếu `searchType` là `keyword` thì `keyword` bắt buộc có giá trị. Nếu `searchType` là `image` thì `imageUrl` bắt buộc có giá trị.

### 28.18 Product Interaction

| Field | Validation đề xuất |
|---|---|
| `userId` | ObjectId hoặc null, tham chiếu `User` |
| `sessionId` | String hoặc null, trim, maxLength: `100` |
| `productId` | ObjectId, required, tham chiếu `Product` |
| `versionId` | ObjectId hoặc null, tham chiếu `Product.version` |
| `action` | Enum: `view`, `click`, `favorite`, `add_to_cart`, `purchase`, `search_result_click`, `recommendation_click`, `try_on` |
| `source` | Enum: `home`, `category`, `search`, `image_search`, `detail`, `recommendation`, `virtual_try_on` |
| `metadata` | Object, default `{}`, giới hạn dung lượng hợp lý, ví dụ dưới `10KB` |

Collection này nên được ghi theo dạng log sự kiện, không nên cập nhật đè sự kiện cũ. Dữ liệu này dùng để thống kê hành vi và làm đầu vào cho hệ thống gợi ý sản phẩm.

### 28.19 Return Request

| Field | Validation đề xuất |
|---|---|
| `orderId` | ObjectId, required, tham chiếu `Order` |
| `userId` | ObjectId, required, tham chiếu `User` |
| `items` | Array, min `1`, max `50` sản phẩm |
| `items.productId` | ObjectId, required, tham chiếu `Product` |
| `items.versionId` | ObjectId, required, tham chiếu `Product.version` |
| `items.size` | String, trim, minLength: `1`, maxLength: `10` |
| `items.quantity` | Number nguyên, min: `1`, max: `99` |
| `reason` | String, trim, minLength: `10`, maxLength: `1000` |
| `images` | Array\<String\>, max `5` ảnh, mỗi URL maxLength `500` |
| `status` | Enum: `pending`, `approved`, `rejected`, `refunded`; default: `pending` |
| `adminNote` | String hoặc null, trim, maxLength: `1000` |
| `processedBy` | ObjectId hoặc null, tham chiếu `User`, chỉ cho `staff` hoặc `admin` |
| `processedAt` | Date hoặc null |
| `refundTransactionId` | ObjectId hoặc null, tham chiếu `Transaction` |
| `returnShippingCode` | String hoặc null, trim, maxLength: `100` |

Chỉ nên cho tạo yêu cầu trả hàng với đơn đã giao và còn trong thời hạn chính sách trả hàng.

### 28.20 Payment Method

Ghi chú: Collection này chỉ lưu phương thức thanh toán điện tử đã liên kết (`MOMO`, `VNPAY`, `BANK`, `CARD`). COD không cần lưu vào collection vì không có token liên kết; backend chỉ cần ghi nhận `paymentMethod: 'COD'` trực tiếp vào `Order` khi đặt hàng.

| Field | Validation đề xuất |
|---|---|
| `userId` | ObjectId, required, tham chiếu `User` |
| `type` | Enum: `MOMO`, `VNPAY`, `BANK`, `CARD` |
| `provider` | String, trim, minLength: `2`, maxLength: `50` |
| `displayName` | String, trim, minLength: `2`, maxLength: `80` |
| `maskedInfo` | String hoặc null, trim, maxLength: `80` |
| `providerCustomerId` | String hoặc null, trim, maxLength: `150` |
| `providerPaymentMethodId` | String hoặc null, trim, maxLength: `255`; nên mã hóa nếu có rủi ro nhạy cảm |
| `walletPhoneLast3` | String hoặc null, regex `^[0-9]{3}$` |
| `bankCode` | String hoặc null, trim, uppercase, maxLength: `20` |
| `bankName` | String hoặc null, trim, maxLength: `100` |
| `cardBrand` | String hoặc null, enum đề xuất: `visa`, `mastercard`, `jcb`, `amex`, `napas`, `other` |
| `last4` | String hoặc null, regex `^[0-9]{4}$` |
| `expiryMonth` | Number nguyên hoặc null, min: `1`, max: `12` |
| `expiryYear` | Number nguyên hoặc null, min: năm hiện tại |
| `status` | Enum: `pending`, `verified`, `expired`, `disabled`; default: `pending` |
| `isDefault` | Boolean, default: `false` |
| `metadata` | Object, default `{}`, không chứa dữ liệu nhạy cảm |

Nếu cho phép lưu nhiều phương thức thanh toán, mỗi người dùng chỉ nên có một phương thức mặc định.

Tuyệt đối không lưu số thẻ đầy đủ, CVV, OTP, mật khẩu ví/ngân hàng. Với thẻ/ví/ngân hàng, chỉ lưu token do cổng thanh toán trả về và thông tin đã che để hiển thị.

### 28.21 FAQ

| Field | Validation đề xuất |
|---|---|
| `question` | String, trim, minLength: `5`, maxLength: `200` |
| `answer` | String, trim, minLength: `10`, maxLength: `2000` |
| `category` | Enum: `order`, `shipping`, `return`, `membership`, `other`; default: `other` |
| `displayOrder` | Number nguyên, default: `0` |
| `isActive` | Boolean, default: `true` |

### 28.22 Notification

| Field | Validation đề xuất |
|---|---|
| `userId` | ObjectId, required, tham chiếu `User` |
| `title` | String, trim, minLength: `3`, maxLength: `120` |
| `content` | String, trim, minLength: `5`, maxLength: `1000` |
| `type` | Enum: `order`, `promotion`, `system`; default: `system` |
| `isRead` | Boolean, default: `false` |
| `metadata` | Object, default `{}`, không chứa dữ liệu nhạy cảm |

### 28.23 Flash Sale

| Field | Validation đề xuất |
|---|---|
| `name` | String, trim, minLength: `3`, maxLength: `120` |
| `startTime` | Date, required |
| `endTime` | Date, required, phải lớn hơn `startTime` |
| `status` | Enum: `upcoming`, `active`, `ended`; tự tính theo thời gian hoặc cập nhật bởi job |
| `products` | Array, min `1`, max `200` sản phẩm |
| `products.productId` | ObjectId, required, tham chiếu `Product` |
| `products.versionId` | ObjectId, required, tham chiếu `Product.version` |
| `products.flashSalePrice` | Number, min: `1000`, max: `100000000` |
| `products.quantity` | Number nguyên, min: `1`, max: `100000` |
| `products.sold` | Number nguyên, min: `0`, không lớn hơn `products.quantity` |
| `isActive` | Boolean, default: `true` |

### 28.24 Audit Log

| Field | Validation đề xuất |
|---|---|
| `actorId` | ObjectId, required, tham chiếu `User` |
| `actorRole` | Enum: `admin`, `staff` |
| `action` | String, trim, minLength: `3`, maxLength: `100` |
| `targetType` | String, trim, minLength: `2`, maxLength: `80` |
| `targetId` | ObjectId hoặc null |
| `before` | Object hoặc null, chỉ lưu field cần truy vết |
| `after` | Object hoặc null, chỉ lưu field cần truy vết |
| `ipAddress` | String hoặc null, trim, maxLength: `80` |
| `userAgent` | String hoặc null, trim, maxLength: `300` |

### 28.25 System Setting

| Field | Validation đề xuất |
|---|---|
| `key` | String, trim, unique, minLength: `3`, maxLength: `80`, chỉ gồm chữ cái, số, `_`, `-` |
| `value` | Object, required |
| `description` | String hoặc null, trim, maxLength: `500` |
| `updatedBy` | ObjectId hoặc null, tham chiếu `User`, chỉ cho `admin` |
