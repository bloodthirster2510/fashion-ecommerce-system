# Đánh giá người dùng cho gợi ý Cart

Phần này bổ sung nhãn chất lượng phối đồ mà Amazon Fashion không cung cấp. Đây
là thí nghiệm cần người tham gia thật; không được điền dữ liệu giả rồi trình bày
như kết quả khảo sát.

## Thiết kế

- Chọn trước ít nhất 20 giỏ hàng đại diện, mỗi giỏ có 1–3 sản phẩm.
- Với mỗi giỏ, tạo hai danh sách Top-5 trên cùng candidate set: công thức v5 và
  association-lift baseline.
- Gán ngẫu nhiên hai phương pháp thành mã A/B cho từng người tham gia, đồng thời
  hoán đổi thứ tự hiển thị để giảm position bias. Người đánh giá không biết mã
  nào là hệ thống đề xuất.
- Tuyển tối thiểu 20 người đúng nhóm người dùng mục tiêu. Mỗi người đánh giá cả
  hai danh sách của cùng kịch bản để có so sánh paired.
- Mỗi sản phẩm được chấm `relevance_rating` và
  `outfit_compatibility_rating` từ 1 (rất kém) đến 5 (rất tốt), cùng lựa chọn
  `would_add_to_cart` là 0/1.
- Giữ file ánh xạ A/B riêng cho đến khi khóa dữ liệu và chạy phân tích.

Chỉ tiêu chính được chọn trước là trung bình `outfit_compatibility_rating`.
Chỉ tiêu phụ gồm Precision@5 với nhãn phù hợp >= 4 và tỷ lệ có ý định thêm vào
giỏ. Báo cáo số người, số kịch bản, cách tuyển mẫu và mọi trường hợp bị loại.

## Ghi và phân tích dữ liệu

Sao chép `cart-ratings-template.csv` thành `cart-ratings.csv`, mỗi dòng tương
ứng một sản phẩm được chấm. Không commit file có mã định danh cá nhân; nên dùng
mã ngẫu nhiên như `P001`.

Từ thư mục `backend/`, chạy:

```powershell
npm run recommendations:user-study:analyze -- --input=../evaluation/recommendation/user-study/cart-ratings.csv
```

Script kiểm tra thang điểm, tính kết quả theo mã phương pháp và so sánh paired
giữa A/B. Sau đó mới giải mù mã phương pháp để viết nhận xét. Với cỡ mẫu nhỏ,
trình bày đây là đánh giá có kiểm soát mang tính thăm dò, không suy rộng thành
kết luận cho toàn bộ người dùng.
