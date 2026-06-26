import { Form, Input, Select } from 'antd'
import type { AuthUser } from '../../auth/auth.types'
import type { UserAddress } from '../../profile/profile.service'

type Props = {
  user: AuthUser | null
  addresses: UserAddress[]
  addressId: string
  note: string
  onAddressChange: (id: string) => void
  onNoteChange: (note: string) => void
}

const fullAddress = (address?: UserAddress) => address
  ? [address.streetName, address.ward, address.district, address.province].filter(Boolean).join(', ')
  : ''

export function CheckoutInformation({ user, addresses, addressId, note, onAddressChange, onNoteChange }: Props) {
  const selected = addresses.find((address) => address._id === addressId)
  return (
    <section className="checkout-section">
      <h1>Thông tin đơn hàng</h1>
      <Form layout="vertical" className="checkout-form">
        <Form.Item label="Địa chỉ nhận hàng" required>
          <Select
            value={addressId || undefined}
            placeholder="Chọn địa chỉ đã lưu"
            options={addresses.map((address) => ({
              value: address._id!,
              label: `${address.customerName} · ${address.phoneNumber}${address.isDefault ? ' · Mặc định' : ''}`,
            }))}
            onChange={onAddressChange}
          />
        </Form.Item>
        <div className="checkout-form-row">
          <Form.Item label="Họ và tên"><Input value={selected?.customerName || user?.name || ''} readOnly /></Form.Item>
          <Form.Item label="Số điện thoại"><Input value={selected?.phoneNumber || user?.phone || ''} readOnly /></Form.Item>
        </div>
        <Form.Item label="Email"><Input value={user?.email || ''} readOnly /></Form.Item>
        <Form.Item label="Địa chỉ"><Input value={fullAddress(selected)} readOnly placeholder="Vui lòng thêm địa chỉ trong trang tài khoản" /></Form.Item>
        <Form.Item label="Ghi chú thêm"><Input.TextArea value={note} maxLength={300} showCount rows={3} placeholder="Ví dụ: giao hàng giờ hành chính" onChange={(event) => onNoteChange(event.target.value)} /></Form.Item>
      </Form>
    </section>
  )
}

