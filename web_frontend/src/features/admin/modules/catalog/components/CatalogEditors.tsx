import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { ColumnHeightOutlined, TagsOutlined } from '@ant-design/icons'
import type {
  BrandInput,
  CatalogGender,
  CategoryInput,
  ManagedBrand,
  ManagedCategory,
  MeasurementFieldInput,
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

const getCategoryChildMap = (categories: ManagedCategory[]) => {
  const childrenByParentId = new Map<string, ManagedCategory[]>()

  categories.forEach((category) => {
    if (!category.parent_id) return

    const children = childrenByParentId.get(category.parent_id) ?? []
    children.push(category)
    childrenByParentId.set(category.parent_id, children)
  })

  return childrenByParentId
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

const getSizeTemplateLabel = (category?: ManagedCategory | null) =>
  category?.sizeTemplateName?.trim() || category?.name || ''

const createEmptyMeasurementField = (sortOrder = 0): MeasurementFieldInput => ({
  key: '',
  label: '',
  unit: 'cm',
  required: true,
  sortOrder,
})

const normalizeMeasurementKey = (value: string) =>
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
          {selectedCategory ? `- ${getCategoryPathLabel(selectedCategory, categoryById)}` : 'Chọn danh mục'}
        </span>
        <span aria-hidden="true">⌄</span>
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
              {'-'.repeat(Math.max(0, category.level - 1))} {category.name}
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
  secondaryActionLabel,
  canWrite,
  onAdd,
  onSecondaryAction,
  children,
}: {
  title: string
  actionLabel: string
  secondaryActionLabel?: string
  canWrite: boolean
  onAdd: () => void
  onSecondaryAction?: () => void
  children: ReactNode
}) {
  return (
    <section className="admin-catalog-section">
      <header>
        <h2>{title}</h2>
        <div className="admin-catalog-section-actions">
          {secondaryActionLabel && onSecondaryAction ? (
            <button className="admin-secondary-button" type="button" disabled={!canWrite} onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </button>
          ) : null}
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
  onSave: (categoryId: string, input: SizeTemplateInput) => Promise<void>
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
  const [sizeFields, setSizeFields] = useState<string[]>([''])
  const [measurementFields, setMeasurementFields] = useState<MeasurementFieldInput[]>([
    createEmptyMeasurementField(),
  ])
  const [integrationCategoryIds, setIntegrationCategoryIds] = useState<string[]>([
    activeCategories[0]?._id ?? '',
  ])
  const [excludedCategoryIds, setExcludedCategoryIds] = useState<string[]>([])
  const [localError, setLocalError] = useState('')
  const childrenByParentId = useMemo(() => getCategoryChildMap(categories), [categories])
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category._id, category])),
    [categories],
  )
  const parentCategoryOptions = useMemo(
    () =>
      activeCategories.filter(
        (category) => !category.parent_id || (childrenByParentId.get(category._id)?.length ?? 0) > 0,
      ),
    [activeCategories, childrenByParentId],
  )

  useEffect(() => {
    if (!selectedTemplateId) {
      setSizeFields([''])
      setMeasurementFields([createEmptyMeasurementField()])
      setIntegrationCategoryIds([parentCategoryOptions[0]?._id ?? ''])
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
    setSizeFields((selectedTemplate?.sizes?.length ? selectedTemplate.sizes : ['']))
    setMeasurementFields(
      selectedTemplate?.measurementFields?.length
        ? [...selectedTemplate.measurementFields].sort((first, second) => first.sortOrder - second.sortOrder)
        : [createEmptyMeasurementField()],
    )
    setIntegrationCategoryIds(
      integratedIds.length
        ? getRootCategoryIds(categories, integratedIds)
        : [selectedTemplateId],
    )
    setExcludedCategoryIds([])
  }, [categories, parentCategoryOptions, selectedTemplateId])

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

  const parseMeasurementFields = () => {
    const fields = measurementFields
      .map((field, index) => {
        const label = field.label.trim()
        const unit = field.unit.trim()
        const key = normalizeMeasurementKey(label)

        return {
          key,
          label,
          unit,
          required: field.required,
          sortOrder: index,
        }
      })
      .filter((field) => field.label || field.key)

    if (fields.length === 0) {
      throw new Error('Vui lòng nhập ít nhất một số đo.')
    }

    if (fields.some((field) => !field.label || !field.key || !field.unit)) {
      throw new Error('Vui lòng nhập đầy đủ tên và đơn vị số đo.')
    }

    const lowercasedKeys = fields.map((field) => field.key.toLocaleLowerCase('vi'))
    if (new Set(lowercasedKeys).size !== lowercasedKeys.length) {
      throw new Error('Danh sách số đo đang bị trùng tên.')
    }

    return fields
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
    setSelectedTemplateId(categoryId)
  }

  const handleCreateTemplate = () => {
    const name = window.prompt('Tên bộ size mới')
    if (name === null) return

    const normalizedName = name.trim()
    if (!normalizedName) {
      setLocalError('Vui lòng nhập tên bộ size.')
      return
    }

    setLocalError('')
    setSelectedTemplateId('')
    setTemplateName(normalizedName)
    setSizeFields([''])
    setMeasurementFields([createEmptyMeasurementField()])
    setIntegrationCategoryIds([parentCategoryOptions[0]?._id ?? ''])
    setExcludedCategoryIds([])
  }

  const addSizeField = () => {
    setSizeFields((current) => [...current, ''])
  }

  const updateSizeField = (index: number, value: string) => {
    setSizeFields((current) => current.map((size, currentIndex) => (currentIndex === index ? value : size)))
  }

  const removeSizeField = (index: number) => {
    setSizeFields((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  const addMeasurementField = () => {
    setMeasurementFields((current) => [...current, createEmptyMeasurementField(current.length)])
  }

  const updateMeasurementField = (
    index: number,
    field: keyof MeasurementFieldInput,
    value: string | boolean,
  ) => {
    setMeasurementFields((current) =>
      current.map((measurement, currentIndex) =>
        currentIndex === index
          ? {
              ...measurement,
              [field]: value,
            }
          : measurement,
      ),
    )
  }

  const removeMeasurementField = (index: number) => {
    setMeasurementFields((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  const addIntegrationCategory = () => {
    const selectedIds = new Set(integrationCategoryIds)
    const nextCategory = parentCategoryOptions.find((category) => !selectedIds.has(category._id))
    setIntegrationCategoryIds((current) => [...current, nextCategory?._id ?? ''])
  }

  const updateIntegrationCategory = (index: number, categoryId: string) => {
    setIntegrationCategoryIds((current) =>
      current.map((currentCategoryId, currentIndex) =>
        currentIndex === index ? categoryId : currentCategoryId,
      ),
    )
  }

  const removeIntegrationCategory = (index: number) => {
    setIntegrationCategoryIds((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  const excludeAppliedCategory = (categoryId: string) => {
    setExcludedCategoryIds((current) => [...new Set([...current, categoryId])])
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    try {
      const name = parseTemplateName()
      const sizes = parseSizes()
      const parsedMeasurementFields = parseMeasurementFields()
      const categoryIds = parseCategoryIds()
      const sourceCategoryId = selectedTemplateId || categoryIds[0]
      setLocalError('')
      void onSave(sourceCategoryId, {
        name,
        sizes,
        measurementFields: parsedMeasurementFields,
        categoryIds,
        excludedCategoryIds,
      })
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Thông tin bộ size không hợp lệ.')
    }
  }

  return (
    <EditorModal title="Quản lý size" isSaving={isSaving} onClose={onClose}>
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
                onChange={(event) => setTemplateName(event.target.value)}
              />
            </div>
          </label>
          <div className="admin-size-category-list">
            <span>Danh mục áp dụng</span>
            {integrationCategoryIds.map((categoryId, index) => (
              <label className="admin-size-inline-field" key={`integrated-category-${index}`}>
                <div>
                  <CategoryApplySelect
                    categories={parentCategoryOptions}
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
          <div className="admin-size-template-subheading">
            <h4>
              <ColumnHeightOutlined className="admin-size-heading-icon" />
              <span>Số đo</span>
            </h4>
          </div>
          <div className="admin-measurement-field-list">
            {measurementFields.map((field, index) => (
              <div className="admin-measurement-row" key={`measurement-field-${index}`}>
                <div className="admin-measurement-row-main">
                  <label className="admin-size-inline-field">
                    <span>Tên số đo</span>
                    <div className="is-single">
                      <input
                        required={index === 0}
                        value={field.label}
                        placeholder="Ví dụ: Vòng ngực"
                        onChange={(event) => updateMeasurementField(index, 'label', event.target.value)}
                      />
                    </div>
                  </label>
                  <label className="admin-size-inline-field">
                    <span>Đơn vị</span>
                    <div className="is-single">
                      <input
                        required={index === 0}
                        value={field.unit}
                        placeholder="cm"
                        onChange={(event) => updateMeasurementField(index, 'unit', event.target.value)}
                      />
                    </div>
                  </label>
                  <label className="admin-measurement-required">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(event) => updateMeasurementField(index, 'required', event.target.checked)}
                    />
                    <span>Bắt buộc</span>
                  </label>
                </div>
                <button
                  className="admin-icon-button"
                  type="button"
                  disabled={isSaving || measurementFields.length === 1}
                  onClick={() => removeMeasurementField(index)}
                  aria-label={`Xóa số đo ${index + 1}`}
                >
                  ×
                </button>
              </div>
            ))}
            <button className="admin-secondary-button" type="button" disabled={isSaving} onClick={addMeasurementField}>
              + Thêm số đo
            </button>
          </div>
        </section>
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
