# Báo cáo tình hình thực hiện dự án Fashion E-commerce

Ngày cập nhật: 24/06/2026

## 1. Tổng quan dự án

Dự án là hệ thống thương mại điện tử bán hàng thời trang, gồm 3 phần chính:

- Backend API: xử lý nghiệp vụ, lưu trữ dữ liệu, phân quyền, thanh toán, vận chuyển, khuyến mãi, đơn hàng, chăm sóc khách hàng.
- Web frontend: gồm giao diện khách hàng và trang quản trị cho nhân viên/admin.
- Mobile app: ứng dụng React Native/Expo cho khách hàng, có luồng mua hàng, tài khoản, đơn hàng và hỗ trợ.

Trạng thái hiện tại: dự án đã vượt qua giai đoạn khởi tạo. Hệ thống đã có nhiều module nghiệp vụ thật, có cấu trúc database, API, giao diện web/mobile và bộ test cho các phần quan trọng. Tuy nhiên, dự án vẫn ở trạng thái phát triển, cần tiếp tục kiểm thử tổng thể, đồng bộ UI/UX và ổn định cấu hình môi trường trước khi có thể xem là sẵn sàng triển khai chính thức.

**Giải thích khi trình bày:**

Dự án này mô phỏng một hệ thống bán hàng thời trang hoàn chỉnh. Người dùng có thể xem sản phẩm, lọc theo danh mục/thương hiệu/giá/size, thêm sản phẩm vào giỏ hàng, áp dụng voucher, đặt hàng, thanh toán, theo dõi đơn hàng và gửi yêu cầu hỗ trợ. Ở phía cửa hàng, admin hoặc nhân viên có thể quản lý sản phẩm, danh mục, kho, đơn hàng, khách hàng, khuyến mãi, đánh giá và ticket hỗ trợ.

Điểm chính cần nhấn mạnh là hệ thống được chia thành nhiều lớp: frontend web/mobile chịu trách nhiệm hiển thị và tương tác; backend chịu trách nhiệm kiểm tra dữ liệu, xử lý nghiệp vụ và bảo vệ hệ thống; database lưu thông tin người dùng, sản phẩm, đơn hàng, thanh toán, kho, khuyến mãi và hỗ trợ; các dịch vụ ngoài như Cloudinary, VNPay, GHN hỗ trợ upload ảnh, thanh toán và vận chuyển. Cách chia này giúp hệ thống dễ mở rộng, ví dụ sau này thêm app mobile mới hoặc thêm kênh bán hàng khác vẫn có thể dùng chung backend API.

Khi trình bày kỹ hơn, có thể nói dự án đang giải quyết hai nhóm nhu cầu. Nhóm thứ nhất là nhu cầu của khách hàng: tìm sản phẩm nhanh, xem thông tin rõ, đặt hàng thuận tiện, theo dõi đơn hàng và nhận hỗ trợ khi có vấn đề. Nhóm thứ hai là nhu cầu vận hành của cửa hàng: quản lý danh mục, sản phẩm, kho, đơn hàng, khuyến mãi, khách hàng và nhân viên. Nếu chỉ làm giao diện mua hàng mà không có phần quản trị thì hệ thống chưa đủ để vận hành thực tế; ngược lại, nếu chỉ có quản trị mà không có trải nghiệm khách hàng thì chưa phải một hệ thống e-commerce hoàn chỉnh.

Có thể dùng câu nói mẫu: "Dự án không chỉ dừng ở trang bán hàng, mà hướng tới một hệ thống vận hành đầy đủ. Khách hàng có luồng mua hàng riêng, còn cửa hàng có trang quản trị để xử lý dữ liệu thật phía sau."

## 2. Công nghệ và kiến trúc

Backend:

- Node.js, Express, TypeScript.
- MongoDB/Mongoose để quản lý dữ liệu.
- JWT, bcryptjs cho xác thực và bảo mật tài khoản.
- Helmet, CORS, rate limit để tăng lớp bảo vệ API.
- Multer và Cloudinary cho upload hình ảnh.
- Socket.IO cho tính năng realtime, đặc biệt liên quan đến hỗ trợ khách hàng.
- Jest và mongodb-memory-server cho unit test/e2e test.

Web frontend:

- React, TypeScript, Vite.
- Redux Toolkit và React Redux cho state quan trọng như auth/cart.
- Ant Design cho một số thành phần giao diện quản trị.
- Playwright cho e2e test một số luồng web.

Mobile:

- Expo, React Native, TypeScript.
- React Navigation cho điều hướng màn hình.
- Expo Secure Store, Notifications, Auth Session, Image Picker cho các tính năng mobile.

Kiến trúc code hiện tại chia theo module nghiệp vụ. Backend có router tổng ở `backend/src/routes/index.ts`, tách riêng route khách hàng và route admin. Web frontend tách theo feature: auth, catalog, cart, orders, profile, admin, support. Mobile tách theo feature tương tự: home, catalog, cart, account, orders, coupons, favorites, support.

**Giải thích khi trình bày:**

Có thể giải thích kiến trúc theo hướng: mỗi phần trong dự án có trách nhiệm riêng. Backend là nơi quyết định nghiệp vụ, không để frontend tự tính những dữ liệu quan trọng như giá, giảm giá, tồn kho hoặc quyền thao tác. Web và mobile chỉ gọi API và hiển thị kết quả. Cách tổ chức theo module giúp khi cần sửa một mảng như catalog, đơn hàng hoặc khuyến mãi thì không phải đụng quá nhiều phần không liên quan.

Backend được đặt ở trung tâm vì đây là nơi có quyền truy cập database và tích hợp dịch vụ ngoài. Ví dụ khi khách đặt hàng, frontend có thể gửi danh sách sản phẩm và mã giảm giá, nhưng backend mới là nơi kiểm tra sản phẩm còn hoạt động không, giá hiện tại là bao nhiêu, tồn kho có đủ không, voucher có hợp lệ không và người dùng có quyền sử dụng voucher đó không. Điều này giúp hạn chế trường hợp người dùng tự sửa dữ liệu trên trình duyệt để nhận giá sai hoặc giảm giá sai.

Về tổ chức code, cách chia theo module giúp dự án dễ bảo trì. Module catalog xử lý danh mục, thương hiệu, sản phẩm; module orders xử lý đơn hàng; module payments xử lý thanh toán; module promotions xử lý coupon và campaign. Khi một chức năng có lỗi, nhóm phát triển có thể khoanh vùng theo module thay vì phải đọc toàn bộ codebase.

## 3. Tình hình thực hiện theo phân hệ

### 3.1 Xác thực, tài khoản và phân quyền

Đã có các phần:

- Đăng ký, đăng nhập, quản lý phiên đăng nhập.
- Hỗ trợ refresh session cho admin.
- Phân quyền admin/staff/user.
- Phân quyền chi tiết theo permission, ví dụ `catalog.read`, `catalog.write`.
- Quản lý nhân sự/tài khoản quản trị trong admin.
- Bước đổi mật khẩu bắt buộc cho một số tài khoản admin.

**Giải thích khi trình bày:**

Hệ thống không chỉ kiểm tra role, mà còn kiểm tra permission. Role cho biết người dùng là admin, staff hay user; permission cho biết người đó được làm gì trong từng module. Ví dụ nhân viên kho có thể xem/cập nhật tồn kho, nhân viên chăm sóc khách hàng có thể xử lý ticket hỗ trợ, nhân viên marketing có thể quản lý khuyến mãi, còn admin có thể quản lý tài khoản và phân quyền. Cách làm này an toàn và thực tế hơn so với việc cấp toàn quyền cho mọi nhân viên.

Luồng xác thực có thể hiểu theo 3 bước. Bước 1, người dùng đăng nhập và backend kiểm tra tài khoản/mật khẩu. Bước 2, backend cấp token hoặc khôi phục session để frontend biết người dùng là ai. Bước 3, khi người dùng gọi API quan trọng, middleware sẽ kiểm tra token, role và permission trước khi cho phép xử lý tiếp.

Ví dụ cụ thể: một nhân viên có thể đăng nhập được vào admin, nhưng nếu không có `catalog.write` thì không được tạo hoặc xóa danh mục. Nếu chỉ có `catalog.read`, nhân viên đó chỉ được xem dữ liệu. Cách này tránh rủi ro một nhân viên không liên quan vô tình sửa sản phẩm, xóa danh mục hoặc thay đổi khuyến mãi.

Khi báo cáo, có thể nhấn mạnh: "Phân quyền trong dự án được thiết kế theo hướng vận hành thực tế. Không phải ai vào được admin cũng có toàn quyền, mà quyền được chia theo từng nghiệp vụ."

### 3.2 Catalog: danh mục, thương hiệu, sản phẩm

Đây là phần đã được phát triển khá sâu.

Đã có:

- Quản lý danh mục sản phẩm theo cây cha-con.
- Quản lý danh mục theo giới tính: `male`, `female`, `unisex`.
- Upload và chuẩn hóa ảnh danh mục/sản phẩm qua Cloudinary.
- Quản lý thương hiệu.
- Quản lý sản phẩm, biến thể sản phẩm, màu sắc, size, form dáng.
- Bộ template size/form đo theo danh mục.
- API riêng cho khách hàng và admin.
- Test cho service danh mục, sản phẩm, brand.

Phần danh mục hiện tại có nhiều logic quan trọng:

- Khi tạo danh mục con, `level` được tính theo danh mục cha, không tin hoàn toàn giá trị frontend gửi lên.
- Danh mục con kế thừa `gender` từ danh mục cha để tránh cây danh mục bị lệch logic.
- Có kiểm tra vòng lặp cây danh mục, tránh trường hợp A là cha của B nhưng lại gán B làm cha của A.
- Có giới hạn độ sâu cây danh mục tối đa 10 cấp.
- Có chống trùng danh mục theo bộ `name + parent_id + gender`.
- Có soft delete bằng `isActive = false`.
- Khi danh mục còn sản phẩm đang bán, hệ thống không cho ngừng/xóa ngay nếu chưa xác nhận ảnh hưởng đến sản phẩm.
- Xóa vĩnh viễn chỉ cho phép khi danh mục không còn danh mục con, không còn sản phẩm, không được dùng làm size template, và không nằm trong khuyến mãi đang hiệu lực.

**Giải thích khi trình bày:**

Với sản phẩm thời trang, catalog phức tạp hơn sản phẩm thông thường. Một chiếc áo hoặc đôi giày không chỉ có tên và giá, mà còn có nhiều size, màu, form dáng, ảnh theo từng màu và bảng số đo riêng. Vì vậy hệ thống tách thành category để phân nhóm sản phẩm, brand để quản lý thương hiệu, product để lưu thông tin chính, variant để lưu biến thể, measurement fields để mô tả số đo như vai/ngực/dài áo/eo, và fit types để mô tả kiểu mặc như regular, slim, oversize.

Danh mục được tổ chức theo dạng cây, ví dụ "Nam > Áo > Áo sơ mi". Vì có quan hệ cha-con, backend phải đảm bảo không tạo vòng lặp, không cho danh mục làm cha của chính nó, tự tính cấp danh mục và kiểm tra danh mục con/sản phẩm liên quan khi xóa. Có thể nói ngắn gọn: "Danh mục trong hệ thống không phải danh sách phẳng mà là một cây dữ liệu, nên việc thêm, sửa, xóa phải kiểm tra quan hệ cha-con để tránh làm sai cấu trúc sản phẩm."

Về xóa dữ liệu, hệ thống có soft delete và xóa vĩnh viễn. Soft delete chỉ tạm ngừng hiển thị bằng `isActive = false` hoặc `deletedAt`, còn xóa vĩnh viễn chỉ thực hiện khi chắc chắn không còn dữ liệu phụ thuộc. Cách này giúp giữ an toàn cho lịch sử đơn hàng, khuyến mãi và báo cáo.

Có thể giải thích kỹ hơn bằng ví dụ: danh mục "Áo sơ mi" có thể đang chứa nhiều sản phẩm đang bán. Nếu admin xóa ngay danh mục này khỏi database, sản phẩm có thể mất danh mục, bộ lọc trên frontend bị lỗi, khuyến mãi áp dụng theo danh mục bị sai và lịch sử quản trị khó đối soát. Vì vậy khi tạm ngừng danh mục, hệ thống chỉ chuyển trạng thái sang không hoạt động. Nếu muốn xóa vĩnh viễn, backend phải kiểm tra danh mục đó không còn danh mục con, không còn sản phẩm tham chiếu, không còn được dùng làm template size và không nằm trong khuyến mãi đang hiệu lực.

Với sản phẩm thời trang, phần template size/form đo là điểm đáng giải thích. Ví dụ danh mục "Áo sơ mi" có các số đo vai, ngực, dài áo; danh mục "Quần jean" lại có eo, mông, dài quần. Nếu mỗi sản phẩm tự nhập tùy ý thì dữ liệu sẽ lộn xộn. Vì vậy hệ thống cho phép danh mục đóng vai trò nguồn mẫu size/form đo, giúp sản phẩm thuộc danh mục đó nhập dữ liệu nhất quán hơn.

Khi demo, có thể nói: "Catalog là phần lõi của hệ thống vì nó ảnh hưởng trực tiếp đến sản phẩm, bộ lọc, khuyến mãi, tồn kho và trải nghiệm mua hàng. Do đó phần này được kiểm tra khá chặt."

### 3.3 Giỏ hàng, đơn hàng và thanh toán

Đã có:

- Giỏ hàng cho khách hàng.
- Đặt hàng từ giỏ hàng.
- Snapshot thông tin sản phẩm vào đơn hàng: tên, size, màu, giá tại thời điểm mua.
- Quản lý trạng thái đơn: confirmed, packed, shipping, delivered, cancelled, return_requested, returned.
- Thanh toán COD và tích hợp VNPay.
- Bảng transaction để lưu giao dịch.
- Scheduler xử lý thanh toán hết hạn.
- Hỗ trợ hủy đơn, yêu cầu trả hàng, bằng chứng hình ảnh.
- Trang admin quản lý đơn hàng, tách nhóm thanh toán online/COD.

**Giải thích khi trình bày:**

Luồng mua hàng cơ bản là: khách xem sản phẩm, chọn size/màu/form dáng, thêm vào giỏ hàng, chọn địa chỉ, chọn phương thức thanh toán, áp dụng mã giảm giá nếu có, sau đó backend kiểm tra tồn kho, tính tiền hàng, phí vận chuyển, giảm giá coupon và giảm giá thành viên. Nếu dữ liệu hợp lệ, hệ thống tạo đơn hàng. Nếu thanh toán online, hệ thống tạo giao dịch và chuyển sang cổng thanh toán; nếu COD, đơn hàng được ghi nhận để cửa hàng xử lý.

Một điểm quan trọng là đơn hàng lưu snapshot thông tin sản phẩm tại thời điểm mua. Nghĩa là đơn hàng lưu lại tên sản phẩm, màu, size, ảnh, số lượng và giá lúc khách đặt. Nếu sau này admin đổi tên, đổi ảnh hoặc đổi giá sản phẩm, hóa đơn cũ vẫn không bị sai. Có thể giải thích ngắn gọn: "Đơn hàng là chứng từ lịch sử, nên phải lưu lại thông tin tại thời điểm mua, không phụ thuộc hoàn toàn vào dữ liệu sản phẩm hiện tại."

Với VNPay, hệ thống không chỉ tạo đơn hàng mà còn tạo giao dịch. Trạng thái đơn hàng và trạng thái thanh toán là hai khái niệm khác nhau: đơn hàng có thể đã được tạo nhưng thanh toán vẫn `pending`; nếu khách thanh toán thành công thì chuyển thành `paid`; nếu thất bại hoặc hết hạn thì chuyển thành `failed`.

Cần nói rõ rằng backend không lấy tổng tiền từ frontend làm kết quả cuối cùng. Frontend có thể hiển thị tạm tính cho người dùng, nhưng khi tạo đơn, backend phải tính lại từ dữ liệu thật: giá sản phẩm, số lượng, phí vận chuyển, coupon, giảm giá thành viên và thuế nếu có. Đây là nguyên tắc quan trọng trong thương mại điện tử vì dữ liệu phía frontend có thể bị thay đổi.

Về trạng thái đơn hàng, có thể giải thích theo vòng đời: khi đơn được tạo thì ở trạng thái xác nhận hoặc chờ xử lý; sau đó admin đóng gói, chuyển sang giao hàng, cuối cùng là đã giao. Nếu có vấn đề, đơn có thể bị hủy hoặc có yêu cầu trả hàng. Việc tách trạng thái đơn hàng và trạng thái thanh toán giúp xử lý các trường hợp thực tế như đơn COD chưa thanh toán ngay, đơn VNPay thanh toán thất bại, hoặc đơn đã thanh toán nhưng sau đó cần hoàn tiền.

Câu nói mẫu: "Trong hệ thống này, đơn hàng là nghiệp vụ trung tâm. Nó liên kết sản phẩm, người dùng, tồn kho, mã giảm giá, thanh toán, vận chuyển và chăm sóc khách hàng, nên backend phải xử lý rất cẩn thận."

### 3.4 Vận chuyển và địa chỉ

Đã có:

- Module địa chỉ/tỉnh thành.
- Tích hợp GHN để lấy tỉnh/thành, quận/huyện, phường/xã.
- Tính phí vận chuyển qua GHN.
- Tạo đơn vận chuyển, lấy chi tiết, hủy đơn vận chuyển.
- Cache danh sách dịch vụ GHN để giảm số lần gọi API.
- Có normalizer và resolver để xử lý khác biệt dữ liệu địa chỉ.

**Giải thích khi trình bày:**

GHN được dùng để hỗ trợ địa chỉ và phí vận chuyển: lấy danh sách tỉnh/thành, quận/huyện, phường/xã; tính phí ship dựa trên địa chỉ nhận hàng, khối lượng và kích thước; tạo đơn vận chuyển; lấy chi tiết hoặc hủy đơn vận chuyển.

Điểm khó là địa chỉ trong hệ thống và địa chỉ GHN có thể không khớp hoàn toàn. Vì vậy backend có phần xử lý mapping/normalizer để chuyển dữ liệu địa chỉ của người dùng sang mã mà GHN hiểu được. Có thể nói ngắn gọn: "GHN giúp tính phí và tạo vận đơn thật, nhưng hệ thống vẫn phải xử lý mapping địa chỉ và fallback vì dữ liệu giữa hai bên có thể khác nhau."

Khi trình bày kỹ hơn, có thể giải thích rằng người dùng thường nhập địa chỉ theo tên tỉnh, huyện, xã hoặc chọn từ danh sách trong app. Trong khi đó GHN lại cần mã tỉnh, mã huyện, mã phường/xã theo hệ thống riêng của họ. Vì vậy backend không thể chỉ lưu chuỗi địa chỉ thông thường, mà cần lưu thêm các mã tương ứng để gọi API vận chuyển.

Phần cache danh sách dịch vụ GHN cũng có ý nghĩa thực tế. Nếu mỗi lần tính phí ship đều gọi lại toàn bộ danh sách dịch vụ từ GHN, hệ thống sẽ chậm hơn và phụ thuộc mạng nhiều hơn. Cache giúp giảm số lần gọi API, tăng tốc độ phản hồi và giảm rủi ro khi dịch vụ ngoài chập chờn.

Khi báo cáo, có thể dùng ví dụ: "Nếu khách chọn Quận 1, TP.HCM, hệ thống cần chuyển thông tin đó thành districtId và wardCode mà GHN hiểu được. Đây là lý do cần có lớp chuẩn hóa địa chỉ."

### 3.5 Khuyến mãi, coupon và loyalty

Đã có:

- Coupon theo phần trăm, số tiền cố định, miễn phí vận chuyển.
- Điều kiện áp dụng theo user type, hạng thành viên, sản phẩm, danh mục, thời gian.
- Giới hạn số lượt dùng tổng và số lượt dùng theo từng người.
- Soft delete coupon bằng `deletedAt`.
- Lifecycle coupon: upcoming, active, paused, expired.
- Campaign khuyến mãi và analytics.
- Chương trình thành viên, hạng thành viên, điểm tích lũy, rule loyalty.
- Gán discount thành viên vào đơn hàng.

**Giải thích khi trình bày:**

Coupon và loyalty là nhóm nghiệp vụ marketing. Hệ thống không chỉ trừ tiền đơn giản mà còn kiểm tra nhiều điều kiện: voucher còn hạn không, có đang active không, đơn hàng có đạt giá trị tối thiểu không, voucher áp dụng cho sản phẩm/danh mục nào, người dùng có thuộc nhóm được áp dụng không, người dùng đã dùng quá số lần cho phép chưa, và thành viên đang ở hạng nào.

Ví dụ một voucher có thể chỉ áp dụng cho danh mục "Áo", chỉ dành cho thành viên, đơn tối thiểu 500.000đ, mỗi người dùng tối đa 1 lần. Tất cả điều kiện này phải được backend kiểm tra trước khi tạo đơn hàng. Có thể nói ngắn gọn: "Coupon và loyalty được xử lý ở backend để đảm bảo tính đúng tiền và tránh việc người dùng sửa dữ liệu ở frontend để nhận giảm giá sai."

Có thể giải thích thêm về thứ tự tính tiền. Thông thường hệ thống cần tính tiền hàng trước, sau đó tính giảm giá coupon, giảm giá vận chuyển nếu có, giảm giá theo hạng thành viên, rồi mới ra tổng tiền cuối cùng. Nếu thứ tự tính không rõ, đơn hàng có thể bị tính sai hoặc khuyến mãi bị áp dụng vượt mức mong muốn.

Loyalty giúp giữ chân khách hàng. Khi khách mua hàng và đơn hoàn tất, hệ thống có thể cộng điểm hoặc nâng hạng thành viên theo rule. Hạng thành viên sau đó có thể ảnh hưởng đến ưu đãi ở các đơn tiếp theo. Vì vậy loyalty không chỉ là điểm số hiển thị, mà liên quan trực tiếp đến chính sách kinh doanh của cửa hàng.

Câu nói mẫu: "Khuyến mãi là phần dễ nhìn thấy ở frontend, nhưng phần khó nằm ở backend: phải xác định ai được dùng, dùng khi nào, dùng cho sản phẩm nào và dùng tối đa bao nhiêu lần."

### 3.6 Tồn kho

Đã có:

- Module inventory.
- Kiểm tra tồn kho theo sản phẩm/biến thể/size.
- Test cho inventory service và controller.
- Liên kết với đơn hàng để tránh bán vượt quá số lượng có sẵn.

**Giải thích khi trình bày:**

Tồn kho là phần quan trọng vì nếu xử lý sai có thể dẫn đến bán vượt số lượng có thật. Luồng có thể giải thích là: admin tạo sản phẩm và nhập kho theo biến thể/size; khi khách đặt hàng, backend kiểm tra số lượng còn đủ không; nếu đủ, đơn hàng được tạo và tồn kho được cập nhật theo nghiệp vụ; nếu khách hủy đơn hoặc đơn bị trả, hệ thống cần xử lý hoàn kho hoặc cập nhật lại trạng thái phù hợp.

Điểm cần nhấn mạnh là tồn kho không thể chỉ kiểm tra ở frontend, vì nhiều người có thể đặt cùng lúc. Backend phải là nơi quyết định cuối cùng để tránh tình trạng cùng một sản phẩm bị bán cho nhiều người khi số lượng không đủ.

Tồn kho trong thời trang còn phức tạp vì không chỉ theo sản phẩm chung, mà theo biến thể và size. Ví dụ cùng một mẫu áo có màu trắng và đen, mỗi màu lại có size S, M, L. Size M màu trắng có thể hết hàng trong khi size L màu trắng vẫn còn, hoặc màu đen vẫn còn đủ. Vì vậy kiểm tra tồn kho cần đi đúng đến biến thể/size cụ thể mà khách chọn.

Khi giải thích, có thể nêu tình huống hai khách cùng đặt size M màu trắng trong cùng thời điểm. Nếu frontend tự kiểm tra, cả hai đều có thể thấy còn hàng. Backend cần kiểm tra lại khi tạo đơn để quyết định đơn nào được chấp nhận dựa trên số lượng thực tế. Đây là lý do tồn kho phải nằm ở backend và cần có test riêng.

Câu nói mẫu: "Tồn kho là nơi dễ phát sinh lỗi khi nhiều người mua cùng lúc, nên hệ thống không để frontend tự quyết định mà kiểm tra lại ở backend."

### 3.7 Đánh giá, yêu thích và hồ sơ khách hàng

Đã có:

- Yêu thích sản phẩm.
- Đánh giá sản phẩm, bao gồm điểm tổng và tiêu chí chi tiết.
- Admin có trang quản lý review.
- Profile khách hàng trên web/mobile.
- Địa chỉ giao hàng, thông tin thành viên, voucher, đơn hàng trong trang tài khoản.

**Giải thích khi trình bày:**

Các chức năng này giúp tăng trải nghiệm sau mua. Yêu thích giúp khách lưu sản phẩm quan tâm; profile giúp quản lý thông tin cá nhân, địa chỉ, voucher và đơn hàng; review giúp cửa hàng thu thập phản hồi và giúp khách khác có thêm cơ sở mua hàng. Review nên gắn với đơn hàng đã mua để hạn chế đánh giá ảo, vì vậy hệ thống có trường `isVerifiedPurchase` và liên kết review với order/product/version/size.

Có thể nói kỹ hơn rằng nhóm chức năng này không trực tiếp tạo đơn hàng ngay lập tức, nhưng ảnh hưởng đến khả năng giữ chân khách hàng. Ví dụ danh sách yêu thích giúp khách quay lại sản phẩm đã quan tâm; hồ sơ và địa chỉ giúp checkout nhanh hơn; lịch sử đơn hàng giúp khách theo dõi mua sắm; đánh giá giúp tăng độ tin cậy của sản phẩm.

Với review, việc liên kết tới đơn hàng và biến thể sản phẩm rất quan trọng. Một khách có thể mua đúng màu, size và form dáng cụ thể, nên đánh giá của họ cũng nên phản ánh trải nghiệm với biến thể đó. Điều này hữu ích hơn so với đánh giá chung chung cho toàn bộ sản phẩm.

### 3.8 Hỗ trợ khách hàng và realtime

Đã có:

- Ticket hỗ trợ trên web và mobile.
- FAQ.
- Trang admin quản lý hỗ trợ.
- Tin nhắn hỗ trợ và attachment.
- Socket.IO để cập nhật realtime.
- Notification summary cho admin/customer.
- Lifecycle ticket hỗ trợ và scheduler.

**Giải thích khi trình bày:**

Hỗ trợ khách hàng trong dự án không chỉ là một form liên hệ, mà là một hệ thống ticket có trạng thái, tin nhắn, file đính kèm, thông báo và phân quyền xử lý. Khi khách gửi yêu cầu, admin có thể xem và phản hồi. Socket.IO giúp cập nhật realtime, nghĩa là khi có tin nhắn hoặc ticket mới, giao diện có thể nhận thông báo nhanh mà không cần tải lại trang.

Có thể giải thích thêm về vòng đời ticket. Khi khách tạo yêu cầu, ticket có thể ở trạng thái mới hoặc đang chờ xử lý. Nhân viên hỗ trợ đọc nội dung, phản hồi, có thể yêu cầu thêm thông tin, sau đó đóng ticket khi vấn đề đã giải quyết. Nếu ticket liên quan đến đơn hàng, hệ thống có thể lưu liên kết tới đơn để nhân viên dễ tra cứu.

Realtime quan trọng vì hỗ trợ khách hàng cần tốc độ phản hồi. Nếu admin phải reload trang mới thấy tin nhắn mới thì trải nghiệm vận hành sẽ kém. Socket.IO giúp cập nhật nhanh hơn cho cả phía khách và phía admin.

Câu nói mẫu: "Module support được thiết kế như một kênh chăm sóc khách hàng sau bán, có trạng thái xử lý và realtime, không chỉ là form gửi góp ý."

### 3.9 Web frontend

Đã có hai nhóm giao diện:

- Giao diện khách hàng: trang chủ, danh sách sản phẩm, chi tiết sản phẩm, giỏ hàng, đơn hàng, tài khoản, hỗ trợ.
- Giao diện admin: đăng nhập admin, layout admin, sản phẩm, danh mục, đơn hàng, kho, khuyến mãi, khách hàng, loyalty, review, support, nhân sự/phân quyền.

Trang admin hiện tại đánh dấu các route đã implement gồm: accounts, customers, loyalty, products, catalog, orders, ordersOnline, ordersCod, inventory, promotions, reviews, support.

Một số route như dashboard, reports, settings đã có trong cấu hình điều hướng nhưng chưa được đánh dấu là đã hoàn thiện. Có thể trình bày đây là các mục sẽ làm sau.

**Giải thích khi trình bày:**

Web frontend đang phục vụ cả khách mua hàng và người vận hành cửa hàng. Phía khách hàng tập trung vào trải nghiệm mua hàng, còn phía admin tập trung vào quản trị nghiệp vụ. Khi báo cáo có thể nói rằng admin portal là phần quan trọng vì giúp cửa hàng vận hành dữ liệu thật: sản phẩm, đơn hàng, kho, khuyến mãi, khách hàng và hỗ trợ.

Khi giải thích kỹ hơn, nên tách rõ hai loại giao diện. Giao diện khách hàng ưu tiên sự đơn giản: khách cần nhìn thấy sản phẩm, lọc nhanh, xem chi tiết, thêm giỏ và thanh toán. Giao diện admin lại ưu tiên thao tác nghiệp vụ: danh sách dữ liệu, bộ lọc, trạng thái, hành động xử lý và kiểm soát quyền.

Ví dụ cùng là "đơn hàng", phía khách chỉ cần xem trạng thái đơn của mình, còn phía admin cần xem nhiều đơn, lọc theo trạng thái, kiểm tra thanh toán, cập nhật xử lý, xem thông tin vận chuyển và hỗ trợ hủy/trả hàng. Điều này giải thích vì sao web frontend có cả phần customer và admin.

### 3.10 Mobile app

Đã có các màn hình:

- Home.
- Danh sách sản phẩm và chi tiết sản phẩm.
- Giỏ hàng, đặt hàng thành công.
- Voucher/coupon.
- Yêu thích.
- Đăng nhập, đăng ký, quên mật khẩu.
- Hồ sơ, sửa hồ sơ, phương thức thanh toán, thành viên.
- Danh sách đơn hàng và chi tiết đơn hàng.
- Hỗ trợ, FAQ, tạo ticket, danh sách ticket, chi tiết ticket.

Mobile hiện tại đã có khung luồng khách hàng khá đầy đủ. Phần cần tiếp tục ưu tiên là đồng bộ trải nghiệm với web, kiểm thử trên thiết bị thật và xử lý các trường hợp mất kết nối/hết phiên.

**Giải thích khi trình bày:**

Mobile app dùng chung backend với web nên dữ liệu giữa các nền tảng có thể đồng bộ. Ví dụ khách xem sản phẩm hoặc đơn hàng trên mobile vẫn dựa trên cùng API với web. Đây là lợi thế vì backend chỉ cần xử lý nghiệp vụ một lần, còn nhiều client khác nhau có thể cùng sử dụng.

Có thể nói thêm rằng mobile tập trung vào trải nghiệm khách hàng hơn là quản trị. Các màn hình như home, danh sách sản phẩm, chi tiết sản phẩm, giỏ hàng, voucher, đơn hàng, tài khoản và hỗ trợ giúp khách mua sắm trên điện thoại. Vì mobile dùng chung API, các logic quan trọng như tính giá, kiểm tra coupon, kiểm tra tồn kho vẫn được backend xử lý giống web.

Điểm cần lưu ý khi hoàn thiện mobile là kiểm thử trên thiết bị thật. Một số vấn đề như lưu phiên đăng nhập, thông báo đẩy, chọn ảnh, kết nối mạng yếu hoặc chuyển app sang nền thường chỉ bộc lộ rõ khi chạy trên thiết bị thật.

## 4. Chất lượng, test và tài liệu

Dự án đã có bộ test khá rộng, gồm khoảng 48 file test/spec:

- Unit test cho auth, user, catalog, cart, orders, inventory, payments, promotions, reviews, shipping, support, notifications.
- Middleware test cho upload, security, auth.
- E2E/backend test cho loyalty-voucher-order.
- Playwright e2e test cho web như notification badge và loyalty voucher.

Đã có tài liệu:

- `database.md`: mô tả thiết kế database và validation đề xuất.
- `catalog-redesign.md`: tài liệu liên quan đến cải tiến catalog.
- `RUN_COMMANDS.txt`: lệnh chạy dự án.
- README hiện tại còn rất ngắn, mới có tên dự án.

Nhận xét: có test và tài liệu nên nền tảng dự án tốt. Tuy nhiên README cần bổ sung hướng dẫn cài đặt, biến môi trường, cách seed dữ liệu, cách chạy backend/web/mobile và tài khoản demo.

**Giải thích khi trình bày:**

Test giúp chứng minh các nghiệp vụ quan trọng không chỉ được viết ra mà còn được kiểm tra. Các test hiện có tập trung vào những phần dễ lỗi như auth, đơn hàng, thanh toán, tồn kho, vận chuyển, khuyến mãi và support. Tuy nhiên vẫn cần chạy lại full test/build sau các thay đổi gần đây để xác nhận trạng thái mới nhất.

Có thể giải thích rõ hơn rằng test có hai vai trò. Vai trò thứ nhất là kiểm tra chức năng hiện tại có đúng không. Vai trò thứ hai là bảo vệ dự án khi sửa code sau này. Ví dụ nếu sửa logic coupon mà vô tình làm sai tính tiền đơn hàng, test có thể phát hiện sớm trước khi lỗi xuất hiện khi demo hoặc triển khai.

Các file test cho service thường tập trung vào nghiệp vụ backend, ví dụ tạo danh mục, xóa danh mục, tính tồn kho, xử lý thanh toán, cập nhật điểm thành viên. E2E test kiểm tra luồng lớn hơn, ví dụ khách dùng voucher trong đơn hàng. Vì vậy khi báo cáo có thể nói dự án đã có nền tảng kiểm thử, nhưng vẫn cần chạy lại toàn bộ test sau các thay đổi mới để xác nhận chất lượng hiện tại.

## 5. Việc đang làm/chưa hoàn thiện

Theo cấu trúc hiện tại, các phần cần tiếp tục hoàn thiện gồm:

- README cần viết đầy đủ hơn.
- Dashboard, reports, settings trên admin đã có route/ý tưởng nhưng chưa được đánh dấu hoàn thiện.
- Cần chạy lại full test, build backend, build web sau các thay đổi gần đây.
- Cần kiểm thử luồng tích hợp thật với VNPay, GHN, Cloudinary.
- Cần kiểm thử mobile trên thiết bị thật, đặc biệt auth, cart, checkout, notification.
- Cần rà soát encoding tiếng Việt trong một số file test/tài liệu nếu có hiện tượng lỗi dấu.
- Cần đồng bộ chuẩn response/error message giữa các module để frontend xử lý thống nhất.
- Cần bổ sung dữ liệu seed/demo để việc trình bày thuận lợi.

**Giải thích khi trình bày:**

Các mục chưa hoàn thiện ở đây không có nghĩa là hệ thống chưa dùng được, mà thể hiện dự án đang ở giai đoạn cần ổn định trước khi demo hoặc triển khai. Ví dụ README hiện còn ngắn nên người mới vào dự án sẽ khó biết cách cài đặt, cấu hình `.env`, seed dữ liệu và chạy từng phần. Đây là vấn đề tài liệu, không phải vấn đề nghiệp vụ, nhưng lại ảnh hưởng trực tiếp đến khả năng bàn giao và bảo trì.

Dashboard, reports và settings là các phần thường được làm sau vì cần dữ liệu vận hành đủ lớn mới có ý nghĩa. Khi các module đơn hàng, thanh toán, kho và khuyến mãi đã ổn định, có thể tổng hợp dữ liệu đó thành báo cáo doanh thu, báo cáo sản phẩm bán chạy, tình trạng đơn hàng hoặc hiệu quả khuyến mãi.

Việc cần chạy lại full test/build là bước kiểm tra chất lượng. Vì repo đang có nhiều thay đổi ở backend và frontend, cần xác nhận toàn bộ dự án vẫn build được, các test nghiệp vụ vẫn qua, và không có lỗi TypeScript hoặc lỗi runtime rõ ràng. Khi báo cáo, có thể nói đây là bước chuyển từ "đã phát triển chức năng" sang "ổn định chức năng".

## 6. Rủi ro hiện tại

- Tích hợp bên ngoài: VNPay, GHN, Cloudinary phụ thuộc cấu hình `.env` và kết nối mạng.
- Dữ liệu mẫu: nếu seed chưa đầy đủ, demo có thể không thể hiện hết tính năng.
- Đồng bộ web-mobile: hai client cùng dùng API, nên thay đổi response backend có thể ảnh hưởng cả web và mobile.
- Nghiệp vụ đơn hàng/thanh toán/kho phức tạp, cần test các case hủy đơn, thanh toán thất bại, hết hàng, trả hàng.
- Bảo mật upload ảnh và file đính kèm cần tiếp tục kiểm thử với file sai định dạng/kích thước lớn.

**Giải thích khi trình bày:**

Rủi ro lớn nhất nằm ở các phần có liên quan đến tiền, đơn hàng, tồn kho và dịch vụ bên ngoài. Với VNPay, nếu cấu hình sai hoặc xử lý callback chưa đủ kỹ, trạng thái thanh toán có thể không đồng bộ với đơn hàng. Với GHN, nếu mapping địa chỉ sai thì phí ship hoặc vận đơn có thể sai. Với Cloudinary/upload, nếu không kiểm soát định dạng và dung lượng file, hệ thống có thể gặp lỗi bảo mật hoặc lỗi hiệu năng.

Dữ liệu mẫu cũng là một rủi ro khi báo cáo. Nếu không có sản phẩm, danh mục, voucher, tài khoản admin/staff và đơn hàng mẫu thì dù chức năng đã có, demo vẫn khó thuyết phục. Vì vậy trước khi trình bày nên chuẩn bị sẵn dữ liệu thể hiện đủ luồng: xem sản phẩm, thêm giỏ, dùng voucher, đặt hàng, admin xử lý đơn và khách gửi hỗ trợ.

Đồng bộ web-mobile cần được chú ý vì cả hai client cùng dùng backend. Nếu backend đổi tên field hoặc đổi format response, web có thể đã cập nhật nhưng mobile chưa cập nhật, hoặc ngược lại. Do đó các API dùng chung cần ổn định và có kiểu dữ liệu rõ ràng.

## 7. Đề xuất kế hoạch tiếp theo

Ưu tiên ngắn hạn:

1. Chạy `npm run build` cho backend và web frontend.
2. Chạy `npm test` cho backend.
3. Kiểm thử các flow chính: đăng nhập, xem sản phẩm, thêm giỏ, checkout COD, checkout VNPay, quản lý đơn admin.
4. Tạo/kiểm tra seed data demo: admin, staff, khách hàng, danh mục, brand, sản phẩm, coupon.
5. Hoàn thiện README và hướng dẫn setup `.env`.

Ưu tiên tiếp theo:

1. Hoàn thiện dashboard/report/settings trong admin.
2. Kiểm thử mobile trên thiết bị thật.
3. Đồng bộ thông báo realtime và notification badge.
4. Tối ưu UX trang quản trị cho nhân viên sử dụng hằng ngày.
5. Bổ sung monitoring/log cho thanh toán, vận chuyển, upload.

**Giải thích khi trình bày:**

Kế hoạch tiếp theo được chia thành hai nhóm. Nhóm ngắn hạn tập trung vào việc xác nhận hệ thống hiện tại chạy ổn: build được, test qua, flow chính hoạt động và có dữ liệu demo. Đây là nhóm việc cần làm trước khi báo cáo hoặc demo vì nó giúp tránh lỗi cơ bản trong lúc trình bày.

Nhóm tiếp theo tập trung vào nâng chất lượng sản phẩm. Dashboard/report/settings giúp admin có cái nhìn tổng quan hơn thay vì chỉ quản lý dữ liệu từng bảng. Kiểm thử mobile trên thiết bị thật giúp phát hiện các lỗi đặc thù của điện thoại. Monitoring/log giúp theo dõi các luồng nhạy cảm như thanh toán, vận chuyển và upload, đặc biệt hữu ích khi có lỗi khó tái hiện.

Có thể nói khi báo cáo: "Giai đoạn tiếp theo không chỉ là thêm chức năng mới, mà là ổn định hệ thống, chuẩn hóa tài liệu, chuẩn bị dữ liệu demo và kiểm thử các luồng nghiệp vụ quan trọng."

## 8. Kết luận để trình bày

Dự án hiện tại đã có nền tảng khá đầy đủ cho một hệ thống e-commerce thời trang: backend module hóa rõ ràng, database có ràng buộc, web khách hàng, admin portal, mobile app và các test cho nghiệp vụ chính. Những điểm đã làm tốt là catalog phức tạp theo thời trang, đơn hàng/thanh toán, khuyến mãi/loyalty, vận chuyển GHN, hỗ trợ khách hàng realtime và phân quyền admin/staff.

Phần cần tiếp tục tập trung là ổn định hệ thống, kiểm thử tích hợp thật, hoàn thiện dashboard/báo cáo, bổ sung tài liệu chạy dự án và chuẩn bị dữ liệu demo. Có thể xem đây là giai đoạn "đã có chức năng chính, đang tiến tới ổn định và hoàn thiện để demo/triển khai".

Có thể kết luận ngắn gọn khi báo cáo:

"Hiện tại dự án đã hoàn thiện phần lớn các chức năng nền tảng của một hệ thống thương mại điện tử thời trang: catalog, sản phẩm, giỏ hàng, đơn hàng, thanh toán, vận chuyển, khuyến mãi, tồn kho, khách hàng, hỗ trợ và trang quản trị. Các phần phức tạp như cây danh mục, biến thể sản phẩm, snapshot đơn hàng, coupon, tồn kho và tích hợp dịch vụ ngoài đã được xử lý ở backend để đảm bảo dữ liệu đúng và an toàn. Giai đoạn tiếp theo là kiểm thử tích hợp, hoàn thiện dashboard/báo cáo, chuẩn hóa tài liệu và chuẩn bị dữ liệu demo để hệ thống ổn định hơn khi trình bày hoặc triển khai."
