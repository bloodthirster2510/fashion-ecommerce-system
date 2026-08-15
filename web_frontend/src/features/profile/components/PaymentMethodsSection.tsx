import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Checkbox, Empty, Input, Modal, Skeleton, Tag, message } from 'antd'
import { BankOutlined, CheckCircleOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import {
  paymentMethodsService,
  type CustomerPaymentMethod,
  type SavePaymentMethodInput,
} from '../payment-methods.service'

const statusLabels: Record<CustomerPaymentMethod['status'], string> = {
  pending: 'Chờ xác minh',
  verified: 'Đã xác minh',
  expired: 'Hết hiệu lực',
  disabled: 'Đã vô hiệu hóa',
}

const statusColors: Record<CustomerPaymentMethod['status'], string> = {
  pending: 'gold',
  verified: 'green',
  expired: 'orange',
  disabled: 'default',
}

type PaymentMethodFormState = {
  displayName: string
  bankCode: string
  bankName: string
  accountNumber: string
  accountHolder: string
  isDefault: boolean
}

const emptyForm: PaymentMethodFormState = {
  displayName: '',
  bankCode: '',
  bankName: '',
  accountNumber: '',
  accountHolder: '',
  isDefault: false,
}

const getAccountHolder = (method?: CustomerPaymentMethod | null) =>
  typeof method?.metadata?.accountHolder === 'string' ? method.metadata.accountHolder : ''

const buildChangedPayload = (
  form: PaymentMethodFormState,
  editingMethod: CustomerPaymentMethod | null,
): SavePaymentMethodInput => {
  if (!editingMethod) return {
    displayName: form.displayName,
    bankCode: form.bankCode,
    bankName: form.bankName,
    accountNumber: form.accountNumber,
    accountHolder: form.accountHolder,
    isDefault: form.isDefault,
  }

  return {
    ...(form.displayName.trim() !== editingMethod.displayName ? { displayName: form.displayName } : {}),
    ...(form.bankCode.trim().toUpperCase() !== (editingMethod.bankCode ?? '') ? { bankCode: form.bankCode } : {}),
    ...(form.bankName.trim() !== (editingMethod.bankName ?? '') ? { bankName: form.bankName } : {}),
    ...(form.accountNumber.trim() ? { accountNumber: form.accountNumber } : {}),
    ...(form.accountHolder.trim() !== getAccountHolder(editingMethod) ? { accountHolder: form.accountHolder } : {}),
    ...(form.isDefault !== editingMethod.isDefault ? { isDefault: form.isDefault } : {}),
  }
}

export function PaymentMethodsSection() {
  const [methods, setMethods] = useState<CustomerPaymentMethod[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [editingMethod, setEditingMethod] = useState<CustomerPaymentMethod | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [form, setForm] = useState<PaymentMethodFormState>(emptyForm)

  const activeMethods = useMemo(
    () => methods.filter((method) => method.status !== 'disabled'),
    [methods],
  )

  const loadMethods = async () => {
    setError('')
    try {
      setMethods(await paymentMethodsService.list())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể tải phương thức thanh toán.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadMethods()
  }, [])

  const openCreate = () => {
    setEditingMethod(null)
    setForm(emptyForm)
    setIsDialogOpen(true)
  }

  const openEdit = (method: CustomerPaymentMethod) => {
    setEditingMethod(method)
    setForm({
      displayName: method.displayName,
      bankCode: method.bankCode ?? '',
      bankName: method.bankName ?? '',
      accountNumber: '',
      accountHolder: getAccountHolder(method),
      isDefault: method.isDefault,
    })
    setIsDialogOpen(true)
  }

  const closeDialog = () => {
    if (isSaving) return
    setIsDialogOpen(false)
    setEditingMethod(null)
    setForm(emptyForm)
  }

  const save = async () => {
    const accountNumber = form.accountNumber.replace(/\s+/g, '')
    if (!form.bankName.trim() || !form.bankCode.trim()) {
      message.warning('Vui lòng nhập tên ngân hàng và mã ngân hàng.')
      return
    }
    if (!editingMethod && !accountNumber) {
      message.warning('Vui lòng nhập số tài khoản hoàn tiền.')
      return
    }
    if (accountNumber && !/^\d{4,30}$/.test(accountNumber)) {
      message.warning('Số tài khoản phải gồm 4 đến 30 chữ số.')
      return
    }

    setIsSaving(true)
    try {
      const payload = buildChangedPayload(form, editingMethod)
      if (editingMethod) {
        await paymentMethodsService.update(editingMethod._id, payload)
        message.success('Đã cập nhật tài khoản hoàn tiền.')
      } else {
        await paymentMethodsService.create(payload)
        message.success('Đã thêm tài khoản hoàn tiền. Shop sẽ xác minh trước khi sử dụng.')
      }
      setIsDialogOpen(false)
      setEditingMethod(null)
      setForm(emptyForm)
      setIsLoading(true)
      await loadMethods()
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : 'Không thể lưu tài khoản hoàn tiền.')
    } finally {
      setIsSaving(false)
    }
  }

  const setDefault = async (method: CustomerPaymentMethod) => {
    try {
      await paymentMethodsService.setDefault(method._id)
      message.success('Đã đặt làm tài khoản mặc định.')
      setIsLoading(true)
      await loadMethods()
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : 'Không thể đặt mặc định.')
    }
  }

  const disable = async (method: CustomerPaymentMethod) => {
    if (!window.confirm('Vô hiệu hóa tài khoản hoàn tiền này?')) return
    try {
      await paymentMethodsService.disable(method._id)
      message.success('Đã vô hiệu hóa tài khoản.')
      setIsLoading(true)
      await loadMethods()
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : 'Không thể vô hiệu hóa tài khoản.')
    }
  }

  return (
    <section className="account-payment-methods" aria-labelledby="account-payment-methods-title">
      <div className="account-section-heading">
        <div>
          <h1 id="account-payment-methods-title">Phương thức thanh toán</h1>
          <p>Quản lý tài khoản ngân hàng để shop hoàn tiền khi đơn hàng đủ điều kiện.</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Thêm tài khoản
        </Button>
      </div>

      <Alert
        type="info"
        showIcon
        message="Tài khoản mới hoặc vừa chỉnh sửa sẽ ở trạng thái chờ xác minh. Chỉ tài khoản đã xác minh mới có thể đặt làm mặc định."
      />

      {error && <Alert type="error" showIcon message={error} />}

      <Skeleton active loading={isLoading} paragraph={{ rows: 5 }}>
        {activeMethods.length === 0 ? (
          <Empty description="Chưa có tài khoản hoàn tiền." />
        ) : (
          <div className="account-payment-method-list">
            {activeMethods.map((method) => (
              <article className="account-payment-method-card" key={method._id}>
                <span className="account-payment-method-icon"><BankOutlined /></span>
                <div className="account-payment-method-main">
                  <div>
                    <strong>{method.displayName}</strong>
                    {method.isDefault && <Tag color="blue">Mặc định</Tag>}
                    <Tag color={statusColors[method.status]}>{statusLabels[method.status]}</Tag>
                  </div>
                  <p>{method.bankName || 'Ngân hàng'}{method.bankCode ? ` · ${method.bankCode}` : ''}</p>
                  <span>
                    {method.maskedInfo || 'Số tài khoản đã được bảo vệ'}
                    {getAccountHolder(method) ? ` · ${getAccountHolder(method)}` : ''}
                  </span>
                </div>
                <div className="account-payment-method-actions">
                  <Button
                    size="small"
                    icon={<CheckCircleOutlined />}
                    disabled={method.status !== 'verified' || method.isDefault}
                    onClick={() => void setDefault(method)}
                  >
                    Mặc định
                  </Button>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(method)}>
                    Sửa
                  </Button>
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={() => void disable(method)}>
                    Vô hiệu hóa
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Skeleton>

      <Modal
        open={isDialogOpen}
        title={editingMethod ? 'Cập nhật tài khoản hoàn tiền' : 'Thêm tài khoản hoàn tiền'}
        okText={editingMethod ? 'Lưu thay đổi' : 'Thêm tài khoản'}
        cancelText="Hủy"
        confirmLoading={isSaving}
        onCancel={closeDialog}
        onOk={() => void save()}
      >
        <div className="account-payment-method-form">
          <label>
            <span>Tên hiển thị</span>
            <Input
              value={form.displayName}
              maxLength={120}
              placeholder="Ví dụ: Tài khoản Vietcombank"
              onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
            />
          </label>
          <label>
            <span>Tên ngân hàng</span>
            <Input
              value={form.bankName}
              maxLength={120}
              placeholder="Ví dụ: Vietcombank"
              onChange={(event) => setForm((current) => ({ ...current, bankName: event.target.value }))}
            />
          </label>
          <label>
            <span>Mã ngân hàng</span>
            <Input
              value={form.bankCode}
              maxLength={30}
              placeholder="Ví dụ: VCB"
              onChange={(event) => setForm((current) => ({ ...current, bankCode: event.target.value.toUpperCase() }))}
            />
          </label>
          <label>
            <span>Chủ tài khoản</span>
            <Input
              value={form.accountHolder}
              maxLength={120}
              placeholder="Tên chủ tài khoản"
              onChange={(event) => setForm((current) => ({ ...current, accountHolder: event.target.value }))}
            />
          </label>
          <label>
            <span>{editingMethod ? 'Số tài khoản mới' : 'Số tài khoản'}</span>
            <Input
              value={form.accountNumber}
              maxLength={30}
              placeholder={editingMethod ? 'Để trống nếu không đổi' : 'Nhập số tài khoản'}
              onChange={(event) => setForm((current) => ({ ...current, accountNumber: event.target.value.replace(/\D/g, '') }))}
            />
          </label>
          <Checkbox
            checked={form.isDefault}
            onChange={(event) => setForm((current) => ({ ...current, isDefault: event.target.checked }))}
          >
            Đặt làm tài khoản mặc định sau khi được xác minh
          </Checkbox>
        </div>
      </Modal>
    </section>
  )
}
