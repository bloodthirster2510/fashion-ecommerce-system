import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { TagsOutlined } from '@ant-design/icons'
import type {
  BrandInput,
  CatalogGender,
  CategoryInput,
  CategoryFitTypeInput,
  FitTypeTemplateInput,
  ManagedBrand,
  ManagedCategory,
  SizeTemplateInput,
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

const getRootCategoryIds = (categories: ManagedCategory[], categoryIds: string[]) => {
  const selectedIds = new Set(categoryIds)

  return categoryIds.filter((categoryId) => {
    let parentId = categories.find((category) => category._id === categoryId)?.parent_id ?? null

    while (parentId) {
      if (selectedIds.has(parentId)) return false
      parentId = categories.find((category) => category._id === parentId)?.parent_id ?? null
    }

    return true
  })
}

const getPersistedExcludedCategoryIds = (
  categories: ManagedCategory[],
  rootCategoryIds: string[],
  integratedCategoryIds: string[],
) => {
  const integratedIds = new Set(integratedCategoryIds)

  return [
    ...new Set(
      rootCategoryIds.flatMap((categoryId) => [
        ...getCategoryDescendantIds(categories, categoryId),
      ]),
    ),
  ].filter((categoryId) => !integratedIds.has(categoryId))
}

const getSizeTemplateLabel = (category?: ManagedCategory | null) =>
  category?.sizeTemplateName?.trim() || category?.name || ''

const getFitTypeTemplateLabel = (category?: ManagedCategory | null) =>
  category?.fitTypeTemplateName?.trim() || category?.name || ''

const normalizeFitTypeKey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const getCategoryPathLabel = (
  category: ManagedCategory,
  categoryById: Map<string, ManagedCategory>,
) => {
  const names = [category.name]
  let parentId = category.parent_id ?? null

  while (parentId) {
    const parent = categoryById.get(parentId)
    if (!parent) break
    names.unshift(parent.name)
    parentId = parent.parent_id ?? null
  }

  return names.join(' / ')
}

function CategoryApplySelect({
  categories,
  categoryById,
  disabled,
  value,
  onChange,
}: {
  categories: ManagedCategory[]
  categoryById: Map<string, ManagedCategory>
  disabled: boolean
  value: string
  onChange: (categoryId: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedCategory = value ? categoryById.get(value) : undefined

  const handleSelect = (categoryId: string) => {
    onChange(categoryId)
    setIsOpen(false)
  }

  return (
    <div className="admin-category-apply-select">
      <button
        className="admin-category-apply-trigger"
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>
          {selectedCategory ? getCategoryPathLabel(selectedCategory, categoryById) : 'Chọn danh mục'}
        </span>
        <span className="admin-category-apply-chevron" aria-hidden="true" />
      </button>
      {isOpen ? (
        <div className="admin-category-apply-menu" role="listbox">
          <button
            className={!value ? 'is-selected' : ''}
            type="button"
            role="option"
            aria-selected={!value}
            onClick={() => handleSelect('')}
          >
            Chọn danh mục
          </button>
          {categories.map((category) => (
            <button
              className={category._id === value ? 'is-selected' : ''}
              type="button"
              role="option"
              aria-selected={category._id === value}
              key={category._id}
              onClick={() => handleSelect(category._id)}
            >
              {getCategoryPathLabel(category, categoryById)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function CatalogSection({
  title,
  actionLabel,
  secondaryActions,
  secondaryActionLabel,
  secondaryActionClassName,
  canWrite,
  onAdd,
  onSecondaryAction,
  children,
}: {
  title: string
  actionLabel: string
  secondaryActions?: Array<{
    label: string
    className?: string
    onClick: () => void
  }>
  secondaryActionLabel?: string
  secondaryActionClassName?: string
  canWrite: boolean
  onAdd: () => void
  onSecondaryAction?: () => void
  children: ReactNode
}) {
  const sectionActions =
    secondaryActions ??
    (secondaryActionLabel && onSecondaryAction
      ? [{
          label: secondaryActionLabel,
          className: secondaryActionClassName,
          onClick: onSecondaryAction,
        }]
      : [])

  return (
    <section className="admin-catalog-section">
      <header>
        <h2>{title}</h2>
        <div className="admin-catalog-section-actions">
          {sectionActions.map((action) => (
            <button
              className={`admin-secondary-button${action.className ? ` ${action.className}` : ''}`}
              type="button"
              disabled={!canWrite}
              onClick={action.onClick}
              key={action.label}
            >
              {action.label}
            </button>
          ))}
          <button className="admin-primary-button" type="button" disabled={!canWrite} onClick={onAdd}>
            {actionLabel}
          </button>
        </div>
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
          <button className="admin-view-link" type="button" onClick={onView}>
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
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'name' | 'image' | 'description', string>>>({})
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
      setFieldErrors((current) => ({ ...current, image: validationError }))
      input.value = ''
      return
    }

    setLocalError('')
    setFieldErrors((current) => ({ ...current, image: '' }))
    setImageFile(file)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const nextFieldErrors: Partial<Record<'name' | 'image' | 'description', string>> = {}
    const trimmedName = form.name.trim()
    const trimmedDescription = form.description.trim()

    if (!trimmedName) nextFieldErrors.name = 'Vui lòng nhập tên danh mục.'
    else if (trimmedName.length < 2) nextFieldErrors.name = 'Tên danh mục phải có ít nhất 2 ký tự.'
    if (!form.image.trim() && !imageFile) nextFieldErrors.image = 'Vui lòng chọn ảnh danh mục.'
    if (!trimmedDescription) nextFieldErrors.description = 'Vui lòng nhập mô tả danh mục.'
    else if (trimmedDescription.length < 5) nextFieldErrors.description = 'Mô tả phải có ít nhất 5 ký tự.'

    setFieldErrors(nextFieldErrors)
    if (Object.keys(nextFieldErrors).length > 0) return

    if (form.parent_id && blockedParentIds.has(form.parent_id)) {
      setLocalError('Không thể chọn chính danh mục này hoặc danh mục con làm danh mục cha.')
      return
    }
    setLocalError('')
    const normalizedImage = form.image.trim()
    const shouldSendImage = Boolean(imageFile) || !item || normalizedImage !== item.image.trim()
    void onSave(
      {
        ...form,
        name: form.name.trim(),
        image: shouldSendImage ? normalizedImage : '',
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
          <input
            minLength={2}
            maxLength={80}
            value={form.name}
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? 'category-name-error' : undefined}
            onChange={(event) => {
              setForm({ ...form, name: event.target.value })
              setFieldErrors((current) => ({ ...current, name: '' }))
            }}
          />
          {fieldErrors.name ? <small id="category-name-error" className="admin-field-error">{fieldErrors.name}</small> : null}
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
          <ImageFilePicker
            buttonLabel="Chọn ảnh mới"
            file={imageFile}
            onChange={handleImageFileChange}
          />
          <ImagePreview file={imageFile} url={form.image} alt="Ảnh danh mục" />
          {fieldErrors.image ? <small id="category-image-error" className="admin-field-error">{fieldErrors.image}</small> : null}
        </label>
        <label>
          <span>Mô tả</span>
          <textarea
            minLength={5}
            maxLength={1000}
            rows={4}
            value={form.description}
            aria-invalid={Boolean(fieldErrors.description)}
            aria-describedby={fieldErrors.description ? 'category-description-error' : undefined}
            onChange={(event) => {
              setForm({ ...form, description: event.target.value })
              setFieldErrors((current) => ({ ...current, description: '' }))
            }}
          />
          {fieldErrors.description ? <small id="category-description-error" className="admin-field-error">{fieldErrors.description}</small> : null}
        </label>
        <label className="admin-catalog-checkbox">
          <input
            type="checkbox"
            checked={form.isActive}
            disabled={Boolean(item?.isActive && item.activeProductCount > 0)}
            onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
          />
          <span>{item ? 'Hiển thị danh mục trên cửa hàng' : 'Hiển thị danh mục sau khi tạo'}</span>
        </label>
        {item?.isActive && item.activeProductCount > 0 ? (
          <p className="admin-form-note">
            Danh mục này còn {item.activeProductCount.toLocaleString('vi-VN')} sản phẩm đang bán.
            Không thể tạm ngừng ngay qua form sửa; hãy dùng hành động tạm ngừng trong danh sách để xác nhận.
          </p>
        ) : null}
        <EditorActions isSaving={isSaving} onClose={onClose} />
      </form>
    </EditorModal>
  )
}

export function SizeTemplateManager({
  categories,
  isSaving,
  errorMessage,
  onClose,
  onSave,
}: {
  categories: ManagedCategory[]
  isSaving: boolean
  errorMessage: string
  onClose: () => void
  onSave: (categoryId: string, input: SizeTemplateInput, sizeGuideImageFile?: File | null) => Promise<void>
}) {
  const sizeTemplateSources = useMemo(
    () => categories.filter((category) => category.isSizeTemplateSource),
    [categories],
  )
  const activeCategories = useMemo(
    () => categories.filter((category) => category.isActive),
    [categories],
  )
  const [selectedTemplateId, setSelectedTemplateId] = useState(sizeTemplateSources[0]?._id ?? '')
  const [templateName, setTemplateName] = useState(
    getSizeTemplateLabel(sizeTemplateSources[0]) || '',
  )
  const [sizeGuideImageUrl, setSizeGuideImageUrl] = useState(sizeTemplateSources[0]?.sizeGuideImage ?? '')
  const [sizeGuideImageFile, setSizeGuideImageFile] = useState<File | null>(null)
  const [shouldClearSizeGuideImage, setShouldClearSizeGuideImage] = useState(false)
  const [sizeFields, setSizeFields] = useState<string[]>([''])
  const [integrationCategoryIds, setIntegrationCategoryIds] = useState<string[]>([
    activeCategories[0]?._id ?? '',
  ])
  const [excludedCategoryIds, setExcludedCategoryIds] = useState<string[]>([])
  const [localError, setLocalError] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category._id, category])),
    [categories],
  )
  const applicationCategoryOptions = useMemo(
    () =>
      activeCategories.filter(
        (category) =>
          !category.isSizeTemplateSource ||
          category._id === selectedTemplateId ||
          category.sizeTemplateSourceId === selectedTemplateId,
      ),
    [activeCategories, selectedTemplateId],
  )

  useEffect(() => {
    if (!selectedTemplateId) {
      setSizeFields([''])
      setSizeGuideImageUrl('')
      setSizeGuideImageFile(null)
      setShouldClearSizeGuideImage(false)
      setIntegrationCategoryIds([''])
      setExcludedCategoryIds([])
      return
    }

    const selectedTemplate = categories.find((category) => category._id === selectedTemplateId)
    const integratedIds = categories
      .filter(
        (category) =>
          category._id === selectedTemplateId ||
          category.sizeTemplateSourceId === selectedTemplateId,
      )
      .map((category) => category._id)

    setTemplateName(getSizeTemplateLabel(selectedTemplate))
    setSizeGuideImageUrl(selectedTemplate?.sizeGuideImage ?? '')
    setSizeGuideImageFile(null)
    setShouldClearSizeGuideImage(false)
    setSizeFields((selectedTemplate?.sizes?.length ? selectedTemplate.sizes : ['']))
    const rootCategoryIds = integratedIds.length
      ? getRootCategoryIds(categories, integratedIds)
      : [selectedTemplateId]

    setIntegrationCategoryIds(rootCategoryIds)
    setExcludedCategoryIds(getPersistedExcludedCategoryIds(categories, rootCategoryIds, integratedIds))
    setIsDirty(false)
  }, [categories, selectedTemplateId])

  const appliedCategoryIds = useMemo(() => {
    const selectedIds = integrationCategoryIds.filter(Boolean)
    if (selectedIds.length === 0) return []

    return [
      ...new Set(
      selectedIds.flatMap((categoryId) => [...getCategoryDescendantIds(categories, categoryId)]),
      ),
    ].filter((categoryId) => !excludedCategoryIds.includes(categoryId))
  }, [categories, excludedCategoryIds, integrationCategoryIds])

  const appliedDetailCategories = useMemo(
    () =>
      appliedCategoryIds
        .filter((categoryId) => !integrationCategoryIds.includes(categoryId))
        .map((categoryId) => categoryById.get(categoryId))
        .filter((category): category is ManagedCategory => Boolean(category)),
    [appliedCategoryIds, categoryById, integrationCategoryIds],
  )

  const parseSizes = () => {
    const sizes = sizeFields
      .map((size) => size.trim())
      .filter(Boolean)
    const lowercasedSizes = sizes.map((size) => size.toLocaleLowerCase('vi'))

    if (sizes.length === 0) {
      throw new Error('Vui lòng nhập ít nhất một size.')
    }

    if (new Set(lowercasedSizes).size !== lowercasedSizes.length) {
      throw new Error('Danh sách size đang bị trùng.')
    }

    return sizes
  }

  const parseCategoryIds = () => {
    const categoryIds = integrationCategoryIds.map((categoryId) => categoryId.trim()).filter(Boolean)

    if (categoryIds.length === 0) {
      throw new Error('Vui lòng chọn ít nhất một danh mục tích hợp.')
    }

    if (new Set(categoryIds).size !== categoryIds.length) {
      throw new Error('Danh mục tích hợp đang bị trùng.')
    }

    return categoryIds
  }

  const parseTemplateName = () => {
    const name = templateName.trim()

    if (!name) {
      throw new Error('Vui lòng nhập tên bộ size.')
    }

    return name
  }

  const handlePickTemplate = (categoryId: string) => {
    setLocalError('')
    setShowDiscardConfirm(false)
    setSelectedTemplateId(categoryId)
    setIsDirty(false)
  }

  const handleCreateTemplate = () => {
    setLocalError('')
    setShowDiscardConfirm(false)
    setSelectedTemplateId('')
    setTemplateName('')
    setSizeGuideImageUrl('')
    setSizeGuideImageFile(null)
    setShouldClearSizeGuideImage(false)
    setSizeFields([''])
    setIntegrationCategoryIds([''])
    setExcludedCategoryIds([])
    setIsDirty(true)
  }

  const addSizeField = () => {
    setIsDirty(true)
    setSizeFields((current) => [...current, ''])
  }

  const updateSizeField = (index: number, value: string) => {
    setIsDirty(true)
    setSizeFields((current) => current.map((size, currentIndex) => (currentIndex === index ? value : size)))
  }

  const removeSizeField = (index: number) => {
    setIsDirty(true)
    setSizeFields((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  const addIntegrationCategory = () => {
    const selectedIds = new Set(integrationCategoryIds)
    const nextCategory = applicationCategoryOptions.find((category) => !selectedIds.has(category._id))
    setIsDirty(true)
    setIntegrationCategoryIds((current) => [...current, nextCategory?._id ?? ''])
  }

  const updateIntegrationCategory = (index: number, categoryId: string) => {
    setIsDirty(true)
    const restoredCategoryIds = getCategoryDescendantIds(categories, categoryId)
    setIntegrationCategoryIds((current) =>
      current.map((currentCategoryId, currentIndex) =>
        currentIndex === index ? categoryId : currentCategoryId,
      ),
    )
    setExcludedCategoryIds((current) =>
      current.filter((currentCategoryId) => !restoredCategoryIds.has(currentCategoryId)),
    )
  }

  const removeIntegrationCategory = (index: number) => {
    setIsDirty(true)
    setIntegrationCategoryIds((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  const handleSizeGuideImageFileChange = (file: File | null, input: HTMLInputElement) => {
    const validationError = getImageFileValidationError(file)
    if (validationError) {
      setSizeGuideImageFile(null)
      setLocalError(validationError)
      input.value = ''
      return
    }

    setLocalError('')
    setShouldClearSizeGuideImage(false)
    setSizeGuideImageFile(file)
    if (file) {
      setIsDirty(true)
    }
  }

  const clearSizeGuideImage = () => {
    setSizeGuideImageFile(null)
    setSizeGuideImageUrl('')
    setShouldClearSizeGuideImage(true)
    setIsDirty(true)
  }

  const excludeAppliedCategory = (categoryId: string) => {
    setIsDirty(true)
    setExcludedCategoryIds((current) => [...new Set([...current, categoryId])])
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!isDirty) return

    try {
      setShowDiscardConfirm(false)
      const name = parseTemplateName()
      const sizes = parseSizes()
      const categoryIds = parseCategoryIds()
      const sourceCategoryId = selectedTemplateId || categoryIds[0]
      setLocalError('')
      void onSave(sourceCategoryId, {
        name,
        sizes,
        measurementFields: [],
        categoryIds,
        excludedCategoryIds,
        clearSizeGuideImage: shouldClearSizeGuideImage,
      }, sizeGuideImageFile).then(() => {
        setSelectedTemplateId(sourceCategoryId)
        setSizeGuideImageFile(null)
        setShouldClearSizeGuideImage(false)
        setIsDirty(false)
      }).catch((error) => {
        setLocalError(error instanceof Error ? error.message : 'Không thể lưu bộ size.')
      })
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Thông tin bộ size không hợp lệ.')
    }
  }

  const handleClose = () => {
    if (!isDirty) {
      onClose()
      return
    }
    setShowDiscardConfirm(true)
  }

  return (
    <EditorModal title="Quản lý size" isSaving={isSaving} onClose={handleClose}>
      <form className="admin-size-template-layout" onSubmit={handleSubmit}>
        {errorMessage || localError ? (
          <p className="admin-notice is-error">{errorMessage || localError}</p>
        ) : null}
        <section className="admin-size-template-column" aria-label="Bộ size">
          <div className="admin-size-template-heading">
            <div>
              <h3>Bộ size</h3>
              <span>{sizeTemplateSources.length.toLocaleString('vi-VN')} bộ</span>
            </div>
          </div>
          {sizeTemplateSources.length > 0 ? (
            <div className="admin-size-template-picker">
              {sizeTemplateSources.map((category) => (
                <button
                  className={category._id === selectedTemplateId ? 'is-active' : ''}
                  type="button"
                  key={category._id}
                  disabled={isSaving}
                  onClick={() => handlePickTemplate(category._id)}
                >
                  <strong>{getSizeTemplateLabel(category)}</strong>
                  <span>{(category.sizes ?? []).join(', ') || 'Chưa có size'}</span>
                </button>
              ))}
            </div>
          ) : null}
          <button className="admin-secondary-button" type="button" disabled={isSaving} onClick={handleCreateTemplate}>
            + Thêm bộ size
          </button>
        </section>
        <section className="admin-size-template-column is-detail" aria-label="Chi tiết bộ size">
          <div className="admin-size-template-heading">
            <div>
              <h3>Danh mục áp dụng</h3>
              <span>Chi tiết bộ size</span>
            </div>
          </div>
          <label className="admin-size-inline-field">
            <span>Tên bộ size</span>
            <div className="is-single">
              <input
                required
                maxLength={80}
                value={templateName}
                placeholder="Ví dụ: Giày / Dép"
                onChange={(event) => {
                  setIsDirty(true)
                  setTemplateName(event.target.value)
                }}
              />
            </div>
          </label>
          <div className="admin-size-category-list">
            <span>Danh mục áp dụng</span>
            {integrationCategoryIds.map((categoryId, index) => (
              <label className="admin-size-inline-field" key={`integrated-category-${index}`}>
                <div>
                  <CategoryApplySelect
                    categories={applicationCategoryOptions}
                    categoryById={categoryById}
                    disabled={isSaving}
                    value={categoryId}
                    onChange={(nextCategoryId) => updateIntegrationCategory(index, nextCategoryId)}
                  />
                  <button
                    className="admin-icon-button"
                    type="button"
                    disabled={isSaving || integrationCategoryIds.length === 1}
                    onClick={() => removeIntegrationCategory(index)}
                    aria-label={`Xóa danh mục tích hợp ${index + 1}`}
                  >
                    ×
                  </button>
                </div>
              </label>
            ))}
          </div>
          <section className="admin-applied-category-tags" aria-label="Danh mục chi tiết được áp dụng">
            <header>Danh mục chi tiết được áp dụng</header>
            <div>
              {appliedDetailCategories.length > 0 ? (
                appliedDetailCategories.map((category) => (
                  <span className={`admin-applied-category-tag level-${Math.min(category.level, 4)}`} key={category._id}>
                    {category.name}
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => excludeAppliedCategory(category._id)}
                      aria-label={`Xóa ${category.name} khỏi danh mục chi tiết được áp dụng`}
                    >
                      ×
                    </button>
                  </span>
                ))
              ) : (
                <em>Chưa có danh mục con phù hợp.</em>
              )}
            </div>
          </section>
          <button className="admin-secondary-button" type="button" disabled={isSaving} onClick={addIntegrationCategory}>
            + Thêm danh mục
          </button>
          <div className="admin-size-template-subheading">
            <h4>
              <TagsOutlined className="admin-size-heading-icon" />
              <span>Size</span>
            </h4>
          </div>
          <div className="admin-size-field-list">
            {sizeFields.map((size, index) => (
              <label className="admin-size-inline-field" key={`size-field-${index}`}>
                <div>
                  <input
                    required={index === 0}
                    value={size}
                    placeholder={index === 0 ? 'Ví dụ: S' : 'Nhập size'}
                    onChange={(event) => updateSizeField(index, event.target.value)}
                  />
                  <button
                    className="admin-icon-button"
                    type="button"
                    disabled={isSaving || sizeFields.length === 1}
                    onClick={() => removeSizeField(index)}
                    aria-label={`Xóa size ${index + 1}`}
                  >
                    ×
                  </button>
                </div>
              </label>
            ))}
            <button className="admin-secondary-button" type="button" disabled={isSaving} onClick={addSizeField}>
              + Thêm size
            </button>
          </div>
          <label className="admin-size-inline-field">
            <span>Ảnh hướng dẫn chọn size</span>
            <ImageFilePicker
              buttonLabel="Chọn ảnh"
              file={sizeGuideImageFile}
              onChange={handleSizeGuideImageFileChange}
            />
          </label>
          <ImagePreview
            className="admin-size-guide-preview"
            file={sizeGuideImageFile}
            url={sizeGuideImageUrl}
            alt="Ảnh hướng dẫn chọn size"
          />
          {(sizeGuideImageFile || sizeGuideImageUrl) ? (
            <button className="admin-danger-link" type="button" disabled={isSaving} onClick={clearSizeGuideImage}>
              Xóa ảnh hướng dẫn
            </button>
          ) : null}
        </section>
        {showDiscardConfirm ? (
          <DiscardChangesPrompt
            isSaving={isSaving}
            onCancel={() => setShowDiscardConfirm(false)}
            onDiscard={onClose}
          />
        ) : null}
        <EditorActions isSaving={isSaving} onClose={handleClose} showSaveButton={isDirty} />
      </form>
    </EditorModal>
  )
}

type FitTypeField = {
  _id?: string
  label: string
  isActive: boolean
}

const createFitTypeField = (fitType?: CategoryFitTypeInput): FitTypeField => ({
  _id: fitType?._id,
  label: fitType?.label ?? '',
  isActive: fitType?.isActive ?? true,
})

export function FitTypeTemplateManager({
  categories,
  isSaving,
  errorMessage,
  onClose,
  onSave,
}: {
  categories: ManagedCategory[]
  isSaving: boolean
  errorMessage: string
  onClose: () => void
  onSave: (categoryId: string, input: FitTypeTemplateInput) => Promise<void>
}) {
  const fitTypeTemplateSources = useMemo(
    () => categories.filter((category) => category.isFitTypeTemplateSource || Boolean(category.fitTypes?.length)),
    [categories],
  )
  const activeCategories = useMemo(
    () => categories.filter((category) => category.isActive),
    [categories],
  )
  const [selectedTemplateId, setSelectedTemplateId] = useState(fitTypeTemplateSources[0]?._id ?? '')
  const [templateName, setTemplateName] = useState(
    getFitTypeTemplateLabel(fitTypeTemplateSources[0]) || '',
  )
  const [fitTypeFields, setFitTypeFields] = useState<FitTypeField[]>([createFitTypeField()])
  const [integrationCategoryIds, setIntegrationCategoryIds] = useState<string[]>([
    activeCategories[0]?._id ?? '',
  ])
  const [excludedCategoryIds, setExcludedCategoryIds] = useState<string[]>([])
  const [localError, setLocalError] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category._id, category])),
    [categories],
  )
  const applicationCategoryOptions = useMemo(
    () =>
      activeCategories.filter(
        (category) =>
          category._id === selectedTemplateId ||
          category.fitTypeTemplateSourceId === selectedTemplateId ||
          (!category.isFitTypeTemplateSource && !category.fitTypes?.length),
      ),
    [activeCategories, selectedTemplateId],
  )

  useEffect(() => {
    if (!selectedTemplateId) {
      setFitTypeFields([createFitTypeField()])
      setIntegrationCategoryIds([''])
      setExcludedCategoryIds([])
      return
    }

    const selectedTemplate = categories.find((category) => category._id === selectedTemplateId)
    const integratedIds = categories
      .filter(
        (category) =>
          category._id === selectedTemplateId ||
          category.fitTypeTemplateSourceId === selectedTemplateId,
      )
      .map((category) => category._id)

    setTemplateName(getFitTypeTemplateLabel(selectedTemplate))
    setFitTypeFields(
      selectedTemplate?.fitTypes?.length
        ? [...selectedTemplate.fitTypes]
            .sort((first, second) => first.sortOrder - second.sortOrder)
            .map(createFitTypeField)
        : [createFitTypeField()],
    )
    const rootCategoryIds = integratedIds.length
      ? getRootCategoryIds(categories, integratedIds)
      : [selectedTemplateId]

    setIntegrationCategoryIds(rootCategoryIds)
    setExcludedCategoryIds(getPersistedExcludedCategoryIds(categories, rootCategoryIds, integratedIds))
    setIsDirty(false)
  }, [categories, selectedTemplateId])

  const appliedCategoryIds = useMemo(() => {
    const selectedIds = integrationCategoryIds.filter(Boolean)
    if (selectedIds.length === 0) return []

    return [
      ...new Set(
        selectedIds.flatMap((categoryId) => [...getCategoryDescendantIds(categories, categoryId)]),
      ),
    ].filter((categoryId) => !excludedCategoryIds.includes(categoryId))
  }, [categories, excludedCategoryIds, integrationCategoryIds])

  const appliedDetailCategories = useMemo(
    () =>
      appliedCategoryIds
        .filter((categoryId) => !integrationCategoryIds.includes(categoryId))
        .map((categoryId) => categoryById.get(categoryId))
        .filter((category): category is ManagedCategory => Boolean(category)),
    [appliedCategoryIds, categoryById, integrationCategoryIds],
  )

  const parseTemplateName = () => {
    const name = templateName.trim()
    if (!name) {
      throw new Error('Vui lòng nhập tên bộ phom dáng.')
    }
    return name
  }

  const parseCategoryIds = () => {
    const categoryIds = integrationCategoryIds.map((categoryId) => categoryId.trim()).filter(Boolean)

    if (categoryIds.length === 0) {
      throw new Error('Vui lòng chọn ít nhất một danh mục tích hợp.')
    }

    if (new Set(categoryIds).size !== categoryIds.length) {
      throw new Error('Danh mục tích hợp đang bị trùng.')
    }

    return categoryIds
  }

  const parseFitTypes = () => {
    const fitTypes = fitTypeFields
      .map((field, index) => {
        const label = field.label.trim()
        const key = normalizeFitTypeKey(label)

        return {
          _id: field._id,
          key,
          label,
          sortOrder: index,
          isActive: field.isActive,
        }
      })
      .filter((field) => field.label)

    if (fitTypes.length === 0) {
      throw new Error('Vui lòng nhập ít nhất một phom dáng.')
    }

    if (fitTypes.some((field) => !field.key || !field.label)) {
      throw new Error('Tên phom dáng không hợp lệ.')
    }

    const keys = fitTypes.map((field) => field.key)
    if (new Set(keys).size !== keys.length) {
      throw new Error('Danh sách phom dáng đang bị trùng.')
    }

    return fitTypes
  }

  const handlePickTemplate = (categoryId: string) => {
    setLocalError('')
    setShowDiscardConfirm(false)
    setSelectedTemplateId(categoryId)
    setIsDirty(false)
  }

  const handleCreateTemplate = () => {
    setLocalError('')
    setShowDiscardConfirm(false)
    setSelectedTemplateId('')
    setTemplateName('')
    setFitTypeFields([createFitTypeField()])
    setIntegrationCategoryIds([''])
    setExcludedCategoryIds([])
    setIsDirty(true)
  }

  const updateFitTypeField = (index: number, value: Partial<FitTypeField>) => {
    setIsDirty(true)
    setFitTypeFields((current) =>
      current.map((field, currentIndex) =>
        currentIndex === index ? { ...field, ...value } : field,
      ),
    )
  }

  const addFitTypeField = () => {
    setIsDirty(true)
    setFitTypeFields((current) => [...current, createFitTypeField()])
  }

  const removeFitTypeField = (index: number) => {
    setIsDirty(true)
    setFitTypeFields((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  const addIntegrationCategory = () => {
    const selectedIds = new Set(integrationCategoryIds)
    const nextCategory = applicationCategoryOptions.find((category) => !selectedIds.has(category._id))
    setIsDirty(true)
    setIntegrationCategoryIds((current) => [...current, nextCategory?._id ?? ''])
  }

  const updateIntegrationCategory = (index: number, categoryId: string) => {
    setIsDirty(true)
    const restoredCategoryIds = getCategoryDescendantIds(categories, categoryId)
    setIntegrationCategoryIds((current) =>
      current.map((currentCategoryId, currentIndex) =>
        currentIndex === index ? categoryId : currentCategoryId,
      ),
    )
    setExcludedCategoryIds((current) =>
      current.filter((currentCategoryId) => !restoredCategoryIds.has(currentCategoryId)),
    )
  }

  const removeIntegrationCategory = (index: number) => {
    setIsDirty(true)
    setIntegrationCategoryIds((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  const excludeAppliedCategory = (categoryId: string) => {
    setIsDirty(true)
    setExcludedCategoryIds((current) => [...new Set([...current, categoryId])])
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!isDirty) return

    try {
      setShowDiscardConfirm(false)
      const name = parseTemplateName()
      const fitTypes = parseFitTypes()
      const categoryIds = parseCategoryIds()
      const sourceCategoryId = selectedTemplateId || categoryIds[0]
      setLocalError('')
      void onSave(sourceCategoryId, {
        name,
        fitTypes,
        categoryIds,
        excludedCategoryIds,
      }).then(() => {
        setSelectedTemplateId(sourceCategoryId)
        setIsDirty(false)
      }).catch((error) => {
        setLocalError(error instanceof Error ? error.message : 'Không thể lưu bộ phom dáng.')
      })
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Thông tin bộ phom dáng không hợp lệ.')
    }
  }

  const handleClose = () => {
    if (!isDirty) {
      onClose()
      return
    }
    setShowDiscardConfirm(true)
  }

  return (
    <EditorModal title="Quản lý phom dáng" isSaving={isSaving} onClose={handleClose}>
      <form className="admin-size-template-layout" onSubmit={handleSubmit}>
        {errorMessage || localError ? (
          <p className="admin-notice is-error">{errorMessage || localError}</p>
        ) : null}
        <section className="admin-size-template-column" aria-label="Bộ phom dáng">
          <div className="admin-size-template-heading">
            <div>
              <h3>Bộ phom dáng</h3>
              <span>{fitTypeTemplateSources.length.toLocaleString('vi-VN')} bộ</span>
            </div>
          </div>
          {fitTypeTemplateSources.length > 0 ? (
            <div className="admin-size-template-picker">
              {fitTypeTemplateSources.map((category) => (
                <button
                  className={category._id === selectedTemplateId ? 'is-active' : ''}
                  type="button"
                  key={category._id}
                  disabled={isSaving}
                  onClick={() => handlePickTemplate(category._id)}
                >
                  <strong>{getFitTypeTemplateLabel(category)}</strong>
                  <span>{(category.fitTypes ?? []).map((item) => item.label).join(', ') || 'Chưa có phom dáng'}</span>
                </button>
              ))}
            </div>
          ) : null}
          <button className="admin-secondary-button" type="button" disabled={isSaving} onClick={handleCreateTemplate}>
            + Thêm bộ phom dáng
          </button>
        </section>
        <section className="admin-size-template-column is-detail" aria-label="Chi tiết bộ phom dáng">
          <div className="admin-size-template-heading">
            <div>
              <h3>Danh mục áp dụng</h3>
              <span>Chi tiết bộ phom dáng</span>
            </div>
          </div>
          <label className="admin-size-inline-field">
            <span>Tên bộ phom dáng</span>
            <div className="is-single">
              <input
                required
                maxLength={80}
                value={templateName}
                placeholder="Ví dụ: Áo nam"
                onChange={(event) => {
                  setIsDirty(true)
                  setTemplateName(event.target.value)
                }}
              />
            </div>
          </label>
          <div className="admin-size-category-list">
            <span>Danh mục áp dụng</span>
            {integrationCategoryIds.map((categoryId, index) => (
              <label className="admin-size-inline-field" key={`fit-category-${index}`}>
                <div>
                  <CategoryApplySelect
                    categories={applicationCategoryOptions}
                    categoryById={categoryById}
                    disabled={isSaving}
                    value={categoryId}
                    onChange={(nextCategoryId) => updateIntegrationCategory(index, nextCategoryId)}
                  />
                  <button
                    className="admin-icon-button"
                    type="button"
                    disabled={isSaving || integrationCategoryIds.length === 1}
                    onClick={() => removeIntegrationCategory(index)}
                    aria-label={`Xóa danh mục tích hợp ${index + 1}`}
                  >
                    ×
                  </button>
                </div>
              </label>
            ))}
          </div>
          <section className="admin-applied-category-tags" aria-label="Danh mục chi tiết được áp dụng">
            <header>Danh mục chi tiết được áp dụng</header>
            <div>
              {appliedDetailCategories.length > 0 ? (
                appliedDetailCategories.map((category) => (
                  <span className={`admin-applied-category-tag level-${Math.min(category.level, 4)}`} key={category._id}>
                    {category.name}
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => excludeAppliedCategory(category._id)}
                      aria-label={`Xóa ${category.name} khỏi danh mục chi tiết được áp dụng`}
                    >
                      ×
                    </button>
                  </span>
                ))
              ) : (
                <em>Chưa có danh mục con phù hợp.</em>
              )}
            </div>
          </section>
          <button className="admin-secondary-button" type="button" disabled={isSaving} onClick={addIntegrationCategory}>
            + Thêm danh mục
          </button>
          <div className="admin-size-template-subheading">
            <h4>
              <TagsOutlined className="admin-size-heading-icon" />
              <span>Phom dáng</span>
            </h4>
          </div>
          <div className="admin-size-field-list">
            {fitTypeFields.map((fitType, index) => (
              <label className="admin-size-inline-field" key={`fit-type-field-${index}`}>
                <div className="admin-fit-type-row">
                  <input
                    required={index === 0}
                    value={fitType.label}
                    placeholder={index === 0 ? 'Ví dụ: Regular fit' : 'Nhập phom dáng'}
                    onChange={(event) => updateFitTypeField(index, { label: event.target.value })}
                  />
                  <span className="admin-fit-type-status">
                    <input
                      type="checkbox"
                      checked={fitType.isActive}
                      onChange={(event) => updateFitTypeField(index, { isActive: event.target.checked })}
                    />
                    <span>Đang dùng</span>
                  </span>
                  <button
                    className="admin-icon-button"
                    type="button"
                    disabled={isSaving || fitTypeFields.length === 1}
                    onClick={() => removeFitTypeField(index)}
                    aria-label={`Xóa phom dáng ${index + 1}`}
                  >
                    ×
                  </button>
                </div>
              </label>
            ))}
            <button className="admin-secondary-button" type="button" disabled={isSaving} onClick={addFitTypeField}>
              + Thêm phom dáng
            </button>
          </div>
        </section>
        {showDiscardConfirm ? (
          <DiscardChangesPrompt
            isSaving={isSaving}
            onCancel={() => setShowDiscardConfirm(false)}
            onDiscard={onClose}
          />
        ) : null}
        <EditorActions isSaving={isSaving} onClose={handleClose} showSaveButton={isDirty} />
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
      setLocalError('Vui lòng chọn logo thương hiệu.')
      return
    }
    setLocalError('')
    const normalizedImage = form.image.trim()
    const shouldSendImage = Boolean(imageFile) || !item || normalizedImage !== item.image.trim()
    void onSave(
      { ...form, name: form.name.trim(), image: shouldSendImage ? normalizedImage : '' },
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
          <ImageFilePicker
            buttonLabel="Chọn logo mới"
            file={imageFile}
            onChange={handleImageFileChange}
          />
          <ImagePreview file={imageFile} url={form.image} alt="Logo thương hiệu" />
        </label>
        <label className="admin-catalog-checkbox">
          <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
          <span>{item ? 'Hiển thị thương hiệu trên cửa hàng' : 'Hiển thị thương hiệu sau khi tạo'}</span>
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

function EditorActions({
  isSaving,
  onClose,
  showSaveButton = true,
}: {
  isSaving: boolean
  onClose: () => void
  showSaveButton?: boolean
}) {
  return (
    <div className="admin-catalog-form-actions">
      <button className="admin-secondary-button" type="button" disabled={isSaving} onClick={onClose}>Hủy</button>
      {showSaveButton ? (
        <button className="admin-primary-button" type="submit" disabled={isSaving}>
          {isSaving ? 'Đang lưu...' : 'Lưu'}
        </button>
      ) : null}
    </div>
  )
}

function DiscardChangesPrompt({
  isSaving,
  onCancel,
  onDiscard,
}: {
  isSaving: boolean
  onCancel: () => void
  onDiscard: () => void
}) {
  return (
    <div className="admin-discard-changes-prompt">
      <span>Bạn có thay đổi chưa lưu.</span>
      <div>
        <button className="admin-secondary-button" type="button" disabled={isSaving} onClick={onCancel}>
          Tiếp tục chỉnh
        </button>
        <button className="admin-danger-button" type="button" disabled={isSaving} onClick={onDiscard}>
          Bỏ thay đổi
        </button>
      </div>
    </div>
  )
}

function ImagePreview({
  file,
  url,
  alt,
  className = 'admin-catalog-image-preview',
}: {
  file?: File | null
  url?: string | null
  alt: string
  className?: string
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

  return (
    <span className={className}>
      {previewUrl ? <img src={previewUrl} alt={alt} /> : <span className="admin-image-placeholder">Chưa có ảnh</span>}
    </span>
  )
}

function ImageFilePicker({
  buttonLabel,
  file,
  onChange,
}: {
  buttonLabel: string
  file: File | null
  onChange: (file: File | null, input: HTMLInputElement) => void
}) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)

  return (
    <div className="admin-image-file-picker">
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => onChange(event.target.files?.[0] ?? null, event.currentTarget)}
      />
      <label className="admin-image-file-button" htmlFor={inputId}>{buttonLabel}</label>
      {file ? (
        <div className="admin-image-file-current">
          <span>Đã chọn ảnh mới: {file.name}</span>
        </div>
      ) : null}
      {file ? (
        <button
          className="admin-image-file-remove"
          type="button"
          aria-label="Bỏ ảnh đã chọn"
          onClick={() => {
            if (!inputRef.current) return
            inputRef.current.value = ''
            onChange(null, inputRef.current)
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  )
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
