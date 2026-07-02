# Lưu Ý Sau Khi Triển Khai Image Validation

Ghi nhận các điểm phát hiện khi test/review triển khai image validation (backend + mobile).
Trạng thái: đã chạy typecheck/lint/test pass, nhưng có vài điểm cần theo dõi khi cắm provider thật hoặc scale.

## 1. Service override kết quả provider (defense in depth)

`applyImageValidationPolicy` (virtual-try-on.service.ts) chạy thêm policy layer sau khi provider trả result: check `safetyFlags`, `quality.* === 'fail'`, `personCount`, `mainPersonScore`, `bodyVisibility`.

Hệ quả:
- Provider trả `allowed: true` + `safetyFlags: []` nhưng `bodyVisibility: 'partial'` → service override thành `BODY_NOT_VISIBLE`.
- Service là **nguồn quyết định cuối**, provider chỉ cung cấp signal.

Đây là chủ ý (defense in depth) cho MVP. Khi cắm provider thật cần ghi rõ trong `image-validation-du-lieu.md` mục 6 rằng service layer có quyền override.

## 2. Tải lại buffer từ Cloudinary mỗi createJob

`downloadImageValidationBuffer` tải lại ảnh từ URL Cloudinary để validate ở mỗi `createJob`.

Hệ quả:
- Nếu validation fail → tải thừa, tốn bandwidth + latency.
- Volume cao sẽ nhân lên cost Cloudinary + thời gian tạo job.

Cách xử lý khi cần tối ưu:
- Cache buffer theo `assetId` (in-memory LRU hoặc Redis).
- Hoặc validate ngay lúc upload (nhưng mất lợi ích biết outfitMode — xem mục 6.1 tài liệu).
- Ưu tiên thấp ở MVP, theo dõi khi traffic tăng.

## 3. Env blur/brightness chưa được wire

`.env.example` có:
- `IMAGE_VALIDATION_BLUR_THRESHOLD=100`
- `IMAGE_VALIDATION_BRIGHTNESS_MIN=40`
- `IMAGE_VALIDATION_BRIGHTNESS_MAX=220`

Nhưng mock provider và `applyImageValidationPolicy` **chưa đọc** 2 env này — mock chỉ check resolution.

Lý do OK ở MVP: mock không tính blur/brightness thật.

Lưu ý khi cắm provider thật:
- Nếu provider (`cloud_vision`/`local_pretrained`) tự tính blur/brightness và trả `quality.blur/brightness` → service dùng kết quả đó, env này chỉ là config cho provider đó.
- Nếu provider KHÔNG tự tính → service phải tự tính từ buffer (variance of Laplacian cho blur, brightness trung bình). Khi đó mới wire env này vào service.

## 4. Test integration cho validateSourceImageForJob

Đã bổ sung test integration cho flow `createJob` tại:

```text
backend/src/modules/virtual-try-on/__tests__/virtual-try-on.image-validation.test.ts
```

Các case đã cover:
- Mock provider trả fail (`NO_PERSON_DETECTED`) → `createJob` throw `VirtualTryOnServiceError` đúng `reasonCode` + HTTP status (422).
- `IMAGE_VALIDATION_FAIL_OPEN=true` + provider throw → tạo job bình thường + log warn.
- `IMAGE_VALIDATION_FAIL_OPEN=false` + provider throw → throw `VALIDATION_PROVIDER_FAILED` (503).
- `IMAGE_VALIDATION_PROVIDER=disabled` → skip validation, tạo job bình thường.

Test mock `axios.get` để không gọi network thật và dùng mock provider qua env.

## 5. Mobile chưa test Alert hiển thị thực tế

Code map 10 `errorCode` → Alert `{ title, message }` trong `VirtualTryOnBuilderScreen.tsx` đúng, nhưng chưa có test (snapshot/integration) verify Alert render.

Với React Native thường test manual, chấp nhận được ở MVP. Nếu sau này có jest + RNTL nên thêm test:
- Throw `VirtualTryOnApiError` với từng `errorCode` → verify Alert title/message đúng mapping.

## 6. custom_model provider gửi imageBase64

`custom-model-image-validation.provider.ts` gửi `imageBase64` thay vì URL.

Lưu ý:
- Base64 tăng payload ~33% so với binary.
- Endpoint custom_model phải chấp nhận JSON lớn (axios dùng `maxBodyLength: Infinity`).
- Nếu ảnh lớn (>5MB) → payload >6.6MB, cân nhắc gửi URL thay vì base64 khi model có thể fetch được.

Không phải bug, là trade-off quyền riêng tư (không lộ URL Cloudinary) vs bandwidth.

## 7. Thứ tự kiểm tra trong applyImageValidationPolicy

Thứ tự hiện tại:
1. safetyFlags → IMAGE_POLICY_BLOCKED (403)
2. resolution fail → IMAGE_TOO_SMALL (422)
3. blur fail → IMAGE_TOO_BLURRY (422)
4. brightness fail → IMAGE_TOO_DARK (422)
5. personCount/score → NO_PERSON_DETECTED (422)
6. personCount > 1 → MULTIPLE_PEOPLE_DETECTED (422)
7. bodyVisibility partial → BODY_NOT_VISIBLE (422)

Lưu ý:
- Ảnh vừa mờ vừa không có người → trả `IMAGE_TOO_BLURRY` trước (theo thứ tự), không phải `NO_PERSON_DETECTED`.
- Có thể user quan tâm hơn đến "không có người" hơn "mờ". Nếu muốn ưu tiên person check trước quality, đảo thứ tự 1-4 xuống dưới 5.
- Quyết định current: kiểm tra quality trước vì ảnh mờ/tối thì person detection cũng không đáng tin → báo quality trước hợp lý cho provider thật.

## Tổng kết

| # | Mức ưu tiên | Hành động |
|---|---|---|
| 1 | Thấp | Ghi rõ service override vào tài liệu khi cắm provider thật |
| 2 | Thấp (MVP) | Cache buffer khi traffic tăng |
| 3 | Trung bình | Wire env blur/brightness khi cắm local_pretrained |
| 4 | Đã xử lý | Đã thêm test integration `validateSourceImageForJob` qua `createJob` |
| 5 | Thấp | Test Alert mobile khi có RNTL |
| 6 | Thấp | Đánh giá URL vs base64 cho custom_model |
| 7 | Thấp | Confirm thứ tự priority check |

Trạng thái chung: triển khai đúng spec, chạy được, an toàn cho MVP. Các lưu ý chủ yếu liên quan giai đoạn cắm provider thật hoặc scale.
