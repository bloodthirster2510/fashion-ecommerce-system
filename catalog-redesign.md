# Đề xuất thiết kế lại Catalog

Tài liệu này mô tả cấu trúc catalog mới để hỗ trợ nhiều dòng sản phẩm, không chỉ riêng áo.

## Mục tiêu

- Category nguồn quy định danh sách size, measurement field và fit type được phép sử dụng.
- Category lá tham chiếu rõ category nguồn bằng `sizeTemplateSourceId`.
- Product dùng field `variant` để lưu biến thể theo `fitType`, ví dụ: Regular, Slim, Oversized.
- Khi thêm variant, hệ thống tự tạo bảng size theo quy định của category nguồn.
- Người nhập liệu điền measurement cụ thể cho từng size của variant.
- Mỗi variant có nhiều màu.
- Giá bán và giảm giá đặt ở cấp variant.
- `Import` lưu lịch sử nhập kho theo lô.
- `Inventory` lưu tồn kho hiện tại để catalog, cart và checkout đọc nhanh.

## 1. Category Collection

Product vẫn gắn với category lá, ví dụ `Áo thun`. Tuy nhiên, quy định size và measurement có thể lấy từ category nguồn cấp cao hơn, ví dụ `Áo`.

```txt
Áo                <- category nguồn quy định size và measurement
  Áo thun         <- category lá
  Áo polo         <- category lá
  Áo sơ mi        <- category lá
```

Schema:

```ts
Category {
  _id: ObjectId,
  name: string,
  parent_id?: ObjectId | null,
  level: number,
  isLeaf: boolean,
  isSizeTemplateSource: boolean,
  sizeTemplateSourceId?: ObjectId | null,
  sizes: string[],
  measurementFields: MeasurementField[],
  fitTypes: CategoryFitType[],
  isActive: boolean,
  createdAt: Date,
  updatedAt: Date
}

MeasurementField {
  key: string,
  label: string,
  unit: string,
  required: boolean,
  sortOrder: number
}

CategoryFitType {
  _id: ObjectId,
  key: string,
  label: string,
  sortOrder: number,
  isActive: boolean
}
```

Ví dụ category nguồn `Áo`:

```json
{
  "name": "Áo",
  "level": 2,
  "isLeaf": false,
  "isSizeTemplateSource": true,
  "sizeTemplateSourceId": null,
  "sizes": ["S", "M", "L", "XL"],
  "measurementFields": [
    { "key": "shoulder", "label": "Vai", "unit": "cm", "required": true, "sortOrder": 1 },
    { "key": "chest", "label": "Ngực", "unit": "cm", "required": true, "sortOrder": 2 },
    { "key": "length", "label": "Dài áo", "unit": "cm", "required": true, "sortOrder": 3 }
  ],
  "fitTypes": [
    { "_id": "665000000000000000000101", "key": "regular", "label": "Regular", "sortOrder": 1, "isActive": true },
    { "_id": "665000000000000000000102", "key": "slim", "label": "Slim", "sortOrder": 2, "isActive": true },
    { "_id": "665000000000000000000103", "key": "oversized", "label": "Oversized", "sortOrder": 3, "isActive": true }
  ]
}
```

Category chỉ định nghĩa khuôn nhập liệu:

- `sizes` quy định các size hợp lệ.
- `measurementFields` quy định các cột measurement cần nhập.
- `fitTypes` quy định danh sách fit type được phép chọn khi tạo product variant.
- Category không lưu giá trị measurement cụ thể của từng size.
- Category lá lưu `sizeTemplateSourceId` để tham chiếu trực tiếp đến category nguồn, tránh phải tự suy đoán khi duyệt cây.

### Quản lý fit type

Fit type được cấu hình sẵn tại category nguồn. Admin không nhập text tự do khi tạo product variant.

Ví dụ category nguồn `Áo` có:

```txt
Regular
Slim
Oversized
```

Khi tạo variant cho sản phẩm thuộc category lá `Áo thun`, frontend lấy danh sách `Category.fitTypes` từ category nguồn `Áo` và hiển thị dưới dạng select. Variant chỉ lưu `fitTypeId`.

Nếu một fit type đã được product sử dụng, không nên xóa cứng khỏi category. Chỉ chuyển `isActive = false` để dữ liệu product cũ vẫn truy vết được.

## 2. Product Collection

`Product.variant` là mảng biến thể theo fit type. Mỗi variant chọn `fitTypeId` từ danh sách `Category.fitTypes` của category nguồn, sử dụng khuôn size và measurement của category nguồn, nhưng lưu giá trị measurement cụ thể riêng.

```ts
Product {
  _id: ObjectId,
  category_id: ObjectId,
  name: string,
  brand_id: ObjectId,
  variant: ProductVariant[],
  description: string,
  product_image: string,
  isActive: boolean,
  sold_quantity: number,
  averageRating: number,
  reviewCount: number,
  createdAt: Date,
  updatedAt: Date
}

ProductVariant {
  _id: ObjectId,
  fitTypeId: ObjectId,
  price: number,
  discount: number,
  colors: ColorVariant[],
  sizeMeasurements: VariantSizeMeasurement[],
  isActive: boolean
}

ColorVariant {
  _id: ObjectId,
  color: string,
  colorCode?: string,
  image: string
}

VariantSizeMeasurement {
  size: string,
  measurements: MeasurementValue[]
}

MeasurementValue {
  key: string,
  value: number
}
```

Ví dụ product:

```json
{
  "name": "Basic Cotton T-shirt",
  "category_id": "665000000000000000000001",
  "brand_id": "665000000000000000000002",
  "variant": [
    {
      "fitTypeId": "665000000000000000000101",
      "price": 199000,
      "discount": 10,
      "isActive": true,
      "colors": [
        {
          "color": "Black",
          "colorCode": "#000000",
          "image": "https://example.com/black.jpg"
        }
      ],
      "sizeMeasurements": [
        {
          "size": "S",
          "measurements": [
            { "key": "shoulder", "value": 40 },
            { "key": "chest", "value": 92 },
            { "key": "length", "value": 66 }
          ]
        },
        {
          "size": "M",
          "measurements": [
            { "key": "shoulder", "value": 42 },
            { "key": "chest", "value": 96 },
            { "key": "length", "value": 68 }
          ]
        }
      ]
    }
  ]
}
```

## 3. Cách áp dụng category khi tạo variant

Khi admin thêm variant:

1. Backend lấy `Product.category_id`.
2. Backend lấy category nguồn từ `Category.sizeTemplateSourceId`. Nếu chính category đang chọn là nguồn thì dùng category đó.
3. Backend trả về `fitTypes`, `sizes` và `measurementFields`.
4. Admin chọn một fit type có sẵn từ `Category.fitTypes`.
5. Frontend tự tạo bảng nhập liệu.
6. Admin chọn các size được bán và nhập measurement cụ thể cho từng size của fit type.
7. Backend validate và lưu `fitTypeId` cùng `Product.variant.sizeMeasurements`.

Ví dụ UI tự sinh:

| Size | Vai | Ngực | Dài áo |
|---|---:|---:|---:|
| S | 40 | 92 | 66 |
| M | 42 | 96 | 68 |
| L | 44 | 100 | 70 |
| XL | 46 | 104 | 72 |

Trong đó:

- Header bảng lấy từ `Category.measurementFields`.
- Các dòng size lấy từ `Category.sizes`.
- Danh sách fit type lấy từ `Category.fitTypes` đang active.
- Giá trị từng ô được lưu vào `Product.variant.sizeMeasurements`.
- Variant có thể chỉ sử dụng một phần size được category cho phép, ví dụ category hỗ trợ `S`, `M`, `L`, `XL` nhưng variant chỉ bán `M`, `L`.

## 4. Import Collection

`Import` lưu lịch sử nhập kho theo từng lô. Không lưu mảng import id trong `Product.variant`, vì `Import.variantId` đã đủ để truy vấn ngược.

```ts
Import {
  _id: ObjectId,
  productId: ObjectId,
  variantId: ObjectId,
  colorVariantId: ObjectId,
  detail: ImportDetail[],
  createdAt: Date,
  updatedAt: Date
}

ImportDetail {
  size: string,
  quantity: number,
  remainingQuantity: number,
  importPrice?: number
}
```

## 5. Inventory Collection

`Inventory` lưu tồn kho hiện tại đã tổng hợp từ phiếu nhập và các giao dịch kho.

```ts
Inventory {
  _id: ObjectId,
  productId: ObjectId,
  variantId: ObjectId,
  colorVariantId: ObjectId,
  size: string,
  sku: string,
  quantity: number,
  reservedQuantity: number,
  availableQuantity: number,
  updatedAt: Date
}
```

Mỗi dòng inventory duy nhất theo:

```txt
productId + variantId + colorVariantId + size
```

`Inventory.sku` là nguồn dữ liệu chính của SKU và phải unique toàn hệ thống. Không lưu lặp SKU trong `Import.detail`.

`Inventory.availableQuantity` được lưu để đọc nhanh nhưng luôn phải bằng `quantity - reservedQuantity`. Các thao tác giữ hàng, trả giữ hàng và trừ kho cần cập nhật atomic hoặc dùng transaction để tránh bán âm kho.

`ProductVariant.isActive` chỉ thể hiện admin có cho phép kinh doanh variant hay không. Trạng thái còn hàng phải suy ra từ `Inventory.availableQuantity > 0`.

## 6. Inventory Reservation

Không giữ hàng ngay khi thêm vào cart. Hệ thống chỉ giữ hàng khi bắt đầu checkout hoặc tạo order chờ thanh toán.

Có thể lưu reservation trong database hoặc dùng Redis TTL nếu thời gian giữ hàng ngắn.

```ts
InventoryReservation {
  _id: ObjectId,
  userId: ObjectId,
  orderId?: ObjectId | null,
  productId: ObjectId,
  variantId: ObjectId,
  colorVariantId: ObjectId,
  size: string,
  quantity: number,
  status: 'active' | 'committed' | 'released' | 'expired',
  expiresAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

Chỉ reservation có `status = 'active'` mới được commit hoặc release. Việc cập nhật trạng thái reservation và số lượng inventory cần thực hiện atomic hoặc trong cùng transaction.

## Validation quan trọng

- Product phải gắn với category lá.
- Category nguồn có `isSizeTemplateSource = true`.
- Category lá phải có `sizeTemplateSourceId` tham chiếu đến category nguồn hợp lệ.
- `sizeTemplateSourceId` của category lá phải tham chiếu đến chính nó hoặc một ancestor hợp lệ trong cây category.
- Khi tạo variant, backend phải lấy được category nguồn từ `sizeTemplateSourceId`.
- `Category.sizes` không được trùng giá trị.
- `Category.measurementFields.key` unique trong category nguồn.
- `Category.fitTypes.key` unique trong category nguồn và phải được chuẩn hóa, ví dụ `regular`, `slim`, `oversized`.
- `Product.variant.fitTypeId` phải tồn tại trong `Category.fitTypes` của category nguồn và fit type đó phải active.
- `Product.variant.fitTypeId` unique trong một product.
- `ProductVariant.sizeMeasurements.size` phải tồn tại trong `Category.sizes`.
- `ProductVariant.sizeMeasurements.size` unique trong một variant.
- `MeasurementValue.key` phải tồn tại trong `Category.measurementFields.key`.
- Mỗi size phải có đủ measurement field bắt buộc.
- Không được trùng measurement key trong cùng một size.
- `ColorVariant.color` unique trong một variant.
- `Import.detail.size` và `Inventory.size` phải tồn tại trong `Category.sizes`.
- `Import.detail.size` và `Inventory.size` phải tồn tại trong `ProductVariant.sizeMeasurements.size`.
- `Inventory` unique theo `productId + variantId + colorVariantId + size`.
- `Inventory.sku` unique toàn hệ thống.
- `Inventory.availableQuantity = Inventory.quantity - Inventory.reservedQuantity`.
- `InventoryReservation.expiresAt` bắt buộc có để tự động trả hàng đã giữ khi quá hạn.
- `InventoryReservation.status` chỉ chuyển từ `active` sang một trong các trạng thái `committed`, `released`, `expired`.
- `price > 0`.
- `discount` trong khoảng `0..100`.

## Ảnh hưởng collection liên quan

Các collection nghiệp vụ nên dùng camelCase và lưu đúng tổ hợp sản phẩm:

```ts
{
  productId: ObjectId,
  variantId: ObjectId,
  colorVariantId: ObjectId,
  size: string,
  sku: string
}
```

Áp dụng cho:

- Cart
- Order
- Review
- Import
- Inventory
- Inventory Reservation

## Luồng cập nhật tồn kho

- Khi nhập hàng: tạo `Import`, tăng `Inventory.quantity` và `Inventory.availableQuantity`.
- Khi thêm vào cart: chỉ kiểm tra còn hàng, không giữ hàng.
- Khi checkout hoặc tạo order chờ xử lý: tạo `InventoryReservation`, tăng `Inventory.reservedQuantity`, giảm `Inventory.availableQuantity`.
- Khi thanh toán thành công hoặc đơn được xác nhận: giảm `Inventory.quantity`, giảm `Inventory.reservedQuantity`.
- Khi hủy đơn, chưa thanh toán hoặc reservation hết hạn: giảm `Inventory.reservedQuantity`, tăng lại `Inventory.availableQuantity`.
- Khi cần truy vết giá vốn/lô hàng: đọc từ `Import`.
- Khi cần kiểm tra còn hàng để bán: đọc từ `Inventory`.

## AI hỗ trợ nhập measurement

Có thể bổ sung tính năng AI autofill để giảm thao tác nhập tay:

1. Admin nhập mô tả measurement dạng text.
2. Backend gửi text, `Category.sizes` và `Category.measurementFields` cho LLM.
3. LLM trả JSON `sizeMeasurements`.
4. Backend validate JSON theo quy định category.
5. Frontend tự động điền bảng.
6. Admin kiểm tra, sửa nếu cần và bấm lưu.

AI chỉ hỗ trợ điền form. Backend không lưu thẳng dữ liệu AI nếu admin chưa duyệt.

## Migration từ model hiện tại

Model hiện tại:

```ts
version: [
  {
    sku,
    color,
    fitType,
    size_spec: [{ size, shoulder, chest, length, weight, stock_quantity }],
    version_image,
    price,
    discount,
    import
  }
]
```

Hướng migrate:

- Đổi field `version` thành `variant`.
- Gom version cũ theo `fitType`.
- Mỗi `fitType` thành một item trong `variant`.
- Chuyển danh sách size hợp lệ và measurement key lên category nguồn.
- Tạo danh sách `Category.fitTypes` tại category nguồn.
- Map `fitType` cũ sang `Category.fitTypes._id` và lưu thành `variant.fitTypeId`.
- `size_spec.size` thành `variant.sizeMeasurements.size`.
- `shoulder`, `chest`, `length`, `weight` thành `measurements`.
- `color` và `version_image` thành `variant.colors.color` và `variant.colors.image`.
- Không giữ `variant.import`; dùng `Import.variantId` để truy vấn phiếu nhập.
- `size_spec.stock_quantity` dùng để tạo dữ liệu ban đầu cho `Import.detail.quantity`.
- Đồng thời tạo `Inventory.quantity` và `Inventory.availableQuantity`.
- Nên sinh SKU mới trong `Inventory.sku` theo từng `fitTypeId + color + size`.
