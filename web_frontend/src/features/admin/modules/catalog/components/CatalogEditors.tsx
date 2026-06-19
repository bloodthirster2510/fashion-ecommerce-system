import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import type {
  BrandInput,
  CatalogGender,
  CategoryInput,
  ManagedBrand,
  ManagedCategory,
} from '../catalog.types'

const emptyCategoryForm: CategoryInput = {
  name: '',
  parent_id: null,
  level: 1,
  gender: 'unisex',
  image: '',
  description: '',
  isActive: true,
}

const emptyBrandForm: BrandInput = {
  name: '',
  image: '',
  isActive: true,
}

const maxImageFileSizeBytes = 5 * 1024 * 1024
const acceptedImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

const getImageFileValidationError = (file: File | null) => {
  if (!file) return ''
  if (!acceptedImageMimeTypes.has(file.type)) {
    return 'Chỉ hỗ trợ ảnh JPEG, PNG hoặc WEBP.'
  }
  if (file.size > maxImageFileSizeBytes) {
    return 'Ảnh tải lên không được vượt quá 5MB.'
  }
  return ''
}

const getCategoryDescendantIds = (
  categories: ManagedCategory[],
  categoryId?: string,
) => {
  const blockedIds = new Set<string>()
  if (!categoryId) return blockedIds

  const childrenByParentId = new Map<string, ManagedCategory[]>()
  categories.forEach((category) => {
    if (!category.parent_id) return

    const children = childrenByParentId.get(category.parent_id) ?? []
    children.push(category)
    childrenByParentId.set(category.parent_id, children)
  })

  const visit = (currentId: string) => {
    if (blockedIds.has(currentId)) return

    blockedIds.add(currentId)
    const children = childrenByParentId.get(currentId) ?? []
    children.forEach((child) => visit(child._id))
  }

  visit(categoryId)
  return blockedIds
}

export function CatalogSection({
  title,
  actionLabel,
  canWrite,
  onAdd,
  children,
}: {
  title: string
  actionLabel: string
  canWrite: boolean
  onAdd: () => void
  children: ReactNode
}) {
  return (
    <section className="admin-catalog-section">
      <header>
        <h2>{title}</h2>
        <button className="admin-primary-button" type="button" disabled={!canWrite} onClick={onAdd}>
          {actionLabel}
        </button>
      </header>
      {children}
    </section>
  )
}

export function StatusPill({ isActive }: { isActive: boolean }) {
  return (
    <span className={`admin-status-pill ${isActive ? 'is-active' : 'is-blocked'}`}>
      {isActive ? 'Hoạt động' : 'Tạm ngừng'}
    </span>
  )
}

export function RowActions({
  disabled,
  onView,
  onEdit,
  onDelete,
}: {
  disabled: boolean
  onView?: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="admin-row-actions-wrapper">
      <div className="admin-row-actions">
        {onView ? (
          <button className="admin-secondary-link" type="button" onClick={onView}>
            <ViewIcon />
            <span>Xem</span>
          </button>
        ) : null}
        <button className="admin-link-button" type="button" disabled={disabled} onClick={onEdit}>
          <EditIcon />
          <span>Sửa</span>
        </button>
        <button className="admin-danger-link" type="button" disabled={disabled} onClick={onDelete}>
          <DeleteIcon />
          <span>Xóa</span>
        </button>
      </div>
    </div>
  )
}

function ViewIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="admin-action-icon">
      <path d="M12 5C6.5 5 2 9 1 12c1 3 5.5 7 11 7s10-4 11-7c-1-3-5.5-7-11-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="admin-action-icon">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Z" />
      <path d="M20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z" />
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="admin-action-icon">
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12Zm2.46-7l1.41-1.41L12 10.17l2.12-2.12 1.41 1.41L13.41 11l2.12 2.12-1.41 1.41L12 12.83l-2.12 2.12-1.41-1.41L10.59 11 8.46 8.88Z" />
      <path d="M15.5 1h-4l-1-1h-5l-1 1H1v2h2l.63 15.02C2.84 21.15 4 22 5.4 22h13.2c1.4 0 2.56-.85 2.77-3.98L21 3h2V1h-9.5Z" />
    </svg>
  )
}

export function LoadingRow({ colSpan }: { colSpan: number }) {
  return <tr><td colSpan={colSpan}><div className="admin-table-loading">Đang tải dữ liệu...</div></td></tr>
}

export function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return <tr><td colSpan={colSpan}><div className="admin-table-loading">{label}</div></td></tr>
}

export function CategoryEditor({
  categories,
  item,
  isSaving,
  errorMessage,
  onClose,
  onSave,
}: {
  categories: ManagedCategory[]
  item?: ManagedCategory
  isSaving: boolean
  errorMessage: string
  onClose: () => void
  onSave: (
    input: CategoryInput,
    imageFile?: File | null,
    categoryId?: string,
  ) => Promise<void>
}) {
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [localError, setLocalError] = useState('')
  const [form, setForm] = useState<CategoryInput>(() =>
    item
      ? {
          name: item.name,
          parent_id: item.parent_id ?? null,
          level: item.level,
          gender: item.gender,
          image: item.image,
          description: item.description,
          isActive: item.isActive,
        }
      : emptyCategoryForm,
  )
  const blockedParentIds = useMemo(
    () => getCategoryDescendantIds(categories, item?._id),
    [categories, item?._id],
  )
  const parentOptions = categories.filter(
    (category) => !blockedParentIds.has(category._id) && category.isActive,
  )
  const hasParentCategory = Boolean(form.parent_id)

  const handleParentChange = (parentId: string) => {
    if (parentId && blockedParentIds.has(parentId)) {
      setLocalError('Không thể chọn chính danh mục này hoặc danh mục con làm danh mục cha.')
      return
    }

    setLocalError('')
    const parent = categories.find((category) => category._id === parentId)
    setForm((current) => ({
      ...current,
      parent_id: parentId || null,
      level: parent ? parent.level + 1 : 1,
      gender: parent?.gender ?? current.gender,
    }))
  }

  const handleImageFileChange = (file: File | null, input: HTMLInputElement) => {
    const validationError = getImageFileValidationError(file)
    if (validationError) {
      setImageFile(null)
      setLocalError(validationError)
      input.value = ''
      return
    }

    setLocalError('')
    setImageFile(file)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!form.image.trim() && !imageFile) {
      setLocalError('Vui lòng chọn ảnh danh mục hoặc nhập URL ảnh.')
      return
    }
    if (form.parent_id && blockedParentIds.has(form.parent_id)) {
      setLocalError('Không thể chọn chính danh mục này hoặc danh mục con làm danh mục cha.')
      return
    }
    setLocalError('')
    void onSave(
      {
        ...form,
        name: form.name.trim(),
        image: form.image.trim(),
        description: form.description.trim(),
      },
      imageFile,
      item?._id,
    )
  }

  return (
    <EditorModal title={item ? 'Sửa danh mục' : 'Thêm danh mục'} isSaving={isSaving} onClose={onClose}>
      <form className="admin-catalog-form" onSubmit={handleSubmit}>
        {errorMessage || localError ? (
          <p className="admin-notice is-error">{errorMessage || localError}</p>
        ) : null}
        <label>
          <span>Tên danh mục</span>
          <input required minLength={2} maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </label>
        <div className="admin-catalog-form-grid">
          <label>
            <span>Danh mục cha</span>
            <select value={form.parent_id ?? ''} onChange={(event) => handleParentChange(event.target.value)}>
              <option value="">Không có</option>
              {parentOptions.map((category) => (
                <option key={category._id} value={category._id}>{category.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Giới tính</span>
            <select
              value={form.gender}
              disabled={hasParentCategory}
              onChange={(event) => setForm({ ...form, gender: event.target.value as CatalogGender })}
            >
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
              <option value="unisex">Unisex</option>
            </select>
          </label>
        </div>
        <label>
          <span>Ảnh danh mục</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => handleImageFileChange(event.target.files?.[0] ?? null, event.currentTarget)}
          />
          <small>JPEG, PNG hoặc WEBP, tối đa 5MB.</small>
          <input type="url" placeholder="Hoặc nhập URL ảnh" value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} />
          <ImagePreview file={imageFile} url={form.image} alt="Ảnh danh mục" />
        </label>
        <label>
          <span>Mô tả</span>
          <textarea required minLength={5} maxLength={1000} rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </label>
        <label className="admin-catalog-checkbox">
          <input
            type="checkbox"
            checked={form.isActive}
            disabled={Boolean(item?.isActive && item.activeProductCount > 0)}
            onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
          />
          <span>Đang hoạt động</span>
        </label>
        {item?.isActive && item.activeProductCount > 0 ? (
          <p className="admin-form-note">
            Danh mục này còn {item.activeProductCount.toLocaleString('vi-VN')} sản phẩm đang bán.
            Không thể tạm ngừng ngay qua form sửa; hãy dùng nút xóa trong quản lý danh mục để xác nhận.
          </p>
        ) : null}
        <EditorActions isSaving={isSaving} onClose={onClose} />
      </form>
    </EditorModal>
  )
}

export function BrandEditor({
  item,
  isSaving,
  errorMessage,
  onClose,
  onSave,
}: {
  item?: ManagedBrand
  isSaving: boolean
  errorMessage: string
  onClose: () => void
  onSave: (input: BrandInput, imageFile?: File | null, brandId?: string) => Promise<void>
}) {
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [localError, setLocalError] = useState('')
  const [form, setForm] = useState<BrandInput>(() =>
    item ? { name: item.name, image: item.image, isActive: item.isActive } : emptyBrandForm,
  )

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!form.image.trim() && !imageFile) {
      setLocalError('Vui lòng chọn logo hoặc nhập URL ảnh.')
      return
    }
    setLocalError('')
    void onSave(
      { ...form, name: form.name.trim(), image: form.image.trim() },
      imageFile,
      item?._id,
    )
  }

  const handleImageFileChange = (file: File | null, input: HTMLInputElement) => {
    const validationError = getImageFileValidationError(file)
    if (validationError) {
      setImageFile(null)
      setLocalError(validationError)
      input.value = ''
      return
    }

    setLocalError('')
    setImageFile(file)
  }

  return (
    <EditorModal title={item ? 'Sửa thương hiệu' : 'Thêm thương hiệu'} isSaving={isSaving} onClose={onClose}>
      <form className="admin-catalog-form" onSubmit={handleSubmit}>
        {errorMessage || localError ? (
          <p className="admin-notice is-error">{errorMessage || localError}</p>
        ) : null}
        <label>
          <span>Tên thương hiệu</span>
          <input required minLength={2} maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </label>
        <label>
          <span>Logo thương hiệu</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => handleImageFileChange(event.target.files?.[0] ?? null, event.currentTarget)}
          />
          <small>JPEG, PNG hoặc WEBP, tối đa 5MB.</small>
          <input type="url" placeholder="Hoặc nhập URL logo" value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} />
          <ImagePreview file={imageFile} url={form.image} alt="Logo thương hiệu" />
        </label>
        <label className="admin-catalog-checkbox">
          <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
          <span>Đang hoạt động</span>
        </label>
        <EditorActions isSaving={isSaving} onClose={onClose} />
      </form>
    </EditorModal>
  )
}

function EditorModal({
  title,
  isSaving,
  onClose,
  children,
}: {
  title: string
  isSaving: boolean
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="admin-catalog-modal-layer" role="dialog" aria-modal="true" aria-labelledby="catalog-editor-title">
      <button className="admin-catalog-modal-backdrop" type="button" aria-label="Đóng" disabled={isSaving} onClick={onClose} />
      <div className="admin-catalog-modal admin-catalog-editor-modal">
        <header>
          <div>
            <p>Catalog</p>
            <h2 id="catalog-editor-title">{title}</h2>
          </div>
          <button className="admin-icon-button" type="button" disabled={isSaving} onClick={onClose} aria-label="Đóng">×</button>
        </header>
        {children}
      </div>
    </div>
  )
}

function EditorActions({ isSaving, onClose }: { isSaving: boolean; onClose: () => void }) {
  return (
    <div className="admin-catalog-form-actions">
      <button className="admin-secondary-button" type="button" disabled={isSaving} onClick={onClose}>Hủy</button>
      <button className="admin-primary-button" type="submit" disabled={isSaving}>
        {isSaving ? 'Đang lưu...' : 'Lưu'}
      </button>
    </div>
  )
}

function ImagePreview({
  file,
  url,
  alt,
}: {
  file?: File | null
  url?: string | null
  alt: string
}) {
  const [previewUrl, setPreviewUrl] = useState(url ?? '')

  useEffect(() => {
    if (!file) {
      setPreviewUrl(url ?? '')
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file, url])

  return previewUrl ? (
    <span className="admin-catalog-image-preview">
      <img src={previewUrl} alt={alt} />
    </span>
  ) : null
}

export function CategoryStatIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M4 5h6l2 2h8v12H4V5Zm2 4v8h12V9H6Zm2 2h8v2H8v-2Z" />
    </svg>
  )
}

export function BrandStatIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M4 4h7l9 9-7 7-9-9V4Zm4 5.5A1.5 1.5 0 1 0 8 6.5a1.5 1.5 0 0 0 0 3Z" />
    </svg>
  )
}
