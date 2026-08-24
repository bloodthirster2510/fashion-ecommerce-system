# CDShop Fashion E-commerce System

Fashion E-commerce System là nền tảng thương mại điện tử thời trang gồm Mobile App, Web bán hàng và Web Admin, dùng chung một backend commerce và các service AI cho tìm kiếm hình ảnh, gợi ý sản phẩm và phối đồ ảo.

Dự án tập trung giải quyết bài toán bán lẻ thời trang end-to-end: khách hàng cần tìm đúng sản phẩm, mua hàng nhanh và theo dõi đơn rõ ràng; đội vận hành cần quản lý catalog, tồn kho, đơn hàng, khuyến mãi, hỗ trợ và dữ liệu kinh doanh trong một hệ thống thống nhất.

## Bài toán giải quyết

- Rút ngắn hành trình mua sắm thời trang: tìm kiếm, lọc sản phẩm, xem chi tiết, giỏ hàng, checkout, thanh toán, theo dõi đơn và đánh giá sau mua.
- Tăng khả năng khám phá sản phẩm bằng recommendation, lịch sử tương tác, visual search và virtual try-on.
- Chuẩn hóa vận hành sau bán: quản lý đơn, kho, coupon, loyalty, đánh giá, hỗ trợ khách hàng, thông báo và báo cáo.
- Tách rõ trải nghiệm khách hàng và công cụ quản trị nhưng vẫn dùng chung dữ liệu, API, quyền truy cập và luồng realtime.

## Phạm vi sản phẩm

### Mobile

Mobile app được xây bằng Expo/React Native, tập trung vào trải nghiệm mua sắm thường xuyên trên điện thoại.

- Trang chủ, danh mục, tìm kiếm, bộ lọc, chi tiết sản phẩm và gợi ý sản phẩm.
- Giỏ hàng, checkout, áp dụng voucher, COD/VNPay, quản lý đơn hàng và trạng thái giao hàng.
- Tài khoản, địa chỉ, phương thức thanh toán, hạng thành viên, yêu thích, đánh giá và thông báo đẩy.
- Trung tâm hỗ trợ gồm FAQ, tạo ticket, theo dõi ticket và realtime socket.
- Virtual try-on: chọn sản phẩm, tải ảnh người dùng, theo dõi hàng đợi xử lý, xem kết quả và lịch sử phối đồ.

### Web

Web customer được xây bằng React/Vite, là kênh bán hàng trên trình duyệt cho khách mua sắm và quản lý tài khoản.

- Trang chủ, catalog, trang sản phẩm, giỏ hàng, checkout, đơn hàng, review, chính sách và hỗ trợ.
- Đồng bộ authentication, cart, coupon, payment, shipping và profile với backend.
- Tích hợp recommendation/interaction tracking để phục vụ gợi ý sản phẩm và phân tích hành vi.
- Thiết kế tách layout khách hàng khỏi admin, giúp cùng một frontend repo nhưng không trộn vai trò người dùng.

### Web Admin

Web Admin là cổng vận hành cho quản trị viên và nhân sự cửa hàng.

- Dashboard doanh thu, đơn paid, giá trị đơn trung bình, khách quay lại, tồn kho rủi ro và việc cần xử lý.
- Quản lý sản phẩm, biến thể, danh mục, thương hiệu, visual search index và tồn kho.
- Vận hành đơn hàng, tra cứu hóa đơn, thanh toán, giao hàng, hoàn trả và đối soát.
- Quản lý khách hàng, tài khoản quản trị, phân quyền, loyalty, coupon, campaign và storefront settings.
- Kiểm duyệt review, xử lý support ticket, theo dõi notification summary, virtual try-on và báo cáo recommendation/search.

## Kiến trúc tổng quan

> Chèn hình architecture tổng thể tại đây.
>
> Gợi ý file: `docs/assets/architecture.png`

<!-- ![Architecture tổng thể](docs/assets/architecture.png) -->

Luồng chính của hệ thống:

- `mobile/` và `web_frontend/` gọi API qua backend Express/TypeScript.
- `backend/` quản lý auth, catalog, cart, order, payment, shipping, promotion, support, notification, recommendation, visual search và virtual try-on.
- MongoDB lưu dữ liệu nghiệp vụ; Redis/BullMQ phục vụ job bất đồng bộ; Socket.IO dùng cho realtime order/support/try-on/notification.
- `ai_services/visual_search` tạo embedding ảnh/text cho visual search bằng CLIP/FashionCLIP.
- `ai_services/image-validation` kiểm tra chất lượng ảnh người dùng trước khi try-on.
- `ai_services/garment-processing` tách vùng sản phẩm và ghép garment collage trước khi gửi sang workflow try-on.

## Giao diện chính

> Chèn một vài ảnh màn hình tiêu biểu tại đây.
>
> Gợi ý: ưu tiên 1 ảnh Mobile, 1 ảnh Web customer, 1 ảnh Web Admin dashboard và 1 ảnh tính năng AI.

<!--
![Mobile app](docs/assets/screens/mobile-home.png)
![Web customer](docs/assets/screens/web-home.png)
![Web admin dashboard](docs/assets/screens/admin-dashboard.png)
![Virtual try-on](docs/assets/screens/virtual-try-on.png)
-->

## Điểm kỹ thuật nổi bật

- Full-stack TypeScript ở backend và web frontend; mobile dùng React Native/Expo.
- Backend module hóa theo nghiệp vụ: auth, catalog, inventory, cart, orders, payments, shipping, promotions, reviews, support, notifications, users, recommendations, visual search và virtual try-on.
- Admin có phân quyền, audit log, notification summary, dashboard KPI và các màn hình vận hành thực tế.
- AI service tách riêng bằng FastAPI để dễ scale độc lập với commerce backend.
- Có test cho nhiều lớp: Jest backend, Playwright web, Jest Expo mobile, pytest cho AI services và benchmark offline cho recommendation/visual search.
- Docker Compose gom backend, web và các AI services để chạy môi trường tích hợp.

## Hướng phát triển

- Hoàn thiện production readiness: CI/CD, observability, backup, rate limit, hardening bảo mật và phân quyền chi tiết hơn.
- Mở rộng recommendation/visual search bằng dữ liệu hành vi thật, A/B testing và dashboard đo CTR/conversion.
- Tối ưu virtual try-on cho production: GPU inference, queue monitoring, threshold theo từng loại ảnh và benchmark catalog lớn hơn.
- Bổ sung báo cáo vận hành: dự báo tồn kho, hiệu quả campaign, cohort khách hàng và phân tích lợi nhuận theo sản phẩm.
- Tách rõ deployment cho customer web, admin web và mobile release nếu hệ thống đi vào vận hành thật.

## Công nghệ sử dụng

| Phần | Công nghệ chính |
| --- | --- |
| Mobile | Expo, React Native, React Navigation, Socket.IO client |
| Web / Admin | React, Vite, Redux Toolkit, TanStack Query, Ant Design, Playwright |
| Backend | Node.js, Express, TypeScript, Mongoose, JWT, BullMQ, Redis, Socket.IO |
| AI services | FastAPI, OpenCLIP/FashionCLIP, YOLO Pose, Grounding DINO, SAM |
| Tích hợp | VNPay, GHN shipping, Cloudinary, email, Docker Compose |

## Cấu trúc thư mục

```text
mobile/        Mobile app cho khách hàng
web_frontend/  Web customer và Web Admin
backend/       API, nghiệp vụ commerce, workers và scripts
ai_services/   Visual search, image validation, garment processing
evaluation/    Benchmark recommendation và visual search
docs/          Tài liệu phân hệ và kế hoạch triển khai
ops/           Script triển khai và systemd service
```

## Try-on development

From the backend folder, run the local try-on dev stack:

```powershell
cd backend
npm run dev:try-on
```

This starts the backend plus the local image validation and garment processing services. ComfyUI still needs to be opened separately when testing the real Comfy provider.
