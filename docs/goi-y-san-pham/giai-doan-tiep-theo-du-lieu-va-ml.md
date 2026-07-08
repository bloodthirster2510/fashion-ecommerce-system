# Giai đoạn tiếp theo: Thu thập dữ liệu và huấn luyện ML

## 1. Mục tiêu

Giai đoạn này bắt đầu sau khi API, tracking và giao diện mobile của recommendation
đã hoạt động. Mục tiêu là:

1. Xây dựng catalog đủ lớn và có thuộc tính sạch.
2. Thu thập interaction thật, có thể truy vết và không bị ghi trùng.
3. Xuất dataset theo thời gian, tránh rò rỉ dữ liệu.
4. Huấn luyện và so sánh model ML với baseline rule-based hiện tại.
5. Chỉ đưa model vào hệ thống khi tốt hơn baseline và vẫn có fallback.

Phạm vi chỉ là **gợi ý sản phẩm** trên backend và mobile. Không bao gồm web frontend.

## 2. Trạng thái trước khi bắt đầu

Đã hoàn thành:

- `UserProductInteraction`: lưu `view`, `search`, `favorite`, `add_to_cart`, `purchase`.
- `RecommendationRequest`: lưu danh sách recommendation server đã phát.
- `RecommendationEvent`: lưu impression, click và conversion đã được xác thực.
- Chống trùng event theo `requestId + productId + eventType`.
- Impression chỉ gửi khi khu vực recommendation đi vào viewport mobile.
- Guest interaction được gắn vào user khi đăng nhập bằng cùng `sessionId`.
- Attribution được giữ từ recommendation đến cart và order.
- API personal, similar, cart recommendation.
- Backfill favorite/cart/order cũ.
- Đánh giá HitRate, Precision, Recall, MAP, NDCG, Coverage, Diversity và chỉ số online.

Chưa hoàn thành:

- Chưa có catalog đủ lớn.
- Chưa có interaction thật đủ để train collaborative filtering/ranking.
- Chưa có script export dataset.
- Chưa có project Python để train, lưu artifact và so sánh model.
- Chưa có model ML production.

Dataset 64 sản phẩm trong `docs/local-scraped-catalog` chỉ là dữ liệu thử crawler,
không được xem là dataset chính thức.

## 3. Hai nguồn dữ liệu phải tách riêng

### 3.1. Dữ liệu catalog

Dùng cho content-based recommendation:

- Product, category, gender, brand.
- Tên và mô tả.
- Màu sắc, fit type, chất liệu nếu có.
- Giá, discount, rating, review count.
- Ảnh sản phẩm.
- Trạng thái active và tồn kho.

Crawl catalog giúp model hiểu **sản phẩm giống nhau thế nào**, nhưng không cho biết
**user nào thích sản phẩm nào**.

### 3.2. Dữ liệu hành vi

Dùng cho cá nhân hóa và collaborative filtering:

- `view`: tín hiệu yếu.
- `search`: tín hiệu theo keyword/filter.
- `favorite`: tín hiệu quan tâm.
- `add_to_cart`: tín hiệu mua mạnh.
- `purchase`: tín hiệu mạnh nhất.
- `impression`: sản phẩm đã thực sự được hiển thị.
- `click`: phản ứng với recommendation.

Không được tạo dữ liệu hành vi giả rồi báo cáo như dữ liệu người dùng thật.
Synthetic data chỉ dùng để test pipeline.

## 4. Giai đoạn A - Chuẩn hóa crawler catalog

### 4.1. Việc cần làm trước khi crawl

- Chọn nguồn được phép sử dụng và kiểm tra điều khoản/robots/rate limit.
- Không crawl thông tin cá nhân hoặc nội dung không phục vụ catalog.
- Di chuyển crawler dùng chính thức ra khỏi `docs/` vì thư mục này đang bị Git ignore.
- Đặt crawler vào thư mục được version control, ví dụ:

```text
tools/catalog-crawler/
  src/
  config/
  raw/
  normalized/
  reports/
```

- Không import thẳng dữ liệu vừa crawl vào database production.

### 4.2. Pipeline catalog

```text
Source
-> crawl raw
-> lưu source URL + thời điểm crawl
-> normalize
-> map taxonomy nội bộ
-> validate
-> deduplicate
-> review báo cáo
-> import staging
-> mới import database chính
```

Mỗi sản phẩm normalized cần tối thiểu:

```text
source
sourceProductId
sourceUrl
name
description
category
gender
brand
variants
colors
sizes
price
discount
images
isActive
scrapedAt
```

### 4.3. Kiểm tra chất lượng catalog

- Không trùng `source + sourceProductId`.
- Không trùng URL canonical.
- Tên, category, giá và ít nhất một ảnh phải hợp lệ.
- Giá không âm; discount trong khoảng hợp lệ.
- Category phải map được vào taxonomy nội bộ.
- Màu/size phải normalize về cùng từ điển.
- Loại sản phẩm hết hàng hoặc inactive khỏi candidate pool.
- Ghi báo cáo số record hợp lệ, bị loại và lý do bị loại.

Mốc khuyến nghị để thử content-based có ý nghĩa:

- Tối thiểu khoảng 500 sản phẩm active.
- Nên có từ 1.000 sản phẩm trở lên.
- Mỗi nhóm category chính nên có đủ số lượng để tạo top-K đa dạng.

Số lượng không thay thế chất lượng. Catalog lớn nhưng thiếu category/màu/giá sạch
sẽ làm content similarity kém.

## 5. Giai đoạn B - Thu thập interaction thật

Sau khi catalog ổn định:

1. Chạy backfill dữ liệu lịch sử một lần.
2. Cho mobile chạy tracking trong môi trường test/staging.
3. Kiểm tra event trong database hằng ngày trong tuần đầu.
4. Sau khi tracking ổn định mới bắt đầu cửa sổ thu dữ liệu chính thức.

Lệnh hiện có:

```powershell
cd backend
npm run recommendations:backfill -- --dry-run
npm run recommendations:backfill
npm run recommendations:evaluate -- --days=30 --orders=100 --k=8
```

Không chạy backfill nhiều lần để “tăng data”. Backfill đã idempotent; việc nhân bản
interaction sẽ làm sai trọng số.

### 5.1. Kiểm tra dữ liệu hằng ngày

- Tỷ lệ request có impression.
- Click phải thuộc product đã phát trong cùng request.
- Không có event trùng.
- Không có `userId` và `sessionId` rỗng cùng lúc.
- Rank nằm trong danh sách đã phát.
- Score/algorithmVersion lấy từ server, không lấy theo client.
- Purchase phải có order tương ứng và không phát sinh do retry request.
- Theo dõi số event theo context: home, product detail, cart.
- Theo dõi tỷ lệ fallback.

### 5.2. Mốc dữ liệu để chọn model

Các mốc dưới đây là gate thực nghiệm, không phải cam kết chất lượng:

| Mức dữ liệu | Hướng xử lý |
|---|---|
| Catalog đủ, interaction còn ít | Giữ content-based + popularity + rule-based |
| Khoảng 500 user, 300 product, 10.000 positive interactions | Bắt đầu thử item-item collaborative filtering |
| Khoảng 50.000 interaction có impression/click/conversion | Thử learning-to-rank nhẹ |
| Dữ liệu vẫn quá sparse | Không ép train model phức tạp; tiếp tục baseline |

Nên thu tối thiểu 4-8 tuần để có yếu tố thời gian. Không dùng số lượng event đơn
lẻ làm tiêu chí duy nhất; cần kiểm tra số user/product có đủ tương tác.

## 6. Giai đoạn C - Export dataset

Script dự kiến, **chưa được triển khai**:

```text
backend/src/scripts/recommendation-export-dataset.ts
```

Lệnh dự kiến:

```powershell
npm run recommendations:export -- --from=2026-07-01 --to=2026-08-31
```

Output dự kiến:

```text
ml/recommendation/data/processed/
  products.jsonl
  interactions.jsonl
  recommendation-events.jsonl
  train.jsonl
  validation.jsonl
  test.jsonl
  dataset-summary.json
```

Quy tắc export:

- Dùng `userId`; nếu chưa đăng nhập thì dùng identity ẩn danh từ `sessionId`.
- Không xuất email, số điện thoại, địa chỉ hoặc token.
- Loại event lỗi, trùng, bot/spam và product không tồn tại.
- Loại purchase từ order cancelled/returned khi tạo ground truth.
- Giữ `algorithmVersion`, context, rank và timestamp.
- Lưu dataset version, query range và thời điểm export.
- Không sửa trực tiếp file dataset đã dùng cho một lần train; tạo version mới.

## 7. Giai đoạn D - Chia tập dữ liệu

Phải chia theo thời gian, không random toàn bộ interaction:

```text
Train: dữ liệu cũ nhất
Validation: dữ liệu kế tiếp
Test: dữ liệu mới nhất
```

Gợi ý:

```text
70% train
15% validation
15% test
```

Hoặc dùng leave-last-N-out:

- Interaction cũ của user dùng để train.
- Một hoặc nhiều interaction gần nhất dùng làm validation/test.

Không để interaction tương lai của cùng user lọt vào train vì sẽ gây data leakage.

## 8. Giai đoạn E - Huấn luyện

### 8.1. Baseline bắt buộc

Luôn giữ kết quả của:

1. Newest.
2. Popularity.
3. Content-based hiện tại.
4. Hybrid rule-based v1 hiện tại.

ML chỉ được chấp nhận khi so sánh được với các baseline này.

### 8.2. Model 1 - Content-based

Có thể làm ngay khi catalog đủ lớn:

- One-hot/multi-hot cho category, gender, brand, color, fit type, price bucket.
- TF-IDF cho tên/mô tả sau khi làm sạch tiếng Việt.
- Cosine similarity.
- Precompute top-N sản phẩm tương tự cho mỗi product.

Model này xử lý tốt product cold-start và không cần nhiều user.

### 8.3. Model 2 - Item-item collaborative filtering

Chỉ làm khi interaction đủ:

- Tạo user-item implicit matrix.
- Dùng trọng số view/search/favorite/cart/purchase.
- Áp dụng time decay.
- Tính item-item similarity hoặc implicit ALS.
- Loại sản phẩm user đã mua gần đây và sản phẩm không còn bán.

Ưu tiên item-item trước user-user vì ổn định hơn với ecommerce catalog.

### 8.4. Model 3 - Hybrid ranking

Ghép các feature:

```text
content score
collaborative score
user preference score
popularity
business score
context
```

Model nhẹ phù hợp:

- Logistic regression.
- Gradient boosted trees.
- LightGBM/XGBoost nếu sau này chấp nhận thêm dependency.

Chưa cần deep learning hoặc embedding ảnh trong vòng đầu.

## 9. Đánh giá model

Offline:

- HitRate@K.
- Precision@K.
- Recall@K.
- MAP@K.
- NDCG@K.
- Catalog Coverage.
- Category Diversity@K.

Online:

- CTR = click / impression.
- AddToCartRate = add_to_cart / impression.
- ConversionRate = purchase / impression.
- FallbackRate.
- API p95 latency.

Phải báo cáo theo từng context, không gộp Home, Product Detail và Cart thành một số.

Model đạt gate khi:

- Tốt hơn baseline trên NDCG/Recall hoặc mục tiêu chính đã chọn.
- Coverage/diversity không giảm bất thường.
- Không tăng fallback và latency quá ngưỡng.
- Không làm hỏng cold-start.

## 10. Artifact và tích hợp backend

Cấu trúc dự kiến:

```text
ml/recommendation/
  requirements.txt
  src/
    prepare.py
    train_content.py
    train_item_item.py
    evaluate.py
  configs/
  artifacts/
  reports/
```

Mỗi artifact cần:

```text
modelVersion
datasetVersion
trainedAt
featureVersion
metrics
parameters
productIds
```

Không để backend phụ thuộc trực tiếp vào notebook hoặc pickle không version.
Vòng đầu nên export top-N similarity/model output sang JSON hoặc collection MongoDB
để Node.js đọc ổn định.

Khi tích hợp:

- Model mới có `algorithmVersion` riêng.
- Có feature flag để bật/tắt.
- Rule-based v1 luôn là fallback.
- Không thay model production nếu chưa qua offline evaluation.

## 11. Thứ tự triển khai đề xuất

1. Chuyển crawler chính thức ra khỏi `docs/` và version control.
2. Crawl/normalize catalog lớn hơn, chạy quality report.
3. Import staging và kiểm tra recommendation v1.
4. Thu interaction thật trong 4-8 tuần.
5. Viết script export dataset có version.
6. Train content-based và so sánh baseline.
7. Khi đủ interaction, train item-item collaborative filtering.
8. Thử hybrid ranking nếu item-item đem lại tín hiệu tốt.
9. Import artifact/precomputed result vào backend.
10. Chạy shadow evaluation trước khi bật cho người dùng.

## 12. Điều kiện dừng

Không bắt đầu train collaborative filtering nếu:

- Catalog còn thay đổi ID hàng loạt.
- Interaction chưa được xác thực hoặc còn ghi trùng.
- Số user/product có interaction quá ít.
- Không tạo được train/validation/test theo thời gian.
- Chưa có baseline và script đánh giá tái lập được.

Trong các trường hợp đó, tiếp tục dùng hybrid rule-based hiện tại và tập trung thu
dữ liệu sạch. Dữ liệu ít nhưng đúng hữu ích hơn dữ liệu lớn bị nhiễu.
