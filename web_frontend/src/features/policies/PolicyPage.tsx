import { MainLayout } from '../../layouts/MainLayout'
import { LEGAL_POLICY_VERSION } from './policy.constants'
import { useStorefrontSettings } from '../storefront-settings/storefrontSettings.context'
import './policy.css'

type PolicySection = { title: string; paragraphs: string[] }
type PolicyDocument = { title: string; summary: string; sections: PolicySection[] }

const SHOP_IDENTITY_TOKEN = '[[SHOP_IDENTITY]]'
const SHOP_EMAIL_TOKEN = '[[SHOP_EMAIL]]'

const policies: Record<string, PolicyDocument> = {
  terms: {
    title: 'Điều khoản sử dụng và giao dịch',
    summary: 'Các điều kiện áp dụng khi tạo tài khoản, đặt hàng và sử dụng dịch vụ của CDShop.',
    sections: [
      { title: 'Chủ thể bán hàng và liên hệ', paragraphs: [`${SHOP_IDENTITY_TOKEN}. Khách hàng cũng có thể gửi yêu cầu và theo dõi phản hồi tại Trung tâm hỗ trợ của CDShop.`] },
      { title: 'Tài khoản khách hàng', paragraphs: ['Khách hàng cung cấp thông tin chính xác, bảo vệ thông tin đăng nhập và thông báo cho CDShop khi phát hiện truy cập trái phép.'] },
      { title: 'Đặt hàng và xác nhận', paragraphs: ['Đơn hàng được hình thành sau khi hệ thống xác nhận mã đơn. Nội dung đơn, sản phẩm, giá, phí, địa chỉ, phương thức thanh toán và trạng thái xử lý được lưu tại tài khoản để khách hàng truy cập lại.', 'CDShop có thể liên hệ để xác minh thông tin hoặc hủy đơn khi sản phẩm hết hàng, thông tin giao nhận không hợp lệ hoặc có dấu hiệu gian lận. Đơn đã thanh toán bị hủy được chuyển sang quy trình hoàn tiền tương ứng.'] },
      { title: 'Giá và thanh toán', paragraphs: ['Giá sản phẩm, giảm giá, thuế và phí giao hàng được hiển thị trước khi khách xác nhận đặt hàng. Phương thức đang hỗ trợ là COD và VNPay. Trạng thái thanh toán VNPay được xác nhận bằng kết quả từ cổng thanh toán.'] },
      { title: 'Hủy đơn và quyền theo pháp luật', paragraphs: ['Khách hàng có thể hủy đơn khi trạng thái đơn còn cho phép. Chính sách 7 ngày của CDShop không hạn chế quyền yêu cầu xử lý hàng sai, thiếu, có khuyết tật hoặc các quyền khác theo pháp luật bảo vệ người tiêu dùng.', 'Nếu thông tin bắt buộc của giao dịch từ xa được cung cấp không chính xác hoặc không đầy đủ, quyền chấm dứt hợp đồng và hoàn tiền được thực hiện theo thời hạn, phương thức do pháp luật áp dụng quy định.'] },
      { title: 'Sử dụng hợp lệ', paragraphs: ['Không sử dụng dịch vụ để thử nghiệm thanh toán trái phép, lạm dụng khuyến mại, can thiệp hệ thống hoặc xâm phạm quyền của người khác.'] },
      { title: 'Giải quyết tranh chấp', paragraphs: ['CDShop ưu tiên đối soát trên mã đơn và phiếu hỗ trợ. Nếu hai bên không thống nhất, khách hàng có quyền yêu cầu cơ quan bảo vệ người tiêu dùng, hòa giải, trọng tài hoặc tòa án có thẩm quyền giải quyết theo pháp luật.'] },
    ],
  },
  privacy: {
    title: 'Chính sách bảo vệ dữ liệu cá nhân',
    summary: 'Cách CDShop thu thập, sử dụng, chia sẻ và bảo vệ dữ liệu của khách hàng.',
    sections: [
      { title: 'Dữ liệu được xử lý', paragraphs: ['CDShop xử lý thông tin tài khoản, liên hệ, địa chỉ giao hàng, lịch sử đơn hàng, tương tác sản phẩm, yêu cầu hỗ trợ và dữ liệu kỹ thuật cần thiết để bảo vệ phiên đăng nhập. CDShop không lưu thông tin thẻ do khách nhập tại VNPay.'] },
      { title: 'Mục đích sử dụng', paragraphs: ['Dữ liệu được dùng để xác thực tài khoản, thực hiện hợp đồng mua bán, giao hàng, thanh toán, đổi trả, chăm sóc khách hàng, phòng chống gian lận và cải thiện gợi ý sản phẩm.'] },
      { title: 'Sự đồng ý và lựa chọn', paragraphs: ['Việc xử lý cần thiết để tạo tài khoản, thực hiện đơn hàng và bảo vệ hệ thống được trình bày trước khi đăng ký. CDShop không bán dữ liệu cá nhân. Nếu triển khai quảng cáo trực tiếp hoặc chia sẻ ngoài phạm vi cần thiết cho dịch vụ, CDShop phải cung cấp lựa chọn đồng ý hoặc từ chối riêng.'] },
      { title: 'Bên nhận dữ liệu', paragraphs: ['Thông tin tối thiểu cần thiết có thể được chuyển cho VNPay, GHN và nhà cung cấp hạ tầng phục vụ thanh toán, giao hàng, lưu trữ hoặc gửi thông báo. Các bên này chỉ nhận dữ liệu phù hợp với vai trò cung cấp dịch vụ và phải bảo vệ dữ liệu theo thỏa thuận, quy định áp dụng.'] },
      { title: 'Thời hạn lưu giữ', paragraphs: ['Dữ liệu tài khoản được giữ trong thời gian tài khoản hoạt động và đến khi yêu cầu xóa được xử lý. Dữ liệu đơn hàng, thanh toán, hoàn tiền, hóa đơn và khiếu nại được giữ đến khi hoàn tất nghĩa vụ hợp đồng, giải quyết tranh chấp và hết thời hạn lưu theo pháp luật kế toán, thuế hoặc quy định liên quan.', 'Lịch sử tương tác dùng cho gợi ý và nhật ký kỹ thuật chỉ được giữ trong thời gian còn cần cho mục đích đã thông báo; sau đó phải được xóa hoặc ẩn danh, trừ trường hợp pháp luật yêu cầu tiếp tục lưu.'] },
      { title: 'Quyền của khách hàng', paragraphs: ['Khách hàng có thể xem, cập nhật thông tin tài khoản và gửi yêu cầu được biết, truy cập, chỉnh sửa, hạn chế xử lý, phản đối, rút lại sự đồng ý hoặc xóa dữ liệu qua trang Hỗ trợ. Việc rút lại sự đồng ý không làm mất tính hợp pháp của hoạt động xử lý đã thực hiện và có thể không áp dụng cho dữ liệu phải lưu theo pháp luật.'] },
      { title: 'Bảo mật và sự cố', paragraphs: ['CDShop áp dụng kiểm soát truy cập, mã hóa thông tin nhạy cảm và nhật ký quản trị. Sự cố ảnh hưởng đến dữ liệu cá nhân sẽ được xử lý và thông báo theo quy định áp dụng.'] },
      { title: 'Đầu mối dữ liệu cá nhân', paragraphs: [`Yêu cầu về dữ liệu được tiếp nhận tại Trung tâm hỗ trợ${SHOP_EMAIL_TOKEN}. CDShop sẽ xác minh danh tính người yêu cầu trước khi cung cấp, sửa hoặc xóa dữ liệu.`] },
    ],
  },
  shipping: {
    title: 'Chính sách giao hàng',
    summary: 'Phí, thời gian dự kiến, kiểm tra hàng và xử lý giao hàng không thành công.',
    sections: [
      { title: 'Phạm vi và phí giao hàng', paragraphs: ['Khu vực phục vụ và phí giao hàng khả dụng được tính từ địa chỉ nhận, kích thước đơn và dịch vụ GHN. Phí khách trả được chốt tại bước xác nhận đơn và không thu lại bởi người giao hàng, ngoại trừ khoản COD hiển thị trên đơn.'] },
      { title: 'Thời gian dự kiến', paragraphs: ['Ngày giao dự kiến do đơn vị vận chuyển cung cấp và có thể thay đổi vì thời tiết, lưu lượng hoặc địa chỉ khó tiếp cận. Đơn chỉ được ghi nhận đã giao khi có xác nhận giao hàng.'] },
      { title: 'Kiểm tra và nhận hàng', paragraphs: ['Khách có thể kiểm tra đúng sản phẩm, số lượng và tình trạng bên ngoài; không thử sử dụng sản phẩm trước khi thanh toán. Hãy lưu hình ảnh và liên hệ Hỗ trợ nếu kiện hàng hư hỏng hoặc sai sản phẩm.'] },
      { title: 'Giao hàng không thành công', paragraphs: ['GHN hoặc CDShop có thể liên hệ lại khi không giao được. Đơn COD bị hủy sẽ không ghi nhận đã thanh toán. Đơn trả trước bị hủy được chuyển sang quy trình hoàn tiền.'] },
      { title: 'Trách nhiệm của đơn vị vận chuyển', paragraphs: ['GHN thực hiện vận chuyển theo điều kiện dịch vụ và chính sách bồi thường của GHN. CDShop vẫn là đầu mối tiếp nhận phản ánh của khách hàng, đối soát tình trạng kiện hàng và phối hợp xử lý mất, hư hỏng hoặc giao sai.'] },
    ],
  },
  returns: {
    title: 'Chính sách trả hàng và hoàn tiền',
    summary: 'Điều kiện, thời hạn và phương thức xử lý yêu cầu trả hàng.',
    sections: [
      { title: 'Thời hạn yêu cầu', paragraphs: ['Khách gửi yêu cầu trong vòng 7 ngày kể từ ngày hệ thống ghi nhận giao hàng. Yêu cầu cần nêu lý do và cung cấp hình ảnh khi sản phẩm sai, thiếu hoặc hư hỏng.'] },
      { title: 'Điều kiện sản phẩm', paragraphs: ['Sản phẩm cần còn nguyên tem nhãn, chưa qua sử dụng, giặt hoặc sửa đổi. Sản phẩm vệ sinh cá nhân, đặt làm riêng hoặc hư hỏng do sử dụng sai có thể không đủ điều kiện, trừ khi có lỗi từ CDShop.'] },
      { title: 'Quy trình xử lý', paragraphs: ['CDShop duyệt yêu cầu, hướng dẫn gửi trả, xác nhận đã nhận và kiểm tra hàng trước khi hoàn tiền. Trạng thái trên đơn hàng là nguồn theo dõi chính thức cho từng bước.'] },
      { title: 'Chi phí gửi trả', paragraphs: ['CDShop chịu chi phí gửi trả khi giao sai, thiếu, hàng có lỗi hoặc hư hỏng không do khách hàng. Với yêu cầu đổi kích cỡ, thay đổi nhu cầu hoặc lý do không thuộc lỗi của CDShop, chi phí gửi trả và giao lại được thông báo để khách hàng xác nhận trước khi gửi.'] },
      { title: 'Phương thức và thời hạn hoàn tiền', paragraphs: ['Đơn VNPay được yêu cầu hoàn qua VNPay về kênh thanh toán gốc. Đơn COD được hoàn qua tài khoản ngân hàng đã xác minh của khách. CDShop gửi yêu cầu hoàn trong vòng 7 ngày làm việc sau khi xác nhận đã nhận, kiểm tra hàng và chấp thuận khoản hoàn.', 'Thời gian tiền thực tế về tài khoản còn phụ thuộc VNPay hoặc ngân hàng. Trường hợp pháp luật quy định thời hạn hoặc phương thức có lợi hơn cho khách hàng thì áp dụng quy định đó.'] },
    ],
  },
  complaints: {
    title: 'Quy trình tiếp nhận khiếu nại',
    summary: 'Kênh liên hệ và cách CDShop theo dõi tranh chấp liên quan đến đơn hàng.',
    sections: [
      { title: 'Gửi yêu cầu', paragraphs: ['Khách gửi yêu cầu tại trang Hỗ trợ và chọn đúng mã đơn. Hãy cung cấp nội dung, ảnh hoặc chứng từ thanh toán liên quan; không gửi mật khẩu, OTP hoặc toàn bộ thông tin thẻ.'] },
      { title: 'Tiếp nhận và xử lý', paragraphs: ['CDShop xác nhận tiếp nhận trong tối đa 3 ngày làm việc, phân loại mức độ và cập nhật tiến trình trên phiếu hỗ trợ. Mục tiêu xử lý là 15 ngày làm việc; vụ việc cần đối soát với VNPay, GHN hoặc ngân hàng có thể lâu hơn và khách hàng sẽ được thông báo tiến độ.'] },
      { title: 'Kết quả và phản hồi', paragraphs: ['Kết quả xử lý nêu căn cứ, trạng thái đơn và khoản tiền liên quan. Khách có thể phản hồi lại trên cùng phiếu nếu chưa đồng ý hoặc yêu cầu chuyển cấp xử lý.'] },
      { title: 'Chuyển cấp tranh chấp', paragraphs: ['Việc sử dụng quy trình nội bộ không loại trừ quyền khiếu nại đến cơ quan quản lý nhà nước, tổ chức bảo vệ người tiêu dùng hoặc khởi kiện theo pháp luật. CDShop lưu vết trao đổi và chứng từ liên quan để phục vụ đối soát.'] },
    ],
  },
}

export function PolicyPage({ policyKey }: { policyKey: keyof typeof policies }) {
  const { settings } = useStorefrontSettings()
  const policy = policies[policyKey]
  const shopIdentitySummary = [
    settings.identity.legalName || settings.identity.name,
    settings.identity.taxCode ? `Mã số thuế: ${settings.identity.taxCode}` : null,
    settings.contact.address ? `Địa chỉ: ${settings.contact.address}` : null,
    settings.contact.phone ? `Điện thoại: ${settings.contact.phone}` : null,
    settings.contact.email ? `Email: ${settings.contact.email}` : null,
  ].filter(Boolean).join('. ')
  const resolveText = (value: string) => value
    .replaceAll(SHOP_IDENTITY_TOKEN, shopIdentitySummary)
    .replaceAll(SHOP_EMAIL_TOKEN, settings.contact.email ? ` hoặc email ${settings.contact.email}` : '')
    .replaceAll('CDShop', settings.identity.name)

  return (
    <MainLayout>
      <main className="policy-page">
        <header>
          <p>Phiên bản {LEGAL_POLICY_VERSION}</p>
          <h1>{resolveText(policy.title)}</h1>
          <span>{resolveText(policy.summary)}</span>
        </header>
        <article>
          {policy.sections.map((section) => (
            <section key={section.title}>
              <h2>{resolveText(section.title)}</h2>
              {section.paragraphs.map((paragraph) => <p key={paragraph}>{resolveText(paragraph)}</p>)}
            </section>
          ))}
        </article>
        <p className="policy-contact">Yêu cầu liên quan đến chính sách được tiếp nhận tại <a href="/support">Trung tâm hỗ trợ</a>.</p>
      </main>
    </MainLayout>
  )
}
