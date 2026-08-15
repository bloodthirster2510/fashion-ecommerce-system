# Visual Search Embedding Service

Service này phục vụ tuần 2 của tính năng tìm kiếm sản phẩm bằng hình ảnh.

Mục tiêu hiện tại:

- Cung cấp endpoint `/health`.
- Cung cấp endpoint `/embed/image-url` cho script backfill visual index.
- Cung cấp endpoint `/embed/image` cho API upload ảnh ở tuần 3.
- Cung cấp endpoint `/embed/text` cho text-to-image search bằng cùng embedding space của FashionCLIP.
- Dùng backend `open_clip` cho các model OpenCLIP/Marqo.
- Dùng backend `transformers` cho FashionCLIP 2.0 hoặc model Hugging Face hỗ trợ `get_image_features`/`get_text_features`.

Chạy thử model thật:

```bash
cd ai_services/visual_search
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
pip install -r requirements-model.txt
uvicorn app:app --host 127.0.0.1 --port 8001
```

Chạy bằng OpenCLIP/Marqo FashionCLIP hoặc FashionSigLIP:

```bash
cd ai_services/visual_search
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
pip install -r requirements-model.txt
set VISUAL_EMBEDDING_BACKEND=open_clip
set VISUAL_EMBEDDING_MODEL=marqo-fashionSigLIP
set VISUAL_EMBEDDING_VERSION=v1
set VISUAL_OPEN_CLIP_MODEL=hf-hub:Marqo/marqo-fashionSigLIP
set VISUAL_OPEN_CLIP_PRETRAINED=
uvicorn app:app --host 127.0.0.1 --port 8001
```

Chạy bằng Transformers/FashionCLIP 2.0:

```bash
cd ai_services/visual_search
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
pip install -r requirements-model.txt
set VISUAL_EMBEDDING_BACKEND=transformers
set VISUAL_EMBEDDING_MODEL=fashionclip-2.0
set VISUAL_EMBEDDING_VERSION=v1
set VISUAL_TRANSFORMERS_MODEL=patrickjohncyh/fashion-clip
uvicorn app:app --host 127.0.0.1 --port 8001
```

Chạy Marqo FashionCLIP cũ qua OpenCLIP:

```bash
set VISUAL_EMBEDDING_BACKEND=open_clip
set VISUAL_EMBEDDING_MODEL=openfashionclip
set VISUAL_EMBEDDING_VERSION=v2
set VISUAL_OPEN_CLIP_MODEL=hf-hub:Marqo/marqo-fashionCLIP
set VISUAL_OPEN_CLIP_PRETRAINED=
uvicorn app:app --host 127.0.0.1 --port 8001
```

Biến môi trường chính:

```text
VISUAL_EMBEDDING_BACKEND=open_clip
VISUAL_EMBEDDING_MODEL=openfashionclip
VISUAL_EMBEDDING_VERSION=v2
VISUAL_EMBEDDING_DEVICE=auto
VISUAL_OPEN_CLIP_MODEL=hf-hub:Marqo/marqo-fashionCLIP
VISUAL_OPEN_CLIP_PRETRAINED=
VISUAL_TRANSFORMERS_MODEL=patrickjohncyh/fashion-clip
```

Ghi chú:

Backend `open_clip` và `transformers` sẽ load model một lần khi có request embedding đầu tiên, sau đó tái sử dụng model cho các request sau.
Với Marqo FashionCLIP, nên truyền `hf-hub:Marqo/marqo-fashionCLIP` trực tiếp vào `VISUAL_OPEN_CLIP_MODEL`.

Khi backend Node.js đổi sang provider HTTP:

```text
VISUAL_EMBEDDING_PROVIDER=http
VISUAL_EMBEDDING_SERVICE_URL=http://localhost:8001
VISUAL_EMBEDDING_MODEL=marqo-fashionSigLIP
VISUAL_EMBEDDING_VERSION=v1
```

Sau đó cần chạy lại:

```bash
npm run visual-search:backfill-index -- --active-only --model=marqo-fashionSigLIP --model-version=v1 --embedding-service-url=http://127.0.0.1:8001
```

Thử text-to-image search qua backend Node.js:

```bash
curl -X POST http://localhost:5000/api/products/visual-search/text \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"áo polo trắng nam\",\"limit\":10}"
```

Ghi chú: text search dùng chính visual index đã backfill từ ảnh sản phẩm. Không cần tạo index riêng nếu `VISUAL_EMBEDDING_MODEL` và `VISUAL_EMBEDDING_VERSION` trùng với index hiện có.

Lưu ý: lần đầu chạy `open_clip` hoặc `transformers` có thể cần tải pretrained weights từ internet. Khi đổi model/backend, cần backfill lại index vì dimension và embedding space có thể khác nhau.

## Chạy thực nghiệm 3 mô hình

Phần này dùng để so sánh CLIP gốc, Marqo FashionCLIP và FashionCLIP 2.0 trên cùng pipeline visual search.

Có hai cách thực nghiệm:

- Qua catalog/MongoDB visual index: cần backfill một bộ index logic riêng cho từng mô hình.
- Qua query/gallery CSV offline: không cần MongoDB visual index, chỉ cần cache embedding riêng cho từng mô hình.

Không cần tạo 3 collection riêng trong MongoDB. Collection `ProductVisualIndex` hiện tách index bằng bộ khóa `embeddingModel`, `embeddingVersion` và `embeddingDimension`, nên các model có thể cùng tồn tại trong một collection.

Khuyến nghị đặt tên index:

```text
clip-vit-b-32   + v1
openfashionclip + v2
fashionclip-2.0 + transformers-v1
```

Lưu ý: dù hai model cùng trả vector 512 chiều, vẫn không được dùng chung index vì embedding space khác nhau. Query embedding của model nào phải so với gallery/index được tạo bởi chính model đó.

### 1. Cài dependency

```bash
cd ai_services/visual_search
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
pip install -r requirements-model.txt
```

### 2. Chạy embedding service theo từng mô hình

Chỉ chạy một mô hình tại một thời điểm trên port `8001`. Khi đổi mô hình, dừng `uvicorn` hiện tại rồi chạy lại với nhóm biến môi trường mới.

CLIP gốc:

```bash
set VISUAL_EMBEDDING_BACKEND=open_clip
set VISUAL_EMBEDDING_MODEL=clip-vit-b-32
set VISUAL_EMBEDDING_VERSION=v1
set VISUAL_OPEN_CLIP_MODEL=ViT-B-32
set VISUAL_OPEN_CLIP_PRETRAINED=openai
uvicorn app:app --host 127.0.0.1 --port 8001
```

Marqo FashionCLIP:

```bash
set VISUAL_EMBEDDING_BACKEND=open_clip
set VISUAL_EMBEDDING_MODEL=openfashionclip
set VISUAL_EMBEDDING_VERSION=v2
set VISUAL_OPEN_CLIP_MODEL=hf-hub:Marqo/marqo-fashionCLIP
set VISUAL_OPEN_CLIP_PRETRAINED=
uvicorn app:app --host 127.0.0.1 --port 8001
```

FashionCLIP 2.0:

```bash
set VISUAL_EMBEDDING_BACKEND=transformers
set VISUAL_EMBEDDING_MODEL=fashionclip-2.0
set VISUAL_EMBEDDING_VERSION=transformers-v1
set VISUAL_TRANSFORMERS_MODEL=patrickjohncyh/fashion-clip
uvicorn app:app --host 127.0.0.1 --port 8001
```

### 3. Cấu hình backend Node.js

Trong terminal backend, đặt `VISUAL_EMBEDDING_MODEL` và `VISUAL_EMBEDDING_VERSION` khớp với service Python đang chạy.

```bash
cd backend
set VISUAL_EMBEDDING_PROVIDER=http
set VISUAL_EMBEDDING_SERVICE_URL=http://127.0.0.1:8001
set VISUAL_EMBEDDING_MODEL=clip-vit-b-32
set VISUAL_EMBEDDING_VERSION=v1
```

Ví dụ khi đổi sang FashionCLIP 2.0:

```bash
set VISUAL_EMBEDDING_MODEL=fashionclip-2.0
set VISUAL_EMBEDDING_VERSION=transformers-v1
```

Backend lọc visual index theo `embeddingModel`, `embeddingVersion` và `embeddingDimension`, nên mỗi mô hình cần có index riêng.

Khi chạy script thực nghiệm, nên truyền model trực tiếp bằng CLI như ở bước backfill bên dưới. Cách này override `.env` và tránh trường hợp `.env` vẫn đang để `openfashionclip/v2`.

### 4. Backfill visual index

Chạy lại backfill sau mỗi lần đổi mô hình.

CLIP gốc:

```bash
npm run visual-search:backfill-index -- --active-only ^
  --model=clip-vit-b-32 ^
  --model-version=v1 ^
  --embedding-service-url=http://127.0.0.1:8001
```

Marqo FashionCLIP:

```bash
npm run visual-search:backfill-index -- --active-only ^
  --model=openfashionclip ^
  --model-version=v2 ^
  --embedding-service-url=http://127.0.0.1:8001
```

FashionCLIP 2.0:

```bash
npm run visual-search:backfill-index -- --active-only ^
  --model=fashionclip-2.0 ^
  --model-version=transformers-v1 ^
  --embedding-service-url=http://127.0.0.1:8001
```

Sau khi backfill đủ 3 mô hình, admin/status có thể thấy nhiều dòng trong `modelBreakdown`; đó là trạng thái đúng. Khi chạy tìm kiếm hoặc evaluation qua catalog, backend chỉ lấy các document khớp đúng `VISUAL_EMBEDDING_MODEL`, `VISUAL_EMBEDDING_VERSION` và dimension của query embedding.

Output backfill phải hiện đúng model vừa truyền. Ví dụ FashionCLIP 2.0 phải có:

```json
{
  "model": "fashionclip-2.0",
  "modelVersion": "transformers-v1",
  "provider": "http"
}
```

Nếu output vẫn hiện `openfashionclip/v2`, nghĩa là lệnh đang chưa truyền `--model`/`--model-version`, hoặc đang chạy bản build cũ. Chạy lại `npm run build` hoặc dùng script npm `visual-search:backfill-index` để build trước khi chạy.

### 5. Chạy evaluation offline

Build backend trước khi chạy script trong `dist`.

```bash
cd backend
npm run build
```

Sau đó chạy evaluation cho từng mô hình, đổi `--method` và `--output` tương ứng.

CLIP gốc:

```bash
node dist/scripts/visual-search-deepfashion-evaluate-offline.js ^
  --method clip-vit-b-32 ^
  --embedding-service-url http://127.0.0.1:8001 ^
  --output docs_vs/deepfashion-subset/results-clip.csv
```

Marqo FashionCLIP:

```bash
node dist/scripts/visual-search-deepfashion-evaluate-offline.js ^
  --method openfashionclip ^
  --embedding-service-url http://127.0.0.1:8001 ^
  --output docs_vs/deepfashion-subset/results-fashionclip.csv
```

FashionCLIP 2.0:

```bash
node dist/scripts/visual-search-deepfashion-evaluate-offline.js ^
  --method fashionclip-2.0-transformers-v1 ^
  --embedding-service-url http://127.0.0.1:8001 ^
  --output docs_vs/deepfashion-subset/results-fashionclip-2.csv
```

Nếu chỉ muốn đánh giá nhanh một phần dữ liệu, thêm `--max-queries 20`. Khi chạy lại nhiều lần, nên dùng cache riêng cho từng model để tránh trộn embedding:

```bash
--cache docs_vs/deepfashion-subset/embedding-cache-fashionclip-2.json
```

### 6. Đánh giá trực tiếp trên tập query và gallery

Nếu đã có sẵn một file gallery và một file query label, dùng script offline để mã hóa toàn bộ ảnh gallery, mã hóa từng ảnh query, rồi xếp hạng bằng cosine similarity. Cách này không phụ thuộc vào MongoDB visual index của catalog, phù hợp để so sánh mô hình trên cùng một bộ dữ liệu cố định.

File gallery cần các cột tối thiểu:

```csv
galleryImageId,productId,imagePath,imageSource,productName,categoryName
gallery_001,product_001,docs_vs/query-images/product_001.jpg,catalog,Ao polo nam,Shirts_Polos
gallery_002,product_002,docs_vs/query-images/product_002.jpg,catalog,Quan jean nam,Denim
```

File query label cần các cột tối thiểu:

```csv
queryId,queryImagePath,expectedProductIds,relevantProductIds
query_001,docs_vs/query-images/query_001.jpg,product_001,product_003|product_004
query_002,docs_vs/query-images/query_002.jpg,product_002,
```

Ý nghĩa:

- `galleryImageId`: id duy nhất của ảnh trong gallery.
- `productId`: id sản phẩm dùng để tính đúng/sai khi retrieval.
- `imagePath`: đường dẫn ảnh local, tính từ thư mục `backend` hoặc repo root.
- `expectedProductIds`: sản phẩm đúng nhất cho query.
- `relevantProductIds`: sản phẩm liên quan có thể chấp nhận được, phân tách bằng `|`, `;`, `,` hoặc khoảng trắng.

Ví dụ chạy CLIP gốc trên bộ query/gallery riêng:

```bash
cd backend
npm run build
node dist/scripts/visual-search-deepfashion-evaluate-offline.js ^
  --gallery docs_vs/visual-search-gallery.csv ^
  --labels docs_vs/visual-search-query-labels.csv ^
  --method clip-vit-b-32 ^
  --embedding-service-url http://127.0.0.1:8001 ^
  --output docs_vs/results-query-gallery-clip.csv ^
  --detail-output docs_vs/details-query-gallery-clip.csv ^
  --cache docs_vs/embedding-cache-query-gallery-clip.json
```

Chạy Marqo FashionCLIP:

```bash
node dist/scripts/visual-search-deepfashion-evaluate-offline.js ^
  --gallery docs_vs/visual-search-gallery.csv ^
  --labels docs_vs/visual-search-query-labels.csv ^
  --method openfashionclip ^
  --embedding-service-url http://127.0.0.1:8001 ^
  --output docs_vs/results-query-gallery-fashionclip.csv ^
  --detail-output docs_vs/details-query-gallery-fashionclip.csv ^
  --cache docs_vs/embedding-cache-query-gallery-fashionclip.json
```

Chạy FashionCLIP 2.0:

```bash
node dist/scripts/visual-search-deepfashion-evaluate-offline.js ^
  --gallery docs_vs/visual-search-gallery.csv ^
  --labels docs_vs/visual-search-query-labels.csv ^
  --method fashionclip-2.0-transformers-v1 ^
  --embedding-service-url http://127.0.0.1:8001 ^
  --output docs_vs/results-query-gallery-fashionclip-2.csv ^
  --detail-output docs_vs/details-query-gallery-fashionclip-2.csv ^
  --cache docs_vs/embedding-cache-query-gallery-fashionclip-2.json
```

Các tham số hữu ích:

- `--limit=10`: số kết quả top K dùng để chấm.
- `--max-queries=20`: chạy thử nhanh trên N query đầu.
- `--score-threshold=0.2`: bỏ các ảnh gallery có điểm thấp hơn ngưỡng.
- `--output`: file tổng hợp chỉ số `recallAt1`, `recallAt5`, `recallAt10`, `precisionAt5`, `precisionAt10`, `mrr`, `ndcgAt10`, latency.
- `--detail-output`: file chi tiết từng query, gồm danh sách `returnedProductIds` và `firstRelevantRank`.
- `--cache`: cache embedding theo model để lần chạy sau không phải mã hóa lại toàn bộ ảnh.

Trước mỗi lần chạy, kiểm tra `/health` của embedding service để chắc đúng model:

```bash
curl http://127.0.0.1:8001/health
```

Nếu `model`, `modelVersion` hoặc `backend` không đúng mô hình đang đánh giá, dừng `uvicorn`, đặt lại biến môi trường và chạy lại service.
