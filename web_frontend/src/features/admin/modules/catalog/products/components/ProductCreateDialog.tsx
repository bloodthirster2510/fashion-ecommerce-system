import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  getProductCategoryTemplate,
  listProductBrands,
  listProductCategories,
} from '../product.service'
import type {
  CreateProductInput,
  ProductBrandOption,
  ProductCategoryOption,
  ProductCategoryTemplate,
  ProductDetailResponse,
  ProductImageFileInput,
  ProductVariantInput,
} from '../product.types'

type Props = {
  product?: ProductDetailResponse | null
  isSaving: boolean
  errorMessage: string
  onClose: () => void
  onSave: (
    input: CreateProductInput,
    productImageFile?: File | null,
    colorImageFiles?: ProductImageFileInput[],
  ) => Promise<void>
}

type ProductForm = Omit<CreateProductInput, 'variant'>

const emptyForm: ProductForm = {
  category_id: '',
  name: '',
  brand_id: '',
  description: '',
  product_image: '',
  isActive: true,
}

const emptyColor = () => ({ color: '', colorCode: '#111111', image: '' })
const createColorImageKey = (variantIndex: number, colorIndex: number) =>
  `${variantIndex}:${colorIndex}`
const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Không thể tải dữ liệu tạo sản phẩm'
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

const normalizeSize = (size: string) => size.trim().toLowerCase()

const createSizeOption = (size: string): ProductVariantInput['sizeMeasurements'][number] => ({
  size: size.trim(),
})

const getSizeTemplateSource = (template: ProductCategoryTemplate) =>
  template.sizeTemplateSource ?? template.templateSource

const getFitTypeTemplateSource = (template: ProductCategoryTemplate) =>
  template.fitTypeTemplateSource ?? template.templateSource

const getDefaultSizes = (template: ProductCategoryTemplate) => {
  const templateSizes = getSizeTemplateSource(template).sizes.map((size) => size.trim()).filter(Boolean)

  return templateSizes
}

const createVariant = (
  template: ProductCategoryTemplate,
  fitTypeId: string,
): ProductVariantInput => ({
  fitTypeId,
  price: 1000,
  discount: 0,
  sizeMeasurements: getDefaultSizes(template).map(createSizeOption),
  colors: [emptyColor()],
  isActive: true,
})

export function ProductCreateDialog({
  product,
  isSaving,
  errorMessage,
  onClose,
  onSave,
}: Props) {
  const [categories, setCategories] = useState<ProductCategoryOption[]>([])
  const [brands, setBrands] = useState<ProductBrandOption[]>([])
  const [template, setTemplate] = useState<ProductCategoryTemplate | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [variants, setVariants] = useState<ProductVariantInput[]>([])
  const [productImageFile, setProductImageFile] = useState<File | null>(null)
  const [colorImageFiles, setColorImageFiles] = useState<Record<string, File | null>>({})
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    let active = true
    void Promise.all([listProductCategories(), listProductBrands()])
      .then(([categoryResult, brandResult]) => {
        if (!active) return
        setCategories(categoryResult.filter((item) => item.isActive))
        setBrands(brandResult.filter((item) => item.isActive))
      })
      .catch((error) => {
        if (active) setLocalError(getErrorMessage(error))
      })
      .finally(() => {
        if (active) setIsLoadingOptions(false)
      })
    return () => {
      active = false
    }
  }, [])

  const fitTypes = useMemo(
    () => template ? getFitTypeTemplateSource(template).fitTypes.filter((item) => item.isActive) : [],
    [template],
  )

  const loadCategoryTemplate = async (
    categoryId: string,
    options: { resetVariants?: boolean } = {},
  ) => {
    setTemplate(null)
    if (options.resetVariants ?? true) {
      setVariants([])
      setColorImageFiles({})
    }
    setLocalError('')
    if (!categoryId) return null

    setIsLoadingTemplate(true)
    try {
      const result = await getProductCategoryTemplate(categoryId)
      const activeFitTypes = getFitTypeTemplateSource(result).fitTypes.filter((item) => item.isActive)
      if (
        !getSizeTemplateSource(result).sizes.length ||
        !activeFitTypes.length
      ) {
        throw new Error('Danh mục chưa có đủ cấu hình form dáng và size.')
      }
      setTemplate(result)
      if (options.resetVariants ?? true) {
        setVariants([createVariant(result, activeFitTypes[0]._id)])
      }
      return result
    } catch (error) {
      setLocalError(getErrorMessage(error))
      return null
    } finally {
      setIsLoadingTemplate(false)
    }
  }

  const handleCategoryChange = async (categoryId: string) => {
    setForm((current) => ({ ...current, category_id: categoryId }))
    await loadCategoryTemplate(categoryId)
  }

  useEffect(() => {
    if (!product) return
    const categoryId = product.category?._id ?? ''
    setForm({
      category_id: categoryId,
      name: product.name,
      brand_id: product.brand?._id ?? '',
      description: product.description,
      product_image: product.productImage,
      isActive: product.isActive,
    })
    setVariants(product.variants.map((variant) => ({
      _id: variant._id,
      fitTypeId: variant.fitTypeId,
      price: variant.price,
      discount: variant.discount,
      sizeMeasurements: variant.sizes.map((size) => ({
        size: size.size,
      })),
      colors: variant.colors.map((color) => ({
        _id: color._id,
        color: color.color,
        colorCode: color.colorCode,
        image: color.image,
      })),
      isActive: variant.isActive,
    })))
    setProductImageFile(null)
    setColorImageFiles({})
    void loadCategoryTemplate(categoryId, { resetVariants: false })
  }, [product])

  const updateVariant = (index: number, next: ProductVariantInput) => {
    setVariants((current) =>
      current.map((item, itemIndex) => itemIndex === index ? next : item),
    )
  }

  const handleProductImageFileChange = (file: File | null, input: HTMLInputElement) => {
    const validationError = getImageFileValidationError(file)
    if (validationError) {
      setProductImageFile(null)
      setLocalError(validationError)
      input.value = ''
      return
    }

    setLocalError('')
    setProductImageFile(file)
  }

  const addVariant = () => {
    if (!template) return
    const usedIds = new Set(variants.map((item) => item.fitTypeId))
    const nextFitType = fitTypes.find((item) => !usedIds.has(item._id))
    if (!nextFitType) {
      setLocalError('Đã thêm tất cả form dáng có sẵn của danh mục.')
      return
    }
    setLocalError('')
    setVariants((current) => [...current, createVariant(template, nextFitType._id)])
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!productImageFile && !form.product_image.trim()) {
      setLocalError('Vui lòng chọn ảnh đại diện hoặc nhập URL ảnh sản phẩm.')
      return
    }
    if (!variants.length) {
      setLocalError('Sản phẩm cần ít nhất một biến thể.')
      return
    }
    if (
      variants.some((variant) =>
        !variant.colors.length ||
        variant.colors.some((color, colorIndex) => {
          const variantIndex = variants.indexOf(variant)
          return (
            (!color.color.trim() ||
              (!color.image.trim() &&
                !colorImageFiles[createColorImageKey(variantIndex, colorIndex)]))
          )
        }),
      )
    ) {
      setLocalError('Mỗi biến thể cần ít nhất một màu với tên và ảnh đầy đủ.')
      return
    }

    const selectedColorImageFiles = variants.flatMap((variant, variantIndex) =>
      variant.colors.flatMap((_, colorIndex) => {
        const file = colorImageFiles[createColorImageKey(variantIndex, colorIndex)]
        if (!file) return []
        const index = variants
          .slice(0, variantIndex)
          .reduce((total, item) => total + item.colors.length, 0) + colorIndex
        return [{ index, file }]
      }),
    )

    setLocalError('')
    void onSave({
      ...form,
      name: form.name.trim(),
      description: form.description.trim(),
      product_image: form.product_image.trim(),
      variant: variants.map((variant) => ({
        ...variant,
        colors: variant.colors.map((color) => ({
          ...color,
          color: color.color.trim(),
          image: color.image.trim(),
        })),
      })),
    }, productImageFile, selectedColorImageFiles)
  }

  return (
    <div className="admin-product-create-layer" role="dialog" aria-modal="true" aria-labelledby="create-product-title">
      <button className="admin-product-create-backdrop" type="button" aria-label="Đóng" disabled={isSaving} onClick={onClose} />
      <section className="admin-product-create-dialog">
        <header>
          <div>
            <span>Quản lý sản phẩm</span>
            <h2 id="create-product-title">{product ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</h2>
          </div>
          <button className="admin-icon-button" type="button" disabled={isSaving} onClick={onClose} aria-label="Đóng">×</button>
        </header>

        <form onSubmit={handleSubmit}>
          {errorMessage || localError ? (
            <p className="admin-notice is-error" role="alert">{errorMessage || localError}</p>
          ) : null}

          <fieldset disabled={isSaving || isLoadingOptions}>
            <h3 className="admin-product-create-fieldset-title">Thông tin cơ bản</h3>
            <div className="admin-product-create-grid">
              <label className="is-wide">
                <span>Tên sản phẩm</span>
                <input required minLength={3} maxLength={150} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </label>
              <label>
                <span>Danh mục</span>
                <select required value={form.category_id} onChange={(event) => void handleCategoryChange(event.target.value)}>
                  <option value="">{isLoadingOptions ? 'Đang tải...' : 'Chọn danh mục'}</option>
                  {categories.map((category) => (
                    <option key={category._id} value={category._id}>
                      {'- '.repeat(Math.max(0, category.level - 1))}{category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Thương hiệu</span>
                <select required value={form.brand_id} onChange={(event) => setForm({ ...form, brand_id: event.target.value })}>
                  <option value="">Chọn thương hiệu</option>
                  {brands.map((brand) => <option key={brand._id} value={brand._id}>{brand.name}</option>)}
                </select>
              </label>
              <label className="is-wide">
                <span>Mô tả</span>
                <textarea required minLength={10} maxLength={3000} rows={5} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </label>
              <label className="is-wide">
                <span>Ảnh đại diện</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => handleProductImageFileChange(event.target.files?.[0] ?? null, event.currentTarget)}
                />
                <small>JPEG, PNG hoặc WEBP, tối đa 5MB.</small>
                <input type="url" placeholder="Hoặc nhập URL ảnh" value={form.product_image} onChange={(event) => setForm({ ...form, product_image: event.target.value })} />
                <ProductImagePreview file={productImageFile} url={form.product_image} />
              </label>
              <label className="admin-product-create-checkbox is-wide">
                <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
                <span>{product ? 'Đang bán' : 'Đăng bán ngay sau khi tạo'}</span>
              </label>
            </div>
          </fieldset>

          <fieldset disabled={isSaving || isLoadingTemplate || !template}>
            <div className="admin-product-create-fieldset-heading">
              <h3 className="admin-product-create-fieldset-title">Biến thể sản phẩm</h3>
              <button className="admin-secondary-button" type="button" onClick={addVariant} disabled={!template || variants.length >= fitTypes.length}>
                + Thêm form dáng
              </button>
            </div>
            {isLoadingTemplate ? <p className="admin-product-create-hint">Đang tải cấu hình danh mục...</p> : null}
            {!form.category_id ? <p className="admin-product-create-hint">Chọn danh mục để cấu hình form dáng và size.</p> : null}
            {template
              ? variants.map((variant, variantIndex) => (
                  <VariantEditor
                    key={`${variant.fitTypeId}:${variantIndex}`}
                    index={variantIndex}
                    variant={variant}
                    template={template}
                    selectedFitTypeIds={variants.map((item) => item.fitTypeId)}
                    onChange={(next) => updateVariant(variantIndex, next)}
                    colorImageFiles={colorImageFiles}
                    onColorImageChange={(colorIndex, file) => {
                      setColorImageFiles((current) => ({
                        ...current,
                        [createColorImageKey(variantIndex, colorIndex)]: file,
                      }))
                    }}
                    onImageValidationError={setLocalError}
                    onColorRemove={(colorIndex) => {
                      setColorImageFiles((current) => {
                        const next = { ...current }
                        Object.keys(next).forEach((key) => {
                          if (key.startsWith(`${variantIndex}:`)) delete next[key]
                        })
                        variants[variantIndex]?.colors.forEach((_, currentColorIndex) => {
                          if (currentColorIndex === colorIndex) return
                          const nextColorIndex =
                            currentColorIndex > colorIndex
                              ? currentColorIndex - 1
                              : currentColorIndex
                          const file = current[createColorImageKey(variantIndex, currentColorIndex)]
                          if (file) next[createColorImageKey(variantIndex, nextColorIndex)] = file
                        })
                        return next
                      })
                    }}
                    onRemove={() => {
                      setVariants((current) => current.filter((_, index) => index !== variantIndex))
                      setColorImageFiles((current) => {
                        const next: Record<string, File | null> = {}
                        variants.forEach((variantItem, currentVariantIndex) => {
                          if (currentVariantIndex === variantIndex) return
                          const nextVariantIndex =
                            currentVariantIndex > variantIndex
                              ? currentVariantIndex - 1
                              : currentVariantIndex
                          variantItem.colors.forEach((_, colorIndex) => {
                            const file = current[createColorImageKey(currentVariantIndex, colorIndex)]
                            if (file) next[createColorImageKey(nextVariantIndex, colorIndex)] = file
                          })
                        })
                        return next
                      })
                    }}
                  />
                ))
              : null}
          </fieldset>

          <footer>
            <button className="admin-secondary-button" type="button" disabled={isSaving} onClick={onClose}>Hủy</button>
            <button className="admin-primary-button" type="submit" disabled={isSaving || isLoadingOptions || isLoadingTemplate || !template}>
              {isSaving ? 'Đang lưu...' : product ? 'Lưu sản phẩm' : 'Tạo sản phẩm'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

function VariantEditor({
  index,
  variant,
  template,
  selectedFitTypeIds,
  onChange,
  colorImageFiles,
  onColorImageChange,
  onImageValidationError,
  onColorRemove,
  onRemove,
}: {
  index: number
  variant: ProductVariantInput
  template: ProductCategoryTemplate
  selectedFitTypeIds: string[]
  onChange: (variant: ProductVariantInput) => void
  colorImageFiles: Record<string, File | null>
  onColorImageChange: (colorIndex: number, file: File | null) => void
  onImageValidationError: (message: string) => void
  onColorRemove: (colorIndex: number) => void
  onRemove: () => void
}) {
  const fitTypes = getFitTypeTemplateSource(template).fitTypes.filter((item) => item.isActive)
  const [newSize, setNewSize] = useState('')

  const handleColorImageFileChange = (
    colorIndex: number,
    file: File | null,
    input: HTMLInputElement,
  ) => {
    const validationError = getImageFileValidationError(file)
    if (validationError) {
      onColorImageChange(colorIndex, null)
      onImageValidationError(validationError)
      input.value = ''
      return
    }

    onImageValidationError('')
    onColorImageChange(colorIndex, file)
  }

  const addSize = () => {
    const size = newSize.trim()
    if (!size) return
    const isDuplicate = variant.sizeMeasurements.some(
      (item) => normalizeSize(item.size) === normalizeSize(size),
    )
    if (isDuplicate) {
      setNewSize('')
      return
    }
    onChange({
      ...variant,
      sizeMeasurements: [...variant.sizeMeasurements, createSizeOption(size)],
    })
    setNewSize('')
  }

  return (
    <article className="admin-product-variant-editor">
      <header>
        <strong>Biến thể {index + 1}</strong>
        <button className="admin-danger-link" type="button" onClick={onRemove}>Xóa biến thể</button>
      </header>
      <div className="admin-product-create-grid">
        <label>
          <span>Form dáng</span>
          <select required value={variant.fitTypeId} onChange={(event) => onChange({ ...variant, fitTypeId: event.target.value })}>
            {fitTypes.map((fitType) => (
              <option key={fitType._id} value={fitType._id} disabled={fitType._id !== variant.fitTypeId && selectedFitTypeIds.includes(fitType._id)}>
                {fitType.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Giá niêm yết (VND)</span>
          <input type="number" required min={1000} max={100000000} step={1000} value={variant.price} onChange={(event) => onChange({ ...variant, price: Number(event.target.value) })} />
        </label>
        <label>
          <span>Giảm giá (%)</span>
          <input type="number" required min={0} max={100} value={variant.discount} onChange={(event) => onChange({ ...variant, discount: Number(event.target.value) })} />
        </label>
        <label className="admin-product-create-checkbox">
          <input type="checkbox" checked={variant.isActive} onChange={(event) => onChange({ ...variant, isActive: event.target.checked })} />
          <span>Biến thể đang bán</span>
        </label>
      </div>

      <section className="admin-product-size-section">
        <div className="admin-product-size-heading">
          <h4>Size sản phẩm</h4>
          <div className="admin-product-size-add">
            <input
              list={`product-extra-sizes-${index}`}
              placeholder="Thêm size ngoại cỡ"
              value={newSize}
              onChange={(event) => setNewSize(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addSize()
                }
              }}
            />
            <datalist id={`product-extra-sizes-${index}`}>
              {getSizeTemplateSource(template).sizes
                .filter((size) => !variant.sizeMeasurements.some(
                  (item) => normalizeSize(item.size) === normalizeSize(size),
                ))
                .map((size) => <option key={size} value={size} />)}
            </datalist>
            <button className="admin-secondary-button" type="button" onClick={addSize}>
              + Thêm size
            </button>
          </div>
        </div>
        <div className="admin-product-size-list">
          {variant.sizeMeasurements.map((sizeMeasurement, sizeIndex) => (
            <div className="admin-product-size-chip" key={sizeMeasurement.size}>
              <strong>{sizeMeasurement.size}</strong>
              <button
                type="button"
                aria-label={`Xóa size ${sizeMeasurement.size}`}
                disabled={variant.sizeMeasurements.length === 1}
                onClick={() => {
                  onChange({
                    ...variant,
                    sizeMeasurements: variant.sizeMeasurements.filter(
                      (_, itemIndex) => itemIndex !== sizeIndex,
                    ),
                  })
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-product-color-section">
        <div>
          <h4>Màu sắc</h4>
          <button className="admin-secondary-button" type="button" onClick={() => onChange({ ...variant, colors: [...variant.colors, emptyColor()] })}>
            + Thêm màu
          </button>
        </div>
        <div className="admin-product-color-list">
          {variant.colors.map((color, colorIndex) => (
            <div className="admin-product-color-row" key={colorIndex}>
              <div className="admin-product-color-fields">
                <label>
                  <span>Tên màu</span>
                  <input required minLength={2} maxLength={40} value={color.color} onChange={(event) => {
                    const colors = variant.colors.map((item, itemIndex) => itemIndex === colorIndex ? { ...item, color: event.target.value } : item)
                    onChange({ ...variant, colors })
                  }} />
                </label>
                <label className="admin-product-color-code-field">
                  <span>Mã màu</span>
                  <input type="color" value={color.colorCode || '#111111'} onChange={(event) => {
                    const colors = variant.colors.map((item, itemIndex) => itemIndex === colorIndex ? { ...item, colorCode: event.target.value } : item)
                    onChange({ ...variant, colors })
                  }} />
                </label>
              </div>
              <label className="is-image-url">
                <span>Ảnh màu</span>
                <input
                  type="file"
                  required={!color.image}
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) =>
                    handleColorImageFileChange(
                      colorIndex,
                      event.target.files?.[0] ?? null,
                      event.currentTarget,
                    )
                  }
                />
                <small>JPEG, PNG hoặc WEBP, tối đa 5MB.</small>
                <ProductImagePreview
                  file={colorImageFiles[createColorImageKey(index, colorIndex)]}
                  url={color.image}
                  className="admin-product-color-preview"
                />
              </label>
              <button
                className="admin-danger-link"
                type="button"
                disabled={variant.colors.length === 1}
                onClick={() => {
                  onChange({ ...variant, colors: variant.colors.filter((_, itemIndex) => itemIndex !== colorIndex) })
                  onColorRemove(colorIndex)
                }}
              >
                Xóa màu
              </button>
            </div>
          ))}
        </div>
      </section>
    </article>
  )
}

function ProductImagePreview({
  file,
  url,
  className = 'admin-product-create-preview',
}: {
  file?: File | null
  url: string
  className?: string
}) {
  const [previewUrl, setPreviewUrl] = useState(url)

  useEffect(() => {
    if (!file) {
      setPreviewUrl(url)
      return
    }
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file, url])

  return previewUrl
    ? <img className={className} src={previewUrl} alt="Xem trước ảnh sản phẩm" />
    : null
}
