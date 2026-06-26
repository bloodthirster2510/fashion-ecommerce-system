import { Button, Empty, Modal, Popconfirm } from 'antd'
import type { UserAddress } from '../profile.service'
import { formatAddressLine } from '../profile.utils'

type AddressManagerModalProps = {
  open: boolean
  addresses: UserAddress[]
  pendingAddressId: string
  onClose: () => void
  onSetDefault: (address: UserAddress) => void
  onDelete: (address: UserAddress) => void
}

export function AddressManagerModal({
  open,
  addresses,
  pendingAddressId,
  onClose,
  onSetDefault,
  onDelete,
}: AddressManagerModalProps) {
  return (
    <Modal title="Quản lý địa chỉ" open={open} footer={null} onCancel={onClose} width={680}>
      {!addresses.length ? (
        <Empty description="Bạn chưa có địa chỉ nào." />
      ) : (
        <div className="account-address-list">
          {addresses.map((address) => {
            const addressId = address._id || formatAddressLine(address)
            const isPending = pendingAddressId === address._id

            return (
              <article className={`account-address-card${address.isDefault ? ' is-default' : ''}`} key={addressId}>
                <div>
                  <strong>{address.customerName}</strong>
                  <span>{address.phoneNumber}</span>
                  <p>{formatAddressLine(address) || 'Địa chỉ chưa đầy đủ'}</p>
                  {address.isDefault && <em>Địa chỉ mặc định</em>}
                </div>
                <div className="account-address-actions">
                  <Button
                    type={address.isDefault ? 'default' : 'primary'}
                    disabled={address.isDefault || !address._id}
                    loading={isPending}
                    onClick={() => onSetDefault(address)}
                  >
                    Chọn
                  </Button>
                  <Popconfirm title="Xóa địa chỉ này?" okText="Xóa" cancelText="Hủy" onConfirm={() => onDelete(address)}>
                    <Button danger disabled={!address._id || isPending || addresses.length <= 1}>
                      Xóa
                    </Button>
                  </Popconfirm>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
