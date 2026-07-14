import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  ImagePlus,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react'
import { Button, PageHeader } from '../../components/ui'
import { useToast } from '../../notifications/notification-context'
import {
  storefrontSocialPlatforms,
  type StorefrontSettings,
  type StorefrontSettingsUpdate,
  type StorefrontSocialLink,
  type StorefrontSocialPlatform,
} from '../../../storefront-settings/storefrontSettings.types'
import { getStorefrontSettings, updateStorefrontSettings } from './settings.service'
import './settings.css'

type SocialDraft = StorefrontSocialLink & { clientId: string }
type SettingsDraft = Omit<StorefrontSettings, 'socials'> & { socials: SocialDraft[] }

const platformLabels: Record<StorefrontSocialPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  zalo: 'Zalo',
  other: 'Khác',
}

let socialDraftSequence = 0
const nextClientId = () => `social-${Date.now()}-${socialDraftSequence += 1}`
const MAX_AVATAR_SIZE = 5 * 1024 * 1024
const AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const toDraft = (settings: StorefrontSettings): SettingsDraft => ({
  ...settings,
  socials: settings.socials.map((social) => ({ ...social, clientId: nextClientId() })),
})

const toPayload = (draft: SettingsDraft): StorefrontSettingsUpdate => ({
  identity: draft.identity,
  contact: draft.contact,
  version: draft.version,
  socials: draft.socials.map(({ platform, label, url, enabled }, sortOrder) => ({
    platform,
    label,
    url,
    enabled,
    sortOrder,
  })),
})

const snapshot = (draft: SettingsDraft) => JSON.stringify(toPayload(draft))

const isHttpsUrl = (value: string) => {
  if (!value.trim()) return true
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

const validateDraft = (draft: SettingsDraft) => {
  if (draft.identity.name.trim().length < 2) return 'Tên cửa hàng phải có ít nhất 2 ký tự.'
  if (draft.identity.taxCode && !/^[0-9A-Za-z-]{3,30}$/.test(draft.identity.taxCode.trim())) {
    return 'Mã số thuế chỉ được chứa chữ, số và dấu gạch ngang.'
  }
  if (draft.contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.contact.email.trim())) {
    return 'Email không đúng định dạng.'
  }
  if (draft.contact.phone && !/^[0-9+()\-.\s]{7,30}$/.test(draft.contact.phone.trim())) {
    return 'Số điện thoại không đúng định dạng.'
  }
  if (!isHttpsUrl(draft.contact.mapUrl)) return 'Liên kết bản đồ phải là URL HTTPS hợp lệ.'
  if (draft.socials.length > 12) return 'Chỉ được cấu hình tối đa 12 liên kết mạng xã hội.'

  const seenPlatforms = new Set<string>()
  for (const [index, social] of draft.socials.entries()) {
    if (social.label.trim().length < 2) return `Tên liên kết thứ ${index + 1} phải có ít nhất 2 ký tự.`
    if (!social.url.trim() || !isHttpsUrl(social.url)) {
      return `URL liên kết thứ ${index + 1} phải là URL HTTPS hợp lệ.`
    }
    if (social.platform !== 'other' && seenPlatforms.has(social.platform)) {
      return `${platformLabels[social.platform]} đang được thêm nhiều hơn một lần.`
    }
    seenPlatforms.add(social.platform)
  }
  return null
}

export function StorefrontSettingsPage() {
  const { showToast } = useToast()
  const [draft, setDraft] = useState<SettingsDraft | null>(null)
  const [baseline, setBaseline] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('')

  const dirty = useMemo(
    () => Boolean(draft && baseline && (snapshot(draft) !== baseline || avatarFile)),
    [avatarFile, baseline, draft],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const settings = await getStorefrontSettings()
      const nextDraft = toDraft(settings)
      setDraft(nextDraft)
      setBaseline(snapshot(nextDraft))
      setAvatarFile(null)
      setAvatarPreviewUrl('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể tải cấu hình cửa hàng.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => () => {
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
  }, [avatarPreviewUrl])

  useEffect(() => {
    if (!dirty) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  const updateIdentity = (field: keyof SettingsDraft['identity'], value: string) => {
    setDraft((current) => current ? {
      ...current,
      identity: { ...current.identity, [field]: value },
    } : current)
  }

  const updateContact = (field: keyof SettingsDraft['contact'], value: string) => {
    setDraft((current) => current ? {
      ...current,
      contact: { ...current.contact, [field]: value },
    } : current)
  }

  const selectAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!AVATAR_MIME_TYPES.has(file.type)) {
      setError('Avatar chỉ hỗ trợ ảnh JPEG, PNG hoặc WEBP.')
      return
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setError('Avatar không được vượt quá 5 MB.')
      return
    }

    setError('')
    setAvatarFile(file)
    setAvatarPreviewUrl(URL.createObjectURL(file))
  }

  const removeAvatar = () => {
    setAvatarFile(null)
    setAvatarPreviewUrl('')
    updateIdentity('avatarUrl', '')
  }

  const updateSocial = <K extends keyof SocialDraft>(clientId: string, field: K, value: SocialDraft[K]) => {
    setDraft((current) => current ? {
      ...current,
      socials: current.socials.map((social) => social.clientId === clientId
        ? { ...social, [field]: value }
        : social),
    } : current)
  }

  const addSocial = () => {
    setDraft((current) => {
      if (!current || current.socials.length >= 12) return current
      const used = new Set(current.socials.map((social) => social.platform))
      const platform = storefrontSocialPlatforms.find((candidate) => candidate === 'other' || !used.has(candidate)) ?? 'other'
      return {
        ...current,
        socials: [
          ...current.socials,
          {
            clientId: nextClientId(),
            platform,
            label: platformLabels[platform],
            url: '',
            enabled: true,
            sortOrder: current.socials.length,
          },
        ],
      }
    })
  }

  const removeSocial = (clientId: string) => {
    setDraft((current) => current ? {
      ...current,
      socials: current.socials.filter((social) => social.clientId !== clientId),
    } : current)
  }

  const moveSocial = (index: number, direction: -1 | 1) => {
    setDraft((current) => {
      if (!current) return current
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= current.socials.length) return current
      const socials = [...current.socials]
      ;[socials[index], socials[nextIndex]] = [socials[nextIndex], socials[index]]
      return { ...current, socials }
    })
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft || saving) return

    const validationError = validateDraft(draft)
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError('')
    try {
      const settings = await updateStorefrontSettings(toPayload(draft), avatarFile)
      const nextDraft = toDraft(settings)
      setDraft(nextDraft)
      setBaseline(snapshot(nextDraft))
      setAvatarFile(null)
      setAvatarPreviewUrl('')
      showToast('Đã cập nhật thông tin cửa hàng.', 'success')
      window.dispatchEvent(new Event('storefront-settings:refresh'))
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Không thể lưu cấu hình cửa hàng.'
      setError(message)
      showToast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const reload = () => {
    if (dirty && !window.confirm('Bỏ các thay đổi chưa lưu và tải lại dữ liệu?')) return
    void load()
  }

  if (loading && !draft) {
    return <div className="storefront-settings-state" role="status">Đang tải cấu hình cửa hàng...</div>
  }

  if (!draft) {
    return (
      <div className="storefront-settings-state is-error" role="alert">
        <strong>Không thể mở cài đặt cửa hàng</strong>
        <span>{error}</span>
        <Button variant="primary" onClick={() => void load()}>Thử lại</Button>
      </div>
    )
  }

  const enabledSocials = draft.socials.filter((social) => social.enabled && social.url.trim())
  const displayedAvatarUrl = avatarPreviewUrl || draft.identity.avatarUrl

  return (
    <form className="storefront-settings-page" onSubmit={submit}>
      <PageHeader
        breadcrumbs={['Hệ thống', 'Cài đặt']}
        title="Thông tin cửa hàng"
        description="Một nguồn dữ liệu dùng chung cho website, ứng dụng mobile và các trang chính sách."
        actions={(
          <>
            <Button icon={<RefreshCw />} disabled={loading || saving} onClick={reload}>Tải lại</Button>
            <Button variant="primary" icon={<Save />} disabled={!dirty || saving} type="submit">
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </>
        )}
      />

      <div className="storefront-settings-meta">
        <span className={draft.configured ? 'is-configured' : 'is-default'}>
          {draft.configured ? `Đã lưu · phiên bản ${draft.version}` : 'Đang dùng dữ liệu mặc định · chưa lưu vào hệ thống'}
        </span>
        {draft.updatedAt ? <time>Cập nhật {new Date(draft.updatedAt).toLocaleString('vi-VN')}</time> : null}
        {dirty ? <strong>Có thay đổi chưa lưu</strong> : null}
      </div>

      {error ? <div className="storefront-settings-error" role="alert">{error}</div> : null}

      <div className="storefront-settings-layout">
        <div className="storefront-settings-fields">
          <section className="storefront-settings-card">
            <header><div><span>01</span><h2>Nhận diện cửa hàng</h2></div><p>Tên thương hiệu và thông tin pháp lý hiển thị cho khách hàng.</p></header>
            <div className="storefront-settings-grid">
              <div className="storefront-avatar-field is-wide">
                <span>Avatar cửa hàng</span>
                <div className="storefront-avatar-editor">
                  <div className="storefront-avatar-preview">
                    {displayedAvatarUrl
                      ? <img src={displayedAvatarUrl} alt="Xem trước avatar cửa hàng" />
                      : <ImagePlus aria-hidden="true" />}
                  </div>
                  <div className="storefront-avatar-actions">
                    <strong>{avatarFile?.name || (draft.identity.avatarUrl ? 'Avatar đang sử dụng' : 'Chưa có avatar')}</strong>
                    <small>Ảnh vuông JPEG, PNG hoặc WEBP · tối đa 5 MB.</small>
                    <div>
                      <label className="storefront-avatar-picker">
                        <ImagePlus aria-hidden="true" />
                        <span>{displayedAvatarUrl ? 'Thay ảnh' : 'Chọn ảnh'}</span>
                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectAvatar} />
                      </label>
                      {displayedAvatarUrl ? <Button variant="ghost" icon={<Trash2 />} onClick={removeAvatar}>Xóa ảnh</Button> : null}
                    </div>
                  </div>
                </div>
              </div>
              <label><span>Tên hiển thị *</span><input required minLength={2} maxLength={80} value={draft.identity.name} onChange={(event) => updateIdentity('name', event.target.value)} /></label>
              <label><span>Tên pháp lý</span><input maxLength={160} value={draft.identity.legalName} onChange={(event) => updateIdentity('legalName', event.target.value)} /></label>
              <label><span>Mã số thuế</span><input maxLength={30} value={draft.identity.taxCode} onChange={(event) => updateIdentity('taxCode', event.target.value)} /></label>
              <label><span>Slogan</span><input maxLength={160} value={draft.identity.tagline} onChange={(event) => updateIdentity('tagline', event.target.value)} /></label>
              <label className="is-wide"><span>Giới thiệu ngắn</span><textarea rows={4} maxLength={500} value={draft.identity.description} onChange={(event) => updateIdentity('description', event.target.value)} /></label>
            </div>
          </section>

          <section className="storefront-settings-card">
            <header><div><span>02</span><h2>Thông tin liên hệ</h2></div><p>Được dùng tại footer, trung tâm hỗ trợ và trang chính sách.</p></header>
            <div className="storefront-settings-grid">
              <label><span>Hotline</span><input inputMode="tel" maxLength={30} value={draft.contact.phone} onChange={(event) => updateContact('phone', event.target.value)} /></label>
              <label><span>Email</span><input type="email" maxLength={254} value={draft.contact.email} onChange={(event) => updateContact('email', event.target.value)} /></label>
              <label className="is-wide"><span>Giờ hỗ trợ</span><input maxLength={120} placeholder="Ví dụ: 08:30 – 21:45 mỗi ngày" value={draft.contact.hours} onChange={(event) => updateContact('hours', event.target.value)} /></label>
              <label className="is-wide"><span>Địa chỉ</span><textarea rows={3} maxLength={300} value={draft.contact.address} onChange={(event) => updateContact('address', event.target.value)} /></label>
              <label className="is-wide"><span>Liên kết Google Maps</span><input type="url" maxLength={1000} placeholder="https://..." value={draft.contact.mapUrl} onChange={(event) => updateContact('mapUrl', event.target.value)} /></label>
            </div>
          </section>

          <section className="storefront-settings-card">
            <header className="with-action">
              <div><span>03</span><h2>Mạng xã hội</h2></div>
              <Button icon={<Plus />} disabled={draft.socials.length >= 12} onClick={addSocial}>Thêm liên kết</Button>
            </header>
            {draft.socials.length ? (
              <div className="storefront-social-editor">
                {draft.socials.map((social, index) => (
                  <article key={social.clientId} className={social.enabled ? '' : 'is-disabled'}>
                    <div className="storefront-social-order">
                      <Button iconOnly icon={<ArrowUp />} disabled={index === 0} onClick={() => moveSocial(index, -1)}>Đưa lên</Button>
                      <Button iconOnly icon={<ArrowDown />} disabled={index === draft.socials.length - 1} onClick={() => moveSocial(index, 1)}>Đưa xuống</Button>
                    </div>
                    <label><span>Nền tảng</span><select value={social.platform} onChange={(event) => {
                      const platform = event.target.value as StorefrontSocialPlatform
                      updateSocial(social.clientId, 'platform', platform)
                      if (social.label === platformLabels[social.platform]) updateSocial(social.clientId, 'label', platformLabels[platform])
                    }}>{storefrontSocialPlatforms.map((platform) => <option key={platform} value={platform}>{platformLabels[platform]}</option>)}</select></label>
                    <label><span>Tên hiển thị</span><input maxLength={40} value={social.label} onChange={(event) => updateSocial(social.clientId, 'label', event.target.value)} /></label>
                    <label className="is-url"><span>URL HTTPS</span><input type="url" maxLength={1000} placeholder="https://..." value={social.url} onChange={(event) => updateSocial(social.clientId, 'url', event.target.value)} /></label>
                    <label className="storefront-social-toggle"><input type="checkbox" checked={social.enabled} onChange={(event) => updateSocial(social.clientId, 'enabled', event.target.checked)} /><span>Hiển thị</span></label>
                    <Button variant="ghost" iconOnly icon={<Trash2 />} onClick={() => removeSocial(social.clientId)}>Xóa liên kết</Button>
                  </article>
                ))}
              </div>
            ) : <div className="storefront-social-empty">Chưa có liên kết mạng xã hội. Các ứng dụng sẽ tự ẩn khu vực này.</div>}
          </section>
        </div>

        <aside className="storefront-settings-preview">
          <span>XEM TRƯỚC</span>
          <div className="storefront-preview-brand">
            <div className="storefront-preview-avatar">
              {displayedAvatarUrl
                ? <img src={displayedAvatarUrl} alt="Avatar cửa hàng" />
                : <ImagePlus aria-hidden="true" />}
            </div>
            <div><strong>{draft.identity.name || 'Tên cửa hàng'}</strong><small>{draft.identity.tagline || 'Slogan của cửa hàng'}</small></div>
          </div>
          <p>{draft.identity.description || 'Phần giới thiệu ngắn sẽ hiển thị tại đây.'}</p>
          <dl>
            {draft.contact.phone ? <div><dt>Hotline</dt><dd>{draft.contact.phone}</dd></div> : null}
            {draft.contact.email ? <div><dt>Email</dt><dd>{draft.contact.email}</dd></div> : null}
            {draft.contact.hours ? <div><dt>Giờ hỗ trợ</dt><dd>{draft.contact.hours}</dd></div> : null}
            {draft.contact.address ? <div><dt>Địa chỉ</dt><dd>{draft.contact.address}</dd></div> : null}
          </dl>
          {enabledSocials.length ? <div className="storefront-preview-socials">{enabledSocials.map((social) => <a key={social.clientId} href={social.url} target="_blank" rel="noreferrer">{social.label}<ExternalLink /></a>)}</div> : <small>Chưa có mạng xã hội đang hiển thị.</small>}
        </aside>
      </div>
    </form>
  )
}
