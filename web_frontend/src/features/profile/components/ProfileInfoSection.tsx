import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Checkbox, Divider, Form, Input, Modal, Select, Space, message } from 'antd'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { tokenService } from '../../../services/tokenService'
import { setCurrentUser } from '../../auth/auth.slice'
import type { AuthUser } from '../../auth/auth.types'
import {
  profileService,
  type GhnDistrict,
  type GhnProvince,
  type GhnWard,
  type UserAddress,
} from '../profile.service'
import type { PasswordFormValues, ProfileFormValues } from '../profile.types'
import { formatDateForInput, getAddressFormValues, passwordPattern } from '../profile.utils'
import { AddressManagerModal } from './AddressManagerModal'

const isFormValidationError = (value: unknown) => Boolean(value && typeof value === 'object' && 'errorFields' in value)

export function ProfileInfoSection() {
  const dispatch = useAppDispatch()
  const currentUser = useAppSelector((state) => state.auth.currentUser)
  const [profileForm] = Form.useForm<ProfileFormValues>()
  const [addAddressForm] = Form.useForm<ProfileFormValues & { customerName: string; phoneNumber: string; isDefault?: boolean }>()
  const [passwordForm] = Form.useForm<PasswordFormValues>()
  const [defaultAddress, setDefaultAddress] = useState<UserAddress | null>(null)
  const [addresses, setAddresses] = useState<UserAddress[]>([])
  const [provinces, setProvinces] = useState<GhnProvince[]>([])
  const [districts, setDistricts] = useState<GhnDistrict[]>([])
  const [wards, setWards] = useState<GhnWard[]>([])
  const [newAddressDistricts, setNewAddressDistricts] = useState<GhnDistrict[]>([])
  const [newAddressWards, setNewAddressWards] = useState<GhnWard[]>([])
  const [isLoadingProvinces, setIsLoadingProvinces] = useState(false)
  const [isLoadingDistricts, setIsLoadingDistricts] = useState(false)
  const [isLoadingWards, setIsLoadingWards] = useState(false)
  const [isLoadingNewAddressDistricts, setIsLoadingNewAddressDistricts] = useState(false)
  const [isLoadingNewAddressWards, setIsLoadingNewAddressWards] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingAddress, setIsSavingAddress] = useState(false)
  const [isSavingNewAddress, setIsSavingNewAddress] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false)
  const [isAddAddressModalOpen, setIsAddAddressModalOpen] = useState(false)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [isEditingAddress, setIsEditingAddress] = useState(false)
  const [pendingAddressId, setPendingAddressId] = useState('')
  const [error, setError] = useState('')

  const applyProfileFormValues = useCallback((user: AuthUser) => {
    profileForm.setFieldsValue({
      name: user.name,
      phone: user.phone,
      gender: user.gender || 'male',
      dateOfBirth: formatDateForInput(user.dateOfBirth),
      email: user.email,
    })
    profileForm.setFields([
      { name: 'name', errors: [] },
      { name: 'phone', errors: [] },
      { name: 'gender', errors: [] },
      { name: 'dateOfBirth', errors: [] },
      { name: 'email', errors: [] },
    ])
  }, [profileForm])

  const applyDefaultAddress = useCallback(async (address: UserAddress | null) => {
    setDefaultAddress(address)
    const addressFormValues = getAddressFormValues(address)
    profileForm.setFieldsValue(addressFormValues)

    setDistricts([])
    setWards([])

    if (addressFormValues.provinceId) {
      const districtItems = await profileService.getGhnDistricts(addressFormValues.provinceId).catch(() => [])
      setDistricts(districtItems)
    }

    if (addressFormValues.districtId) {
      const wardItems = await profileService.getGhnWards(addressFormValues.districtId).catch(() => [])
      setWards(wardItems)
    }
  }, [profileForm])

  useEffect(() => {
    let isMounted = true
    setIsLoadingProvinces(true)

    profileService
      .getGhnProvinces()
      .then((items) => {
        if (isMounted) setProvinces(items)
      })
      .catch(() => undefined)
      .finally(() => {
        if (isMounted) setIsLoadingProvinces(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    const loadAccount = async () => {
      setIsLoading(true)
      setError('')

      try {
        const [user, accountAddresses] = await Promise.all([profileService.getMe(), profileService.getAddresses()])
        const selectedAddress = accountAddresses.find((item) => item.isDefault) || accountAddresses[0] || null

        tokenService.setCurrentUser(user)
        dispatch(setCurrentUser(user))
        setAddresses(accountAddresses)
        applyProfileFormValues(user)
        await applyDefaultAddress(selectedAddress)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Không thể tải thông tin tài khoản.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadAccount()
  }, [applyDefaultAddress, applyProfileFormValues, dispatch])

  const handleProvinceChange = async (provinceId: number) => {
    profileForm.setFieldsValue({ districtId: undefined, wardCode: undefined })
    setDistricts([])
    setWards([])
    setIsLoadingDistricts(true)

    try {
      setDistricts(await profileService.getGhnDistricts(provinceId))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải danh sách quận/huyện GHN.')
    } finally {
      setIsLoadingDistricts(false)
    }
  }

  const handleDistrictChange = async (districtId: number) => {
    profileForm.setFieldValue('wardCode', undefined)
    setWards([])
    setIsLoadingWards(true)

    try {
      setWards(await profileService.getGhnWards(districtId))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải danh sách phường/xã GHN.')
    } finally {
      setIsLoadingWards(false)
    }
  }

  const handleNewAddressProvinceChange = async (provinceId: number) => {
    addAddressForm.setFieldsValue({ districtId: undefined, wardCode: undefined })
    setNewAddressDistricts([])
    setNewAddressWards([])
    setIsLoadingNewAddressDistricts(true)

    try {
      setNewAddressDistricts(await profileService.getGhnDistricts(provinceId))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải danh sách quận/huyện GHN.')
    } finally {
      setIsLoadingNewAddressDistricts(false)
    }
  }

  const handleNewAddressDistrictChange = async (districtId: number) => {
    addAddressForm.setFieldValue('wardCode', undefined)
    setNewAddressWards([])
    setIsLoadingNewAddressWards(true)

    try {
      setNewAddressWards(await profileService.getGhnWards(districtId))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải danh sách phường/xã GHN.')
    } finally {
      setIsLoadingNewAddressWards(false)
    }
  }

  const openAddAddressModal = () => {
    addAddressForm.setFieldsValue({
      customerName: currentUser?.name || '',
      phoneNumber: currentUser?.phone || '',
      isDefault: addresses.length === 0,
    })
    setIsAddAddressModalOpen(true)
  }

  const closeAddAddressModal = () => {
    setIsAddAddressModalOpen(false)
    addAddressForm.resetFields()
    setNewAddressDistricts([])
    setNewAddressWards([])
  }

  const handleProfileSubmit = async () => {
    setIsSavingProfile(true)
    setError('')

    try {
      const values = await profileForm.validateFields(['name', 'phone', 'gender', 'dateOfBirth'])
      const updatedUser = await profileService.updateMe({
        name: values.name.trim(),
        phone: values.phone.trim(),
        gender: values.gender,
        dateOfBirth: values.dateOfBirth,
      })

      tokenService.setCurrentUser(updatedUser)
      dispatch(setCurrentUser(updatedUser))
      applyProfileFormValues(updatedUser)
      setIsEditingProfile(false)
      message.success('Cập nhật thông tin cá nhân thành công.')
    } catch (saveError) {
      if (!isFormValidationError(saveError)) {
        setError(saveError instanceof Error ? saveError.message : 'Không thể cập nhật thông tin cá nhân.')
      }
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleAddressSubmit = async () => {
    setIsSavingAddress(true)
    setError('')

    try {
      const values = await profileForm.validateFields(['streetName', 'provinceId', 'districtId', 'wardCode'])

      if (defaultAddress?._id && values.streetName && values.provinceId && values.districtId && values.wardCode) {
        const selectedProvince = provinces.find((item) => item.ProvinceID === values.provinceId)
        const selectedDistrict = districts.find((item) => item.DistrictID === values.districtId)
        const selectedWard = wards.find((item) => item.WardCode === values.wardCode)

        const updatedAddresses = await profileService.updateAddress(defaultAddress._id, {
          ...defaultAddress,
          streetName: values.streetName.trim(),
          province: selectedProvince?.ProvinceName ?? defaultAddress.province,
          provinceId: values.provinceId,
          provinceCode: String(values.provinceId),
          district: selectedDistrict?.DistrictName ?? defaultAddress.district,
          districtId: values.districtId,
          ward: selectedWard?.WardName ?? defaultAddress.ward,
          wardCode: values.wardCode,
          ghnProvinceId: values.provinceId,
          ghnDistrictId: values.districtId,
          ghnWardCode: values.wardCode,
          ghnMappingStatus: 'manual',
          isDefault: defaultAddress.isDefault,
        })
        const nextDefaultAddress = updatedAddresses.find((item) => item.isDefault) || updatedAddresses[0] || null
        setAddresses(updatedAddresses)
        await applyDefaultAddress(nextDefaultAddress)
        setIsEditingAddress(false)
        message.success('Cập nhật địa chỉ giao hàng thành công.')
      } else {
        setError('Vui lòng thêm địa chỉ giao hàng trước khi cập nhật.')
      }
    } catch (saveError) {
      if (!isFormValidationError(saveError)) {
        setError(saveError instanceof Error ? saveError.message : 'Không thể cập nhật địa chỉ giao hàng.')
      }
    } finally {
      setIsSavingAddress(false)
    }
  }

  const handleCancelProfileEdit = () => {
    if (currentUser) {
      applyProfileFormValues(currentUser)
    }
    setError('')
    setIsEditingProfile(false)
  }

  const handleCancelAddressEdit = () => {
    void applyDefaultAddress(defaultAddress)
    profileForm.setFields([
      { name: 'streetName', errors: [] },
      { name: 'provinceId', errors: [] },
      { name: 'districtId', errors: [] },
      { name: 'wardCode', errors: [] },
    ])
    setError('')
    setIsEditingAddress(false)
  }

  const clearBlankPasswordError = (fieldName: keyof PasswordFormValues) => {
    if (!passwordForm.getFieldValue(fieldName)) {
      passwordForm.setFields([{ name: fieldName, errors: [] }])
    }
  }

  const handleAddAddressSubmit = async (values: ProfileFormValues & { customerName: string; phoneNumber: string; isDefault?: boolean }) => {
    if (!values.streetName || !values.provinceId || !values.districtId || !values.wardCode) return

    setIsSavingNewAddress(true)
    setError('')

    try {
      const selectedProvince = provinces.find((item) => item.ProvinceID === values.provinceId)
      const selectedDistrict = newAddressDistricts.find((item) => item.DistrictID === values.districtId)
      const selectedWard = newAddressWards.find((item) => item.WardCode === values.wardCode)
      const updatedAddresses = await profileService.addAddress({
        customerName: values.customerName.trim(),
        phoneNumber: values.phoneNumber.trim(),
        streetName: values.streetName.trim(),
        province: selectedProvince?.ProvinceName || '',
        provinceId: values.provinceId,
        provinceCode: String(values.provinceId),
        district: selectedDistrict?.DistrictName || '',
        districtId: values.districtId,
        ward: selectedWard?.WardName || '',
        wardCode: values.wardCode,
        ghnProvinceId: values.provinceId,
        ghnDistrictId: values.districtId,
        ghnWardCode: values.wardCode,
        ghnMappingStatus: 'manual',
        isDefault: Boolean(values.isDefault) || addresses.length === 0,
      })
      const nextDefaultAddress = updatedAddresses.find((item) => item.isDefault) || updatedAddresses[0] || null

      setAddresses(updatedAddresses)
      await applyDefaultAddress(nextDefaultAddress)
      closeAddAddressModal()
      message.success('Đã thêm địa chỉ giao hàng.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể thêm địa chỉ giao hàng.')
    } finally {
      setIsSavingNewAddress(false)
    }
  }

  const handlePasswordSubmit = async (values: PasswordFormValues) => {
    setIsChangingPassword(true)
    setError('')

    try {
      await profileService.changePassword(values)
      passwordForm.resetFields()
      message.success('Đổi mật khẩu thành công. Vui lòng đăng nhập lại ở lần truy cập sau nếu phiên hết hạn.')
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : 'Không thể đổi mật khẩu.')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleSetDefaultAddress = async (address: UserAddress) => {
    if (!address._id) return

    setPendingAddressId(address._id)
    setError('')

    try {
      const updatedAddresses = await profileService.setDefaultAddress(address._id)
      const nextDefaultAddress = updatedAddresses.find((item) => item.isDefault) || updatedAddresses[0] || null

      setAddresses(updatedAddresses)
      await applyDefaultAddress(nextDefaultAddress)
      message.success('Đã chọn địa chỉ mặc định.')
    } catch (setDefaultError) {
      setError(setDefaultError instanceof Error ? setDefaultError.message : 'Không thể chọn địa chỉ mặc định.')
    } finally {
      setPendingAddressId('')
    }
  }

  const handleDeleteAddress = async (address: UserAddress) => {
    if (!address._id) return

    setPendingAddressId(address._id)
    setError('')

    try {
      await profileService.deleteAddress(address._id)
      const updatedAddresses = await profileService.getAddresses()
      const nextDefaultAddress = updatedAddresses.find((item) => item.isDefault) || updatedAddresses[0] || null

      setAddresses(updatedAddresses)
      await applyDefaultAddress(nextDefaultAddress)
      message.success('Đã xóa địa chỉ.')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Không thể xóa địa chỉ.')
    } finally {
      setPendingAddressId('')
    }
  }

  return (
    <>
      <Space direction="vertical" size={20} className="profile-panel">
        {error && <Alert type="error" message={error} showIcon />}

        <section aria-labelledby="personal-info-title">
          <h1 id="personal-info-title">Thông tin cá nhân</h1>
          <Form
            form={profileForm}
            layout="vertical"
            requiredMark={false}
            className="account-form"
            disabled={isLoading}
          >
            <div className="account-form-grid">
              <Form.Item label="Họ và tên" name="name" rules={[{ required: true, message: 'Vui lòng nhập họ tên.' }]}>
                <Input disabled={!isEditingProfile} placeholder="Nguyễn Văn A" />
              </Form.Item>

              <Form.Item label="Số điện thoại" name="phone" rules={[{ required: true, message: 'Vui lòng nhập số điện thoại.' }]}>
                <Input disabled={!isEditingProfile} placeholder="0123456789" />
              </Form.Item>

              <Form.Item label="Giới tính" name="gender" rules={[{ required: true, message: 'Vui lòng chọn giới tính.' }]}>
                <Select
                  disabled={!isEditingProfile}
                  placeholder="Chọn giới tính"
                  options={[
                    { value: 'male', label: 'Nam' },
                    { value: 'female', label: 'Nữ' },
                  ]}
                />
              </Form.Item>

              <Form.Item label="Năm sinh" name="dateOfBirth" rules={[{ required: true, message: 'Vui lòng nhập ngày sinh.' }]}>
                <Input disabled={!isEditingProfile} type="date" />
              </Form.Item>
            </div>

            <Form.Item label="Email" name="email">
              <Input disabled placeholder="email@example.com" />
            </Form.Item>

            <Space wrap>
              {isEditingProfile ? (
                <>
                  <Button type="primary" htmlType="button" loading={isSavingProfile} onClick={() => void handleProfileSubmit()}>
                    Lưu
                  </Button>
                  <Button htmlType="button" onClick={handleCancelProfileEdit}>
                    Hủy
                  </Button>
                </>
              ) : (
                <Button type="primary" htmlType="button" disabled={isLoading} onClick={() => setIsEditingProfile(true)}>
                  Cập nhật thông tin
                </Button>
              )}
            </Space>

            <Divider />

            <section className="account-address-fields" aria-labelledby="address-info-title">
              <div className="account-address-heading">
                <h2 id="address-info-title">Địa chỉ giao hàng mặc định</h2>
                <Space wrap>
                  <Button type="primary" htmlType="button" onClick={openAddAddressModal}>
                    Thêm địa chỉ giao hàng
                  </Button>
                  <Button onClick={() => setIsAddressModalOpen(true)}>Quản lý địa chỉ</Button>
                </Space>
              </div>
              <Form.Item
                label="Địa chỉ nhà"
                name="streetName"
                rules={[
                  { required: true, message: 'Vui lòng nhập số nhà, tên đường.' },
                  { min: 5, max: 150, message: 'Địa chỉ chi tiết từ 5 đến 150 ký tự.' },
                ]}
              >
                <Input disabled={!isEditingAddress} placeholder="Số nhà, tên đường, tên tòa nhà" />
              </Form.Item>

              <div className="account-form-grid">
                <Form.Item label="Tỉnh/thành phố" name="provinceId" rules={[{ required: true, message: 'Vui lòng chọn tỉnh/thành phố.' }]}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="Chọn tỉnh/thành phố"
                    loading={isLoadingProvinces}
                    disabled={!isEditingAddress}
                    options={provinces.map((province) => ({
                      label: province.ProvinceName,
                      value: province.ProvinceID,
                    }))}
                    onChange={(value) => void handleProvinceChange(value)}
                  />
                </Form.Item>

                <Form.Item label="Quận/huyện" name="districtId" rules={[{ required: true, message: 'Vui lòng chọn quận/huyện.' }]}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="Chọn quận/huyện"
                    loading={isLoadingDistricts}
                    disabled={!isEditingAddress || !districts.length}
                    options={districts.map((district) => ({
                      label: district.DistrictName,
                      value: district.DistrictID,
                    }))}
                    onChange={(value) => void handleDistrictChange(value)}
                  />
                </Form.Item>

                <Form.Item label="Phường/xã" name="wardCode" rules={[{ required: true, message: 'Vui lòng chọn phường/xã.' }]}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="Chọn phường/xã"
                    loading={isLoadingWards}
                    disabled={!isEditingAddress || !wards.length}
                    options={wards.map((ward) => ({
                      label: ward.WardName,
                      value: ward.WardCode,
                    }))}
                  />
                </Form.Item>
              </div>

              <Space wrap>
                {isEditingAddress ? (
                  <>
                    <Button type="primary" htmlType="button" loading={isSavingAddress} onClick={() => void handleAddressSubmit()}>
                      Lưu
                    </Button>
                    <Button htmlType="button" onClick={handleCancelAddressEdit}>
                      Hủy
                    </Button>
                  </>
                ) : (
                  <Button type="primary" htmlType="button" disabled={isLoading || !defaultAddress} onClick={() => setIsEditingAddress(true)}>
                    Cập nhật địa chỉ
                  </Button>
                )}
              </Space>
            </section>
          </Form>
        </section>

        <Divider />

        <section aria-labelledby="security-title">
          <h2 id="security-title">Tài khoản & Bảo mật</h2>
          <Form
            form={passwordForm}
            layout="vertical"
            requiredMark={false}
            className="account-form"
            onFinish={handlePasswordSubmit}
          >
            <Form.Item label="Tên đăng nhập">
              <Input disabled value={currentUser?.email || ''} />
              <p className="field-hint">Tên đăng nhập không thể thay đổi</p>
            </Form.Item>

            <Form.Item label="Mật khẩu hiện tại" name="currentPassword" rules={[{ required: true, message: 'Vui lòng nhập mật khẩu hiện tại.' }]}>
              <Input.Password
                placeholder="Nhập mật khẩu hiện tại"
                onBlur={() => clearBlankPasswordError('currentPassword')}
                onFocus={() => clearBlankPasswordError('currentPassword')}
              />
            </Form.Item>

            <div className="account-form-grid">
              <Form.Item
                label="Mật khẩu mới"
                name="newPassword"
                rules={[
                  {
                    required: true,
                    pattern: passwordPattern,
                    message: 'Mật khẩu mới tối thiểu 8 ký tự, gồm chữ và số.',
                  },
                ]}
              >
                <Input.Password
                  placeholder="Nhập mật khẩu mới"
                  onBlur={() => clearBlankPasswordError('newPassword')}
                  onFocus={() => clearBlankPasswordError('newPassword')}
                />
              </Form.Item>

              <Form.Item
                label="Xác nhận mật khẩu mới"
                name="confirmPassword"
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: 'Vui lòng xác nhận mật khẩu mới.' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve()
                      }

                      return Promise.reject(new Error('Xác nhận mật khẩu không trùng khớp.'))
                    },
                  }),
                ]}
              >
                <Input.Password
                  placeholder="Nhập lại mật khẩu mới"
                  onBlur={() => clearBlankPasswordError('confirmPassword')}
                  onFocus={() => clearBlankPasswordError('confirmPassword')}
                />
              </Form.Item>
            </div>

            <Alert
              className="password-note"
              type="info"
              message="Lưu ý: Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ và số."
              showIcon={false}
            />

            <Button type="primary" htmlType="submit" loading={isChangingPassword}>
              Đổi mật khẩu
            </Button>
          </Form>
        </section>
      </Space>

      <AddressManagerModal
        open={isAddressModalOpen}
        addresses={addresses}
        pendingAddressId={pendingAddressId}
        onClose={() => setIsAddressModalOpen(false)}
        onSetDefault={(address) => void handleSetDefaultAddress(address)}
        onDelete={(address) => void handleDeleteAddress(address)}
      />

      <Modal
        title="Thêm địa chỉ giao hàng"
        open={isAddAddressModalOpen}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={isSavingNewAddress}
        onOk={() => addAddressForm.submit()}
        onCancel={closeAddAddressModal}
        width={680}
      >
        <Form
          form={addAddressForm}
          layout="vertical"
          requiredMark={false}
          onFinish={(values) => void handleAddAddressSubmit(values)}
        >
          <div className="account-form-grid">
            <Form.Item label="Người nhận" name="customerName" rules={[{ required: true, message: 'Vui lòng nhập tên người nhận.' }]}>
              <Input placeholder="Nguyễn Văn A" />
            </Form.Item>

            <Form.Item label="Số điện thoại" name="phoneNumber" rules={[{ required: true, message: 'Vui lòng nhập số điện thoại.' }]}>
              <Input placeholder="0123456789" />
            </Form.Item>
          </div>

          <Form.Item
            label="Địa chỉ nhà"
            name="streetName"
            rules={[
              { required: true, message: 'Vui lòng nhập số nhà, tên đường.' },
              { min: 5, max: 150, message: 'Địa chỉ chi tiết từ 5 đến 150 ký tự.' },
            ]}
          >
            <Input placeholder="Số nhà, tên đường, tên tòa nhà" />
          </Form.Item>

          <div className="account-form-grid">
            <Form.Item label="Tỉnh/thành phố" name="provinceId" rules={[{ required: true, message: 'Vui lòng chọn tỉnh/thành phố.' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Chọn tỉnh/thành phố"
                loading={isLoadingProvinces}
                options={provinces.map((province) => ({
                  label: province.ProvinceName,
                  value: province.ProvinceID,
                }))}
                onChange={(value) => void handleNewAddressProvinceChange(value)}
              />
            </Form.Item>

            <Form.Item label="Quận/huyện" name="districtId" rules={[{ required: true, message: 'Vui lòng chọn quận/huyện.' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Chọn quận/huyện"
                loading={isLoadingNewAddressDistricts}
                disabled={!newAddressDistricts.length}
                options={newAddressDistricts.map((district) => ({
                  label: district.DistrictName,
                  value: district.DistrictID,
                }))}
                onChange={(value) => void handleNewAddressDistrictChange(value)}
              />
            </Form.Item>

            <Form.Item label="Phường/xã" name="wardCode" rules={[{ required: true, message: 'Vui lòng chọn phường/xã.' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Chọn phường/xã"
                loading={isLoadingNewAddressWards}
                disabled={!newAddressWards.length}
                options={newAddressWards.map((ward) => ({
                  label: ward.WardName,
                  value: ward.WardCode,
                }))}
              />
            </Form.Item>
          </div>

          <Form.Item name="isDefault" valuePropName="checked">
            <Checkbox>Đặt làm địa chỉ mặc định</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
