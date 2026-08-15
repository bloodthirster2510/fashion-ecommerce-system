import { useEffect, useState } from 'react'
import { LockOutlined, MailOutlined, SafetyOutlined } from '@ant-design/icons'
import { Alert, Button, Form, Input, Modal } from 'antd'
import { authService } from '../auth.service'
import type { EmailDeliveryInfo, OtpDeliveryInfo } from '../auth.types'

type RecoveryMethod = 'email' | 'phone'
type RecoveryStage = 'request' | 'phone-otp' | 'reset'

type ForgotPasswordFormValues = {
  identifier: string
  otp?: string
  token?: string
  newPassword: string
  confirmPassword: string
}

type ForgotPasswordFormProps = {
  initialIdentifier?: string
  initialToken?: string
  onCompleted?: () => void
  onLoginClick?: () => void
}

type ForgotPasswordModalProps = ForgotPasswordFormProps & {
  open: boolean
  onClose: () => void
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const vietnamPhonePattern = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/
const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

const getIdentifierMethod = (identifier: string): RecoveryMethod => (
  identifier.includes('@') ? 'email' : 'phone'
)

const getDeliveryMessage = (method: RecoveryMethod, delivery?: EmailDeliveryInfo | OtpDeliveryInfo) => {
  if (method === 'email') {
    const emailDelivery = delivery as EmailDeliveryInfo | undefined
    if (emailDelivery?.mode === 'mock') {
      return `Chế độ thử nghiệm: dùng token ${emailDelivery.testToken ?? 'trong mock outbox backend'}.`
    }
    return 'Nếu tài khoản tồn tại, email khôi phục mật khẩu đã được gửi.'
  }

  const smsDelivery = delivery as OtpDeliveryInfo | undefined
  if (smsDelivery?.mode === 'mock') {
    return `Chế độ thử nghiệm: dùng mã OTP ${smsDelivery.testOtp ?? 'trong mock outbox backend'}.`
  }
  return 'Nếu tài khoản tồn tại, mã OTP đã được gửi qua SMS.'
}

export function ForgotPasswordForm({
  initialIdentifier = '',
  initialToken = '',
  onCompleted,
  onLoginClick,
}: ForgotPasswordFormProps) {
  const [form] = Form.useForm<ForgotPasswordFormValues>()
  const [stage, setStage] = useState<RecoveryStage>(initialIdentifier && initialToken ? 'reset' : 'request')
  const [method, setMethod] = useState<RecoveryMethod>(initialIdentifier ? getIdentifierMethod(initialIdentifier) : 'email')
  const [verifiedPhoneToken, setVerifiedPhoneToken] = useState('')
  const [isRequesting, setIsRequesting] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    form.setFieldsValue({
      identifier: initialIdentifier,
      token: initialToken,
    })

    if (initialIdentifier && initialToken) {
      setMethod(getIdentifierMethod(initialIdentifier))
      setStage('reset')
      setNotice('Liên kết khôi phục đã được mở. Hãy tạo mật khẩu mới.')
    }
  }, [form, initialIdentifier, initialToken])

  const getIdentifier = () => String(form.getFieldValue('identifier') ?? '').trim()

  const clearFeedback = () => {
    setNotice('')
    setError('')
  }

  const requestRecovery = async () => {
    try {
      await form.validateFields(['identifier'])
    } catch {
      return
    }

    const identifier = getIdentifier()

    try {
      setIsRequesting(true)
      clearFeedback()
      const result = await authService.forgotPassword(identifier)
      setMethod(result.method)
      setVerifiedPhoneToken('')

      if (result.method === 'email') {
        const delivery = result.delivery as EmailDeliveryInfo | undefined
        setStage('reset')
        form.setFieldsValue({ token: delivery?.mode === 'mock' ? delivery.testToken : '' })
        setNotice(getDeliveryMessage('email', delivery))
        return
      }

      const delivery = result.delivery as OtpDeliveryInfo | undefined
      setStage('phone-otp')
      form.setFieldsValue({ otp: delivery?.mode === 'mock' ? delivery.testOtp : '' })
      setNotice(getDeliveryMessage('phone', delivery))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể gửi yêu cầu khôi phục.')
    } finally {
      setIsRequesting(false)
    }
  }

  const verifyOtp = async () => {
    try {
      await form.validateFields(['identifier', 'otp'])
    } catch {
      return
    }

    try {
      setIsVerifyingOtp(true)
      clearFeedback()
      const result = await authService.verifyOtp(getIdentifier(), String(form.getFieldValue('otp') ?? '').trim())
      setVerifiedPhoneToken(result.otpToken)
      setStage('reset')
      setNotice('OTP đã xác thực. Hãy tạo mật khẩu mới để hoàn tất.')
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Không thể xác thực mã OTP.')
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  const resetPassword = async (values: ForgotPasswordFormValues) => {
    const token = method === 'email' ? values.token?.trim() : verifiedPhoneToken
    if (!token) {
      setError(method === 'email' ? 'Vui lòng nhập token khôi phục.' : 'Vui lòng xác thực OTP trước.')
      return
    }

    try {
      setIsResetting(true)
      clearFeedback()
      await authService.resetPassword(getIdentifier(), token, values.newPassword, values.confirmPassword)
      form.resetFields()
      setVerifiedPhoneToken('')
      onCompleted?.()
      onLoginClick?.()
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Không thể đặt lại mật khẩu.')
    } finally {
      setIsResetting(false)
    }
  }

  const backToRequest = () => {
    setStage('request')
    setVerifiedPhoneToken('')
    form.setFieldsValue({ otp: '', token: '', newPassword: '', confirmPassword: '' })
    clearFeedback()
  }

  return (
    <div className="forgot-password-content">
      <div className="forgot-password-heading">
        <h2>Quên mật khẩu</h2>
        <p>
          {stage === 'request' && 'Nhập email hoặc số điện thoại để nhận mã khôi phục.'}
          {stage === 'phone-otp' && `Nhập mã OTP đã gửi đến ${getIdentifier()}.`}
          {stage === 'reset' && 'Tạo mật khẩu mới cho tài khoản của bạn.'}
        </p>
      </div>

      {error && <Alert className="auth-alert" type="error" message={error} showIcon />}
      {notice && <Alert className="auth-alert" type="success" message={notice} showIcon />}

      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        className="forgot-password-form"
        onFinish={(values) => {
          if (stage === 'reset') {
            void resetPassword(values)
          }
        }}
        onValuesChange={clearFeedback}
      >
        <Form.Item
          label="Email hoặc số điện thoại"
          name="identifier"
          rules={[
            { required: true, message: 'Vui lòng nhập email hoặc số điện thoại.' },
            {
              validator: (_, value: string) => {
                const normalized = value?.trim()
                if (!normalized || emailPattern.test(normalized) || vietnamPhonePattern.test(normalized)) {
                  return Promise.resolve()
                }
                return Promise.reject(new Error('Email hoặc số điện thoại không hợp lệ.'))
              },
            },
          ]}
        >
          <Input
            prefix={<MailOutlined />}
            placeholder="Nhập email hoặc số điện thoại"
            size="large"
            disabled={stage !== 'request'}
          />
        </Form.Item>

        {stage === 'phone-otp' && (
          <Form.Item
            label="Mã OTP"
            name="otp"
            rules={[
              { required: true, message: 'Vui lòng nhập mã OTP.' },
              { pattern: /^\d{6}$/, message: 'Mã OTP phải gồm 6 chữ số.' },
            ]}
          >
            <Input
              prefix={<SafetyOutlined />}
              placeholder="Nhập mã OTP 6 số"
              size="large"
              inputMode="numeric"
              maxLength={6}
            />
          </Form.Item>
        )}

        {stage === 'reset' && method === 'email' && (
          <Form.Item
            label="Token khôi phục"
            name="token"
            rules={[{ required: true, message: 'Vui lòng nhập token khôi phục.' }]}
          >
            <Input prefix={<SafetyOutlined />} placeholder="Nhập token trong email" size="large" />
          </Form.Item>
        )}

        {stage === 'reset' && (
          <>
            <Form.Item
              label="Mật khẩu mới"
              name="newPassword"
              rules={[
                { required: true, message: 'Vui lòng nhập mật khẩu mới.' },
                {
                  pattern: passwordPattern,
                  message: 'Mật khẩu tối thiểu 8 ký tự, gồm chữ và số.',
                },
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Nhập mật khẩu mới" size="large" />
            </Form.Item>

            <Form.Item
              label="Xác nhận mật khẩu mới"
              name="confirmPassword"
              dependencies={['newPassword']}
              rules={[
                { required: true, message: 'Vui lòng nhập lại mật khẩu mới.' },
                ({ getFieldValue }) => ({
                  validator: (_, value: string) => {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve()
                    }
                    return Promise.reject(new Error('Xác nhận mật khẩu không trùng khớp.'))
                  },
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Nhập lại mật khẩu mới" size="large" />
            </Form.Item>
          </>
        )}

        {stage === 'request' && (
          <Button type="primary" size="large" block loading={isRequesting} onClick={requestRecovery}>
            Gửi mã khôi phục
          </Button>
        )}

        {stage === 'phone-otp' && (
          <div className="forgot-password-actions">
            <Button type="primary" size="large" block loading={isVerifyingOtp} onClick={verifyOtp}>
              Xác thực OTP
            </Button>
            <Button block disabled={isRequesting || isVerifyingOtp} onClick={requestRecovery}>
              Gửi lại OTP
            </Button>
          </div>
        )}

        {stage === 'reset' && (
          <Button type="primary" htmlType="submit" size="large" block loading={isResetting}>
            Đặt lại mật khẩu
          </Button>
        )}

        {stage !== 'request' && (
          <Button className="forgot-password-back" type="link" block onClick={backToRequest}>
            Đổi email hoặc số điện thoại
          </Button>
        )}
      </Form>
    </div>
  )
}

export function ForgotPasswordModal({ open, onClose, ...formProps }: ForgotPasswordModalProps) {
  return (
    <Modal
      className="forgot-password-modal"
      open={open}
      footer={null}
      onCancel={onClose}
      destroyOnHidden
      centered
    >
      <ForgotPasswordForm {...formProps} />
    </Modal>
  )
}
