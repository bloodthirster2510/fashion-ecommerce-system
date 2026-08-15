import { useEffect, useState } from 'react'
import { Alert, Button, Checkbox, Form, Input, Modal, Select, message } from 'antd'
import { authService } from '../auth.service'
import { AuthApiError, type AuthUser, type Province, type RegisterPayload, type Ward } from '../auth.types'
import { LEGAL_POLICY_VERSION } from '../../policies/policy.constants'

type RegisterModalProps = {
  open: boolean
  onClose: () => void
  onAuthenticated: (user: AuthUser) => void
}

type RegisterFormValues = {
  name: string
  phone: string
  email?: string
  otp: string
  gender: 'male' | 'female'
  birthDay: number
  birthMonth: number
  birthYear: number
  province: string
  ward: string
  streetName: string
  password: string
  confirmPassword: string
  acceptedTerms: boolean
}

type ProvinceOption = {
  label: string
  value: string
  code: number
}

const vietnamPhonePattern = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/
const minimumRegistrationAge = 16
const maximumRegistrationAge = 100

// Danh sách ngày, tháng, năm được tạo tại frontend vì đây là dữ liệu cố định.
// Tỉnh/thành và phường/xã không dùng danh sách tĩnh: chúng được lấy từ API location của backend.
const dayOptions = Array.from({ length: 31 }, (_, index) => ({
  label: String(index + 1),
  value: index + 1,
}))
const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  label: String(index + 1),
  value: index + 1,
}))
const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: maximumRegistrationAge - minimumRegistrationAge + 1 }, (_, index) => ({
  label: String(currentYear - minimumRegistrationAge - index),
  value: currentYear - minimumRegistrationAge - index,
}))

// Backend trả field address dưới dạng object lồng nhau, ví dụ address.province.
// Form Ant Design đang hiển thị các field đó ở cấp đầu để JSX gọn hơn.
// Map này nối tên field backend với tên input frontend khi cần hiển thị lỗi.
const backendFieldMap: Record<string, keyof RegisterFormValues> = {
  'address.province': 'province',
  'address.ward': 'ward',
  'address.streetName': 'streetName',
  'address.customerName': 'name',
  'address.phoneNumber': 'phone',
  otpToken: 'otp',
  dateOfBirth: 'birthDay',
  acceptedTerms: 'acceptedTerms',
}

const buildDateOfBirth = (year: number, month: number, day: number) => {
  const date = new Date(Date.UTC(year, month - 1, day))

  // Date tự chuyển 31/02 thành một ngày trong tháng 03.
  // So sánh ngược lại để loại những ngày không tồn tại trước khi gửi backend.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null
  }

  return date.toISOString().slice(0, 10)
}

const isEligibleBirthDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  const today = new Date()
  let age = today.getFullYear() - year
  const birthdayHasPassed = today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day)
  if (!birthdayHasPassed) age -= 1
  return age >= minimumRegistrationAge && age <= maximumRegistrationAge
}

export function RegisterModal({ open, onClose, onAuthenticated }: RegisterModalProps) {
  const [form] = Form.useForm<RegisterFormValues>()
  const watchedPhone = Form.useWatch('phone', form)

  // provinces được cache trong thời gian component còn tồn tại.
  // wards phụ thuộc tỉnh đang chọn nên phải xóa và tải lại mỗi khi đổi tỉnh.
  const [provinces, setProvinces] = useState<Province[]>([])
  const [wards, setWards] = useState<Ward[]>([])

  // Backend không cho register bằng mã OTP thô.
  // Sau khi verify thành công, backend trả otpToken và token này mới được gửi khi đăng ký.
  const [otpToken, setOtpToken] = useState('')

  // Mỗi thao tác async có loading riêng để chỉ khóa đúng nút đang xử lý.
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [isLoadingWards, setIsLoadingWards] = useState(false)
  const [registerError, setRegisterError] = useState('')
  const isPhoneValid = typeof watchedPhone === 'string' && vietnamPhonePattern.test(watchedPhone.trim())
  const isPhoneVerified = Boolean(otpToken)
  const areRegistrationFieldsDisabled = !isPhoneVerified || isRegistering

  useEffect(() => {
    // Chỉ tải danh sách tỉnh khi modal mở lần đầu.
    // Những lần mở sau tái sử dụng cache để không gọi API location lặp lại.
    if (!open || provinces.length > 0) return

    let isActive = true

    authService
      .getProvinces()
      .then((items) => {
        if (isActive) setProvinces(items)
      })
      .catch((error: unknown) => {
        if (isActive) setRegisterError(error instanceof Error ? error.message : 'Không thể tải danh sách tỉnh/thành phố.')
      })

    // Request location có thể hoàn tất sau khi modal đã đóng.
    // Cờ này ngăn việc cập nhật state của một modal không còn hiển thị.
    return () => {
      isActive = false
    }
  }, [open, provinces.length])

  const resetModal = () => {
    // resetFields xóa cả dữ liệu và lỗi validation của Ant Design.
    // State phụ trợ phải reset riêng vì chúng không nằm trong Form.
    form.resetFields()
    setWards([])
    setOtpToken('')
    setRegisterError('')
  }

  const handleClose = () => {
    resetModal()
    onClose()
  }

  const handlePhoneChange = () => {
    // OTP chỉ có giá trị với đúng số điện thoại đã xác thực.
    // Nếu người dùng sửa số điện thoại, bắt buộc xác thực lại để backend không nhận otpToken cũ.
    if (otpToken) setOtpToken('')
  }

  const handleSendOtp = async () => {
    try {
      // Chỉ validate phone thay vì validate toàn bộ form:
      // người dùng cần nhận OTP trước khi hoàn tất các field đăng ký còn lại.
      const phone = await form.validateFields(['phone']).then((values) => values.phone)
      setIsSendingOtp(true)
      setRegisterError('')
      const delivery = await authService.sendOtp(phone.trim())
      message.success(
        delivery.mode === 'mock'
          ? `Chế độ thử nghiệm — dùng mã OTP: ${delivery.testOtp ?? 'xem mock outbox backend'}.`
          : 'Nhà cung cấp SMS đã tiếp nhận yêu cầu gửi OTP.',
      )
    } catch (error) {
      if (error instanceof Error) setRegisterError(error.message)
    } finally {
      setIsSendingOtp(false)
    }
  }

  const handleVerifyOtp = async () => {
    try {
      // OTP được verify cùng số điện thoại để backend phát otpToken gắn với đúng số đó.
      const values = await form.validateFields(['phone', 'otp'])
      setIsVerifyingOtp(true)
      setRegisterError('')
      const result = await authService.verifyOtp(values.phone.trim(), values.otp.trim())
      setOtpToken(result.otpToken)
      message.success('Xác thực số điện thoại thành công.')
    } catch (error) {
      if (error instanceof Error) setRegisterError(error.message)
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  const handleProvinceChange = async (_provinceName: string, option?: ProvinceOption | ProvinceOption[]) => {
    // Backend location trả về code để tải phường/xã nhưng payload đăng ký cần tên tỉnh.
    // Vì vậy Select lưu name trong form, còn code chỉ được dùng tạm thời cho request kế tiếp.
    form.setFieldValue('ward', undefined)
    setWards([])

    const selectedOption = Array.isArray(option) ? option[0] : option
    if (!selectedOption?.code) return

    setIsLoadingWards(true)
    setRegisterError('')

    try {
      setWards(await authService.getWards(selectedOption.code))
    } catch (error) {
      setRegisterError(error instanceof Error ? error.message : 'Không thể tải danh sách phường/xã.')
    } finally {
      setIsLoadingWards(false)
    }
  }

  const applyBackendErrors = (error: AuthApiError) => {
    if (!error.errors) return

    // Backend dùng đường dẫn lồng nhau như address.province.
    // Form hiển thị các field địa chỉ ở cấp đầu nên cần map lại tên trước khi gắn lỗi vào input.
    form.setFields(
      error.errors.map((item) => ({
        name: backendFieldMap[item.field] || (item.field as keyof RegisterFormValues),
        errors: [item.message],
      })),
    )
  }

  const handleRegister = async (values: RegisterFormValues) => {
    // Ba select ngày/tháng/năm được ghép lại thành YYYY-MM-DD theo contract backend.
    const dateOfBirth = buildDateOfBirth(values.birthYear, values.birthMonth, values.birthDay)

    if (!dateOfBirth) {
      form.setFields([{ name: 'birthDay', errors: ['Ngày sinh không hợp lệ.'] }])
      return
    }

    if (!isEligibleBirthDate(dateOfBirth)) {
      form.setFields([{ name: 'birthDay', errors: [`Ngày sinh chỉ áp dụng cho người từ ${minimumRegistrationAge} tuổi trở lên.`] }])
      return
    }

    if (!otpToken) {
      form.setFields([{ name: 'otp', errors: ['Vui lòng xác thực OTP trước khi đăng ký.'] }])
      return
    }

    // Backend yêu cầu địa chỉ mặc định ngay khi tạo tài khoản.
    // Ở lần đăng ký đầu tiên, tên và số điện thoại người nhận dùng cùng thông tin chủ tài khoản.
    const email = values.email?.trim()

    const payload: RegisterPayload = {
      name: values.name.trim(),
      phone: values.phone.trim(),
      ...(email ? { email } : {}),
      gender: values.gender,
      dateOfBirth,
      address: {
        customerName: values.name.trim(),
        phoneNumber: values.phone.trim(),
        province: values.province,
        ward: values.ward,
        streetName: values.streetName.trim(),
        isDefault: true,
      },
      password: values.password,
      confirmPassword: values.confirmPassword,
      otpToken,
      acceptedTerms: true,
      policyVersion: LEGAL_POLICY_VERSION,
    }

    setIsRegistering(true)
    setRegisterError('')

    try {
      const session = await authService.register(payload)
      onAuthenticated(session.user)
      message.success('Đăng ký tài khoản thành công.')
      handleClose()
    } catch (error) {
      if (error instanceof AuthApiError) applyBackendErrors(error)
      setRegisterError(error instanceof Error ? error.message : 'Không thể đăng ký. Vui lòng thử lại.')
    } finally {
      setIsRegistering(false)
    }
  }

  return (
    <Modal
      rootClassName="register-modal-root"
      className="register-modal"
      open={open}
      footer={null}
      centered
      width={620}
      onCancel={handleClose}
      afterClose={resetModal}
    >
      <h2>Đăng ký tài khoản</h2>

      {registerError && <Alert className="auth-alert" type="error" message={registerError} showIcon />}

      <Form form={form} layout="vertical" className="register-form" onFinish={handleRegister}>
        <section className="register-section">
          <div className="register-section-heading">
            <h3>Xác thực số điện thoại</h3>
            <span>Bắt buộc trước khi đăng ký</span>
          </div>

          <Form.Item
            label="Số điện thoại"
            name="phone"
            rules={[
              { required: true, message: 'Vui lòng nhập số điện thoại.' },
              { pattern: vietnamPhonePattern, message: 'Số điện thoại Việt Nam không hợp lệ.' },
            ]}
          >
            <Input placeholder="Ví dụ: 0901234567" onChange={handlePhoneChange} />
          </Form.Item>

          <div className="register-otp-row">
            <Form.Item
              label="Mã OTP"
              name="otp"
              rules={[
                { required: true, message: 'Vui lòng nhập mã OTP.' },
                { pattern: /^\d{6}$/, message: 'Mã OTP phải gồm 6 chữ số.' },
              ]}
            >
              <Input placeholder="Nhập mã OTP" disabled={Boolean(otpToken)} />
            </Form.Item>
            <Button
              className="register-otp-action register-otp-send"
              onClick={() => void handleSendOtp()}
              loading={isSendingOtp}
              disabled={!isPhoneValid}
            >
              Gửi OTP
            </Button>
            <Button
              className="register-otp-action register-otp-verify"
              onClick={() => void handleVerifyOtp()}
              loading={isVerifyingOtp}
              disabled={!isPhoneValid || Boolean(otpToken)}
            >
              {otpToken ? 'Đã xác thực' : 'Xác thực'}
            </Button>
          </div>
        </section>

        <div className="register-inline-fields">
          <Form.Item
            label="Họ và tên"
            name="name"
            rules={[
              { required: true, message: 'Vui lòng nhập họ và tên.' },
              { min: 2, max: 60, message: 'Họ và tên từ 2 đến 60 ký tự.' },
            ]}
          >
            <Input placeholder="Nhập họ và tên" disabled={areRegistrationFieldsDisabled} />
          </Form.Item>

          <Form.Item
            label="Email (không bắt buộc)"
            name="email"
            rules={[
              { type: 'email', message: 'Email không hợp lệ.' },
            ]}
          >
            <Input placeholder="Nhập email" disabled={areRegistrationFieldsDisabled} />
          </Form.Item>
        </div>

        <div className="register-profile-row">
          <Form.Item label="Giới tính" name="gender" rules={[{ required: true, message: 'Vui lòng chọn giới tính.' }]}>
            <Select
              placeholder="Giới tính"
              disabled={areRegistrationFieldsDisabled}
              options={[
                { label: 'Nam', value: 'male' },
                { label: 'Nữ', value: 'female' },
              ]}
            />
          </Form.Item>

          <div className="register-birthday">
            <span className="register-field-label">Ngày sinh</span>
            <div className="register-birthday-selects">
              <Form.Item name="birthDay" rules={[{ required: true, message: 'Chọn ngày.' }]}>
                <Select placeholder="Ngày" options={dayOptions} disabled={areRegistrationFieldsDisabled} />
              </Form.Item>
              <Form.Item name="birthMonth" rules={[{ required: true, message: 'Chọn tháng.' }]}>
                <Select placeholder="Tháng" options={monthOptions} disabled={areRegistrationFieldsDisabled} />
              </Form.Item>
              <Form.Item name="birthYear" rules={[{ required: true, message: 'Chọn năm.' }]}>
                <Select placeholder="Năm" options={yearOptions} disabled={areRegistrationFieldsDisabled} />
              </Form.Item>
            </div>
          </div>
        </div>

        <h3>Địa chỉ giao hàng mặc định</h3>
        {/* API location hiện dùng hai cấp: tỉnh/thành phố -> phường/xã.
            Không hiển thị quận/huyện vì backend không còn lưu field này. */}
        <div className="register-address-row">
          <Form.Item label="Tỉnh/thành phố" name="province" rules={[{ required: true, message: 'Vui lòng chọn tỉnh/thành phố.' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn tỉnh/thành phố"
              loading={provinces.length === 0 && !registerError}
              disabled={areRegistrationFieldsDisabled}
              options={provinces.map((province) => ({ label: province.name, value: province.name, code: province.code }))}
              onChange={handleProvinceChange}
            />
          </Form.Item>

          <Form.Item label="Phường/xã" name="ward" rules={[{ required: true, message: 'Vui lòng chọn phường/xã.' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn phường/xã"
              loading={isLoadingWards}
              disabled={areRegistrationFieldsDisabled || wards.length === 0}
              options={wards.map((ward) => ({ label: ward.name, value: ward.name }))}
            />
          </Form.Item>

        </div>

        <div className="register-address-row">
          <Form.Item
            label="Địa chỉ chi tiết"
            name="streetName"
            rules={[
              { required: true, message: 'Vui lòng nhập địa chỉ chi tiết.' },
              { min: 5, max: 150, message: 'Địa chỉ chi tiết từ 5 đến 150 ký tự.' },
            ]}
          >
            <Input placeholder="Số nhà, tên đường" disabled={areRegistrationFieldsDisabled} />
          </Form.Item>
        </div>

        <div className="register-inline-fields">
          <Form.Item
            label="Mật khẩu"
            name="password"
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu.' },
              { min: 8, message: 'Mật khẩu tối thiểu 8 ký tự.' },
            ]}
          >
            <Input.Password placeholder="Nhập mật khẩu" disabled={areRegistrationFieldsDisabled} />
          </Form.Item>

          <Form.Item
            label="Nhập lại mật khẩu"
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Vui lòng nhập lại mật khẩu.' },
              // dependencies yêu cầu Ant Design chạy lại validator này khi mật khẩu gốc thay đổi.
              // Nhờ đó field xác nhận không thể giữ trạng thái hợp lệ nếu người dùng sửa mật khẩu.
              ({ getFieldValue }) => ({
                validator(_, value: string) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve()
                  }

                  return Promise.reject(new Error('Mật khẩu nhập lại không khớp.'))
                },
              }),
            ]}
          >
            <Input.Password placeholder="Nhập lại mật khẩu" disabled={areRegistrationFieldsDisabled} />
          </Form.Item>
        </div>

        <Form.Item
          name="acceptedTerms"
          valuePropName="checked"
          rules={[{
            validator: (_, checked: boolean) => checked
              ? Promise.resolve()
              : Promise.reject(new Error('Vui lòng đồng ý với điều khoản và chính sách bảo mật.')),
          }]}
        >
          <Checkbox disabled={areRegistrationFieldsDisabled}>
            Tôi đồng ý với <a href="/policies/terms" target="_blank" rel="noreferrer">Điều khoản sử dụng</a>
            {' '}và <a href="/policies/privacy" target="_blank" rel="noreferrer">Chính sách bảo mật</a>.
          </Checkbox>
        </Form.Item>

        <Button
          type="primary"
          htmlType="submit"
          block
          className="register-submit"
          loading={isRegistering}
          disabled={!isPhoneVerified}
        >
          Đăng ký
        </Button>
      </Form>
    </Modal>
  )
}
