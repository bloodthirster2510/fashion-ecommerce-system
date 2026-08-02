import type { StaffPermission } from '../manager.types'

type PermissionGroup = {
  title: string
  helper: string
  items: {
    value: StaffPermission
    label: string
  }[]
}

const permissionGroups: PermissionGroup[] = [
  {
    title: 'Sản phẩm',
    helper: 'Danh sách sản phẩm và biến thể',
    items: [
      { value: 'products.read', label: 'Xem' },
      { value: 'products.write', label: 'Tạo, sửa, ẩn hiện' },
    ],
  },
  {
    title: 'Danh mục',
    helper: 'Danh mục và thương hiệu',
    items: [
      { value: 'catalog.read', label: 'Xem' },
      { value: 'catalog.write', label: 'Tạo, sửa, xóa' },
    ],
  },
  {
    title: 'Đơn hàng',
    helper: 'Theo dõi và cập nhật vận hành',
    items: [
      { value: 'orders.read', label: 'Xem' },
      { value: 'orders.update', label: 'Cập nhật trạng thái' },
      { value: 'payments.adjust', label: 'Điều chỉnh thanh toán' },
      { value: 'audit.read', label: 'Nhật ký' },
    ],
  },
  {
    title: 'Kho hàng',
    helper: 'Tồn kho, nhập kho, điều chỉnh',
    items: [
      { value: 'inventory.read', label: 'Xem' },
      { value: 'inventory.write', label: 'Nhập và điều chỉnh' },
    ],
  },
  {
    title: 'Khuyến mãi',
    helper: 'Coupon và chiến dịch',
    items: [
      { value: 'promotions.read', label: 'Xem' },
      { value: 'promotions.write', label: 'Tạo, sửa, bật tắt' },
    ],
  },
  {
    title: 'Chương trình thành viên',
    helper: 'Hạng, điểm tích lũy và quyền lợi',
    items: [
      { value: 'loyalty.read', label: 'Xem' },
      { value: 'loyalty.write', label: 'Tạo, sửa, bật tắt' },
    ],
  },
  {
    title: 'Khách hàng',
    helper: 'Tài khoản người mua hàng',
    items: [
      { value: 'customers.read', label: 'Xem' },
      { value: 'customers.manage', label: 'Khóa, mở, reset' },
    ],
  },
  {
    title: 'Vận hành khác',
    helper: 'Kiểm duyệt, hỗ trợ, báo cáo',
    items: [
      { value: 'reviews.read', label: 'Xem đánh giá' },
      { value: 'reviews.moderate', label: 'Kiểm duyệt đánh giá' },
      { value: 'reviews.reply', label: 'Phản hồi đánh giá' },
      { value: 'support.reply', label: 'Phản hồi ticket' },
      { value: 'support.manage', label: 'Quản lý FAQ, mẫu trả lời & báo cáo hỗ trợ' },
      { value: 'virtual_try_on.read', label: 'Xem lượt phối đồ ảo' },
      { value: 'virtual_try_on.manage', label: 'Vận hành và hạn chế tài khoản' },
      { value: 'virtual_try_on.settings', label: 'Cấu hình và quy tắc nội dung' },
      { value: 'reports.read', label: 'Báo cáo' },
    ],
  },
]

type PermissionEditorProps = {
  selectedPermissions: StaffPermission[]
  onToggle: (permission: StaffPermission) => void
}

export function PermissionEditor({
  selectedPermissions,
  onToggle,
}: PermissionEditorProps) {
  return (
    <div className="admin-permission-grid">
      {permissionGroups.map((group) => (
        <section className="admin-permission-group" key={group.title}>
          <div>
            <strong>{group.title}</strong>
            <span>{group.helper}</span>
          </div>
          <div className="admin-permission-options">
            {group.items.map((item) => (
              <label className="admin-permission-option" key={item.value}>
                <input
                  type="checkbox"
                  checked={selectedPermissions.includes(item.value)}
                  onChange={() => onToggle(item.value)}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
