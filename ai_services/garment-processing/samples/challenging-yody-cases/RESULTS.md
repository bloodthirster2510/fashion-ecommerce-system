# Kết quả thử ảnh khó

Ngày chạy: 2026-07-09

## Phạm vi

Bộ này lấy 8 ảnh thật từ catalog YODY để kiểm tra các tình huống mà heuristic
tách nền đơn giản dễ đánh giá sai:

- Người mẫu mặc nguyên bộ trên nền phức tạp.
- Áo trắng gần màu nền hoặc bị crop sát.
- Ảnh quần có thêm áo, túi, tay, giày và người mẫu.
- Giày đang được mang hoặc chụp cùng nhiều đạo cụ.

Ảnh nguồn và ảnh tách được đặt cạnh nhau trong `contact-sheet.jpg`. Kết quả máy
đọc được nằm trong `automated-report.json`.

## Kết quả

| Ca thử | Máy đánh giá | Kiểm tra bằng mắt | Lý do chưa đạt |
| --- | --- | --- | --- |
| `top-small-person-busy-background` | Dùng được, có cảnh báo | Không đạt | Giữ cả người và phần lớn nền |
| `top-full-outfit-busy-background` | Dùng được | Không đạt | Giữ người, quần/váy, túi và nền |
| `top-white-cropped-model` | Dùng được | Không đạt | Áo bị dính cơ thể, tay và mất chi tiết vải trắng |
| `bottom-lower-body-with-bag` | Dùng được, có cảnh báo | Không đạt | Giữ túi, tay, giày và nền |
| `bottom-full-body-busy-background` | Dùng được, có cảnh báo | Không đạt | Giữ cả thân trên, người và nền |
| `shoes-worn-with-legs` | Dùng được | Không đạt | Giữ chân, váy và vật trang trí |
| `shoes-with-many-props` | Dùng được, có cảnh báo | Không đạt | Giữ máy ảnh, đồng hồ, ví, chữ và nền |
| `shoes-worn-flatlay-with-props` | Dùng được | Không đạt | Giữ mỹ phẩm, giấy và vật trang trí |

## Kết luận

Heuristic hiện tại phù hợp với ảnh sản phẩm riêng lẻ, nền trắng hoặc nền đơn
giản. Nó chưa đủ để xử lý ảnh người mẫu, nền phức tạp hoặc nhiều vật thể.

`confidence` hiện đo độ phủ foreground trong vùng crop, không đo việc vùng đó có
đúng là áo, quần hoặc giày hay không. Vì vậy ảnh sai vẫn có thể đạt confidence
cao và trả `isUsable=true`.

Trước khi dùng các ảnh khó trong production, cần thêm detector/segmentation theo
vai trò sản phẩm. Hướng nâng cấp phù hợp là GroundingDINO + SAM, hoặc human
parsing dành cho thời trang. Sau đó chạy lại chính bộ ảnh này làm regression
benchmark.

## Kết quả sau khi thêm Grounded SAM

| Ca thử | Kết quả | Ghi chú |
| --- | --- | --- |
| `top-small-person-busy-background` | Đạt | Crop đúng vùng áo dài màu trắng |
| `top-full-outfit-busy-background` | Đạt | Crop đúng áo thay vì váy sau khi lọc vị trí theo role |
| `top-white-cropped-model` | Từ chối đúng | Áo bị cắt khỏi khung; trả `truncated_garment` |
| `bottom-lower-body-with-bag` | Đạt | Crop vùng quần, không lấy toàn thân người mẫu |
| `bottom-full-body-busy-background` | Đạt | Crop đúng vùng quần dài |
| `shoes-worn-with-legs` | Đạt | Crop sát vùng hai chiếc giày |
| `shoes-with-many-props` | Đạt | Crop đôi giày, loại phần lớn đạo cụ ngoài box |
| `shoes-worn-flatlay-with-props` | Đạt | Crop vùng hai chiếc giày; còn vật nằm giữa box |

Grounded SAM đạt 7/8 ảnh dùng được. Ca còn lại không bị false-positive mà được
chặn trước khi ghép collage. Kết quả chi tiết nằm trong
`grounded-sam-report.json` và `contact-grounded-sam.jpg`.

Đầu ra mặc định là `box_crop`: SAM dùng để xác định biên và kiểm tra chất lượng,
nhưng ảnh trả về là crop chữ nhật từ ảnh gốc. Cách này giữ texture tốt hơn
pixel-mask khi áo/quần bị tay, tóc hoặc phụ kiện che.
