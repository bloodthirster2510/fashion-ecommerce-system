# Visual Search Embedding Service

Service này phục vụ tuần 2 của tính năng tìm kiếm sản phẩm bằng hình ảnh.

Mục tiêu hiện tại:

- Cung cấp endpoint `/health`.
- Cung cấp endpoint `/embed/image-url` cho script backfill visual index.
- Cung cấp endpoint `/embed/image` cho API upload ảnh ở tuần 3.
- Cung cấp endpoint `/embed/text` cho text-to-image search bằng cùng embedding space của FashionCLIP.
- Mặc định dùng backend `mock` để kiểm tra luồng dữ liệu khi chưa cài FashionCLIP/OpenFashionCLIP.
- Có thể đổi sang backend `open_clip` để chạy model thật sau khi cài thêm dependency model.

Chạy thử:

```bash
cd ai_services/visual_search
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8001
```

Chạy model thật bằng OpenCLIP/FashionCLIP:

```bash
cd ai_services/visual_search
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
pip install -r requirements-model.txt
set VISUAL_EMBEDDING_BACKEND=open_clip
set VISUAL_EMBEDDING_MODEL=openfashionclip
set VISUAL_EMBEDDING_VERSION=v2
set VISUAL_OPEN_CLIP_MODEL=hf-hub:Marqo/marqo-fashionCLIP
set VISUAL_OPEN_CLIP_PRETRAINED=
uvicorn app:app --host 127.0.0.1 --port 8001
```

Biến môi trường chính:

```text
VISUAL_EMBEDDING_BACKEND=mock
VISUAL_EMBEDDING_MODEL=openfashionclip
VISUAL_EMBEDDING_VERSION=v2
VISUAL_EMBEDDING_MOCK_DIMENSION=64
VISUAL_EMBEDDING_DEVICE=auto
VISUAL_OPEN_CLIP_MODEL=hf-hub:Marqo/marqo-fashionCLIP
VISUAL_OPEN_CLIP_PRETRAINED=
```

Ghi chú:

Backend `mock` chỉ dùng để kiểm chứng pipeline. Backend `open_clip` sẽ load model một lần khi có request embedding đầu tiên, sau đó tái sử dụng model cho các request sau.
Với Marqo FashionCLIP, nên truyền `hf-hub:Marqo/marqo-fashionCLIP` trực tiếp vào `VISUAL_OPEN_CLIP_MODEL`.

Khi backend Node.js đổi sang provider HTTP:

```text
VISUAL_EMBEDDING_PROVIDER=http
VISUAL_EMBEDDING_SERVICE_URL=http://localhost:8001
VISUAL_EMBEDDING_MODEL=openfashionclip
VISUAL_EMBEDDING_VERSION=v2
```

Sau đó cần chạy lại:

```bash
npm run visual-search:backfill-index -- --active-only
```

Thử text-to-image search qua backend Node.js:

```bash
curl -X POST http://localhost:5000/api/products/visual-search/text \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"áo polo trắng nam\",\"limit\":10}"
```

Ghi chú: text search dùng chính visual index đã backfill từ ảnh sản phẩm. Không cần tạo index riêng nếu `VISUAL_EMBEDDING_MODEL` và `VISUAL_EMBEDDING_VERSION` trùng với index hiện có.

Lưu ý: lần đầu chạy `open_clip` có thể cần tải pretrained weights từ internet.
