# Garment Processing Service

FastAPI service for product-image preprocessing before virtual try-on.

It does two jobs before ComfyUI:

- Extract the requested garment region from a product image using the selected `role`.
- Compose the extracted garments into one white-background collage image.

The service uses a hybrid extraction pipeline:

- Transparent PNGs use the lightweight Pillow/NumPy heuristic to locate a crop.
- Opaque images use Grounding DINO to locate the requested garment role.
- SAM 2.1 tightens and validates the garment region from the selected detection
  box.
- Every output is a rectangular crop from the original image, preserving
  garment texture instead of cutting pixels around hands, hair, or occlusion.
- A simple-background image may fall back to the heuristic if the model cannot
  find a garment.
- Complex images fail closed instead of sending a contaminated image to ComfyUI.

Both models run locally. No third-party inference API is called.

## Run locally

```powershell
cd ai_services/garment-processing
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python scripts/download_models.py
uvicorn app.main:app --host 0.0.0.0 --port 7002
```

`download_models.py` writes checkpoints under `models/huggingface/`. The folder
is ignored by Git. Docker downloads the same pinned model IDs while building the
image, so the first request does not download anything.

## API

```http
GET /health
POST /extract-garment
POST /compose-collage
POST /prepare-collage
```

Use `/prepare-collage` for the app flow:

```json
{
  "items": [
    { "imageBase64": "...", "role": "top" },
    { "imageBase64": "...", "role": "bottom" }
  ],
  "layout": "auto",
  "width": 768,
  "height": 768,
  "backgroundColor": "#ffffff"
}
```

The response returns `imageBase64` as a PNG garment collage. Send that collage to
ComfyUI as the single `garmentImage`. Each extracted item also returns
`isUsable`, `warnings`, and `issues` so the backend can fallback or stop before
sending a broken collage to ComfyUI.

## Kế hoạch xử lý ảnh ghép cho ComfyUI

Mục tiêu của service này là biến danh sách sản phẩm người dùng đã chọn thành
một ảnh PNG nền trắng, sạch và thống nhất để đưa vào ComfyUI. ComfyUI chỉ cần
nhận `personImage` và một `garmentImage` đã được chuẩn bị sẵn, thay vì phải tự
tách áo, quần, váy hoặc giày/dép từ nhiều ảnh sản phẩm khác nhau.

### Luồng xử lý đề xuất

1. Mobile gửi các sản phẩm đã chọn về backend, kèm vai trò của từng ảnh:
   `top`, `outerwear`, `bottom`, `dress`, hoặc `shoes`.
2. Backend tải ảnh catalog, chuyển thành base64 và gọi `/prepare-collage`.
3. Garment service chuẩn hóa ảnh đầu vào: đọc orientation, chuyển RGBA, giới
   hạn kích thước theo `maxLongEdge`.
4. Với từng ảnh, service tách vùng sản phẩm theo thứ tự ưu tiên:
   - Nếu ảnh PNG có alpha, dùng alpha mask.
   - Nếu ảnh có nền trắng hoặc nền đơn giản, ước lượng nền từ bốn góc và lấy
     foreground.
   - Nếu ảnh là nguyên set hoặc ảnh người mẫu, dùng `role` để crop vùng phù
     hợp, ví dụ chỉ lấy áo từ ảnh có cả áo và quần.
   - Về sau có thể thay bước heuristic bằng segmentation model như
     GroundingDINO + SAM, human parsing, hoặc model tự huấn luyện.
5. Service kiểm tra kết quả tách: vùng bbox có hợp lệ không, alpha có bị rỗng
   không, confidence có quá thấp không, ảnh có quá nhỏ hoặc quá nhiễu không.
6. Các item hợp lệ được sắp xếp theo vai trò và ghép vào một canvas trắng
   768x768. Ảnh ghép không nên có chữ hoặc nhãn vì ComfyUI có thể học nhầm chữ
   trong ảnh.
7. Backend nhận `imageBase64`, upload ảnh ghép này lên ComfyUI và map vào input
   `garmentImage` của workflow.
8. ComfyUI thực hiện bước cuối: ghép ảnh người mặc với ảnh sản phẩm đã được
   chuẩn bị.

### Quy tắc layout

- `single`: một sản phẩm, đặt giữa canvas.
- `top_bottom`: áo/áo khoác và quần, chia hai cột để ComfyUI nhìn rõ từng món.
- `full_set`: từ ba món trở lên, hoặc có giày/dép; áo/quần ở vùng chính, giày
  đặt ở vùng thấp hơn.
- `horizontal`: fallback khi vai trò không tạo thành bộ rõ ràng.

Thứ tự hiển thị nên ổn định: áo, áo khoác, váy, quần, giày/dép. Phụ kiện chưa
được dùng trong luồng mobile hiện tại; schema còn giữ `accessory` để tương
thích hoặc mở rộng sau.

### Ma trận trường hợp cần xử lý

| Trường hợp ảnh sản phẩm | Cách xử lý mong muốn | Trạng thái |
| --- | --- | --- |
| PNG nền trong suốt | Dùng alpha mask, crop phần có alpha | Đã có |
| Sản phẩm nền trắng/nền đơn giản | Tách foreground từ màu nền ước lượng | Đã có |
| Ảnh chỉ có áo/quần/váy/giày | Tách toàn bộ sản phẩm rồi căn giữa | Đã có mức MVP |
| Ảnh có cả áo và quần nhưng chỉ chọn áo | Dùng `role=top` để crop nửa trên | Đã có mức MVP |
| Ảnh có cả áo và quần nhưng chỉ chọn quần | Dùng `role=bottom` để crop nửa dưới | Đã có mức MVP |
| Ảnh giày/dép | Giữ toàn foreground, không crop theo cơ thể | Đã có |
| Ảnh người mẫu mặc sản phẩm | Grounding DINO tìm role, SAM 2.1 xác định vùng crop | Đã có |
| Ảnh nền phức tạp | Dùng Grounded SAM, không dùng heuristic | Đã có |
| Áo trắng trên nền trắng | Dùng Grounded SAM; từ chối nếu sản phẩm bị crop | Đã có |
| Nhiều sản phẩm trong cùng một ảnh | Chọn box theo role; giày cho phép tối đa hai box | Đã có mức MVP |
| Ảnh quá nhỏ hoặc crop mất sản phẩm | Trả warning/fail để mobile/backend xử lý | Đã có mức MVP |
| Ảnh mờ nhưng vẫn tách được foreground | Cần thêm blur/quality check riêng | Cần nâng cấp |

### Trạng thái triển khai

- Đã có contract trả về warning/fail cho từng item:
  `empty_mask`, `small_bbox`, `tiny_image`, `low_confidence`,
  `ambiguous_foreground`, `garment_not_detected`, `model_unavailable`,
  `model_inference_failed`, `model_low_confidence`, `model_mask_area_invalid`,
  `truncated_garment`.
- Đã có test fixture cho áo product-only, quần product-only, ảnh nguyên set,
  giày/dép, PNG alpha và ảnh rỗng.
- Đã có heuristic phân biệt product-only với ảnh nguyên set ở mức MVP, dựa trên
  tỉ lệ khung hình và độ khác màu giữa vùng trên/dưới.
- Đã tinh chỉnh layout `full_set` để giày/dép nằm ở hàng thấp riêng và không
  chồng lên áo/quần.
- Backend đã đọc `isUsable`: khi service tách hỏng thì không gửi collage lỗi
  vào ComfyUI. Nếu bật fail-open, backend fallback về ảnh catalog gốc.
- Đã có provider Grounding DINO + SAM 2.1 chạy local và hybrid router. Provider
  được tải một lần rồi tái sử dụng cho các request sau.
- Model được provision bằng script lúc setup và lúc Docker build, không tải ở
  request đầu.
- Benchmark hiện tại đạt 7/8 ảnh khó; ảnh còn lại được từ chối đúng vì sản phẩm
  bị crop khỏi khung hình.

### Mốc tiếp theo

1. Backend quyết định chính sách fail-open/fail-closed theo môi trường: khi
   service tách kém thì cho dùng
   ảnh gốc, chặn tạo ảnh, hoặc yêu cầu người dùng chọn ảnh khác.
2. Mobile hiển thị lỗi cụ thể hơn nếu backend trả về item không tách được.
3. Thêm blur/quality check riêng cho ảnh sản phẩm nếu catalog cho phép upload
   ảnh tự do.
4. Mở rộng benchmark lên ít nhất 100 ảnh theo từng role trước khi chốt threshold
   production.
5. Nếu Grounded SAM vẫn sai nhiều trên catalog thực tế, dùng mask đã duyệt để
   tạo dữ liệu huấn luyện YOLO segmentation riêng.

### Tiêu chí hoàn thành

- Với một sản phẩm, service tạo được ảnh sản phẩm sạch trên nền trắng.
- Với áo + quần hoặc áo/quần + giày/dép, service tạo được một ảnh ghép chung
  đúng vai trò, đúng thứ tự và không có chữ.
- Nếu ảnh đầu vào không đủ tốt để tách, response phải có tín hiệu rõ để backend
  và mobile xử lý.
- Backend luôn chỉ gửi một `garmentImage` cuối cùng vào ComfyUI.

## Backend configuration

```env
VIRTUAL_TRY_ON_GARMENT_PROCESSING_URL=http://127.0.0.1:7002/prepare-collage
VIRTUAL_TRY_ON_GARMENT_PROCESSING_TIMEOUT_MS=30000
VIRTUAL_TRY_ON_GARMENT_PROCESSING_FAIL_OPEN=false
```

When this URL is set and the Comfy workflow map contains `garmentImage`, the
backend sends selected catalog images to this service first, uploads the returned
collage to ComfyUI, then maps that file to the workflow's garment input.

## Model configuration

```env
GARMENT_PROCESSING_PROVIDER=hybrid
GARMENT_DETECTOR_MODEL_ID=IDEA-Research/grounding-dino-tiny
GARMENT_SEGMENTER_MODEL_ID=facebook/sam2.1-hiera-tiny
GARMENT_MODEL_CACHE_DIR=./models/huggingface
GARMENT_MODEL_LOCAL_FILES_ONLY=true
GARMENT_MODEL_DEVICE=auto
GARMENT_MODEL_WARMUP_ON_START=false
GARMENT_DETECTOR_BOX_THRESHOLD=0.2
GARMENT_DETECTOR_TEXT_THRESHOLD=0.2
GARMENT_MIN_MODEL_CONFIDENCE=0.3
```

- `hybrid`: heuristic cho PNG alpha, Grounded SAM cho ảnh opaque, fallback chỉ
  khi nền thật sự đơn giản.
- `grounded_sam`: bắt buộc dùng model và không fallback.
- `heuristic`: chế độ nhẹ để test hoặc xử lý catalog đã chuẩn hóa sẵn.
- Service luôn crop vùng áo/quần/giày từ ảnh gốc. Mask chỉ dùng để xác định
  bounding box và đánh giá chất lượng; service không xóa nền.
- Docker bật `GARMENT_MODEL_WARMUP_ON_START=true`. Local để `false` nhằm khởi
  động nhanh; request model đầu tiên sẽ load checkpoint đã có trên máy, nhưng
  không tải mạng.
- Máy không có GPU vẫn chạy được bằng CPU, nhưng chậm hơn đáng kể. Production
  nên dùng GPU và preload model.

## Tests

```powershell
cd ai_services/garment-processing
pytest
```

## Sample ảnh từ catalog

Bộ ảnh đã chọn để test nằm tại:

```text
samples/selected-yody-cleanest/
```

Các file chính:

- `top-navy-polo-product.webp`: áo product-only nền sạch.
- `bottom-slim-jeans-clean.webp`: quần rõ nhất trong catalog hiện tại; ảnh vẫn
  có một phần người mẫu.
- `shoes-black-sneaker-product.webp`: giày product-only nền trắng.
- `collage-full-set.png`: kết quả tách và ghép ba món.
- `processing-report.json`: method, confidence, warning và bbox của từng món.

## Bộ ảnh khó từ catalog

Bộ regression cho ảnh người mẫu, nền phức tạp và ảnh có nhiều vật thể nằm tại:

```text
samples/challenging-yody-cases/
```

- `contact-sheet.jpg`: so sánh ảnh nguồn và kết quả tách.
- `automated-report.json`: kết quả mà service tự đánh giá.
- `contact-grounded-sam.jpg`: kết quả sau khi thêm Grounding DINO + SAM 2.1.
- `grounded-sam-report.json`: confidence, bbox và issue của provider mới.
- `collage-grounded-sam-full-set.png`: ảnh ghép `top + bottom + shoes` dùng làm
  đầu vào `garmentImage` cho ComfyUI.
- `RESULTS.md`: kết quả kiểm tra bằng mắt và giới hạn đã xác nhận.

Kết quả ngày 2026-07-09:

- Heuristic báo 8/8 dùng được nhưng cả 8 đều không đạt khi kiểm tra bằng mắt.
- Grounded SAM tách đúng 7/8 ảnh.
- Ảnh còn lại bị crop mất áo; service trả `truncated_garment` và
  `isUsable=false`, không gửi ảnh lỗi sang ComfyUI.

## Current limitations

- CPU inference is suitable for development but not ideal for production latency.
- Rectangular crop có thể giữ lại tay, chân hoặc nền nằm sát sản phẩm; đổi lại không
  làm thủng texture của món đồ.
- Role prompts and thresholds still need validation on a larger catalog benchmark.
- This service does not run the final try-on; ComfyUI still handles `person + garment collage`.
