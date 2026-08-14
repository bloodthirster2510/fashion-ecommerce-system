import { useCallback, useEffect, useMemo, useState } from 'react'
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query'
import type { AdminUser } from '../auth/adminSession'
import {
  createManagedBrand,
  createManagedCategory,
  deleteManagedBrand,
  deleteManagedBrandPermanently,
  deleteManagedCategory,
  deleteManagedCategoryPermanently,
  listManagedBrands,
  listManagedCategories,
  updateManagedBrand,
  updateManagedCategory,
  upsertManagedCategoryFitTypeTemplate,
  upsertManagedCategorySizeTemplate,
} from './catalog.service'
import type {
  BrandInput,
  CatalogGender,
  CategoryInput,
  FitTypeTemplateInput,
  ManagedBrand,
  ManagedCategory,
  SizeTemplateInput,
} from './catalog.types'
import {
  BrandEditor,
  BrandStatIcon,
  CategoryEditor,
  CategoryStatIcon,
  FitTypeTemplateManager,
  SizeTemplateManager,
} from './components/CatalogEditors'
import { BrandManagementSection } from './components/BrandManagementSection'
import { CatalogDeleteConfirmDialog } from './components/CatalogDeleteConfirmDialog'
import { CategoryManagementSection } from './components/CategoryManagementSection'
import { BrandDetailDialog, CategoryDetailDialog } from './components/CatalogDetailDialogs'
import type { CatalogDeleteMode, CatalogStatusFilter } from './catalogDisplay.helpers'
import { useToast } from '../../notifications/notification-context'
import './catalog.css'

type CatalogManagementPageProps = {
  currentUser: AdminUser
}

type Notice = {
  type: 'success' | 'error'
  message: string
}

type EditorState =
  | { type: 'category'; item?: ManagedCategory }
  | { type: 'brand'; item?: ManagedBrand }
  | null

type DeleteState =
  | { type: 'category'; item: ManagedCategory }
  | { type: 'brand'; item: ManagedBrand }
  | null

const categoryRootsPerPage = 1
const catalogMutationClient = new QueryClient()

type CategoryRootGroup = {
  root: ManagedCategory
  items: ManagedCategory[]
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Không thể xử lý yêu cầu'

export function CatalogManagementPage({ currentUser }: CatalogManagementPageProps) {
  return (
    <QueryClientProvider client={catalogMutationClient}>
      <CatalogManagementContent currentUser={currentUser} />
    </QueryClientProvider>
  )
}

function CatalogManagementContent({ currentUser }: CatalogManagementPageProps) {
  const { showToast } = useToast()
  const [categories, setCategories] = useState<ManagedCategory[]>([])
  const [brands, setBrands] = useState<ManagedBrand[]>([])
  const [categoryKeyword, setCategoryKeyword] = useState('')
  const [brandKeyword, setBrandKeyword] = useState('')
  const [genderFilter, setGenderFilter] = useState<'all' | CatalogGender>('all')
  const [categoryLevelFilter, setCategoryLevelFilter] = useState<'all' | string>('all')
  const [categoryStatusFilter, setCategoryStatusFilter] = useState<CatalogStatusFilter>('all')
  const [brandStatusFilter, setBrandStatusFilter] = useState<CatalogStatusFilter>('all')
  const [categoryPage, setCategoryPage] = useState(1)
  const [editor, setEditor] = useState<EditorState>(null)
  const [isManagingSizes, setIsManagingSizes] = useState(false)
  const [isManagingFitTypes, setIsManagingFitTypes] = useState(false)
  const [viewingCategory, setViewingCategory] = useState<ManagedCategory | null>(null)
  const [viewingBrand, setViewingBrand] = useState<ManagedBrand | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DeleteState>(null)
  const [pendingDeleteMode, setPendingDeleteMode] = useState<CatalogDeleteMode | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [loadError, setLoadError] = useState('')

  const canWrite =
    currentUser.role === 'admin' || (currentUser.permissions?.includes('catalog.write') ?? false)

  const loadCatalog = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')

    try {
      const [categoryResult, brandResult] = await Promise.all([
        listManagedCategories(),
        listManagedBrands(),
      ])
      setCategories(categoryResult)
      setBrands(brandResult)
    } catch (error) {
      setLoadError(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCatalog()
  }, [loadCatalog])

  useEffect(() => {
    if (!notice) return
    showToast(notice.message, notice.type)
    if (notice.type === 'success') setNotice(null)
  }, [notice, showToast])

  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category._id, category.name])),
    [categories],
  )
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category._id, category])),
    [categories],
  )

  const categoryPagination = useMemo(() => {
    const keyword = categoryKeyword.trim().toLocaleLowerCase('vi')
    const categoryById = new Map(categories.map((category) => [category._id, category]))
    const childrenByParentId = new Map<string, ManagedCategory[]>()
    const matchesCategoryFilter = (category: ManagedCategory) => {
      const matchesKeyword =
        !keyword || category.name.toLocaleLowerCase('vi').includes(keyword)
      const matchesGender = genderFilter === 'all' || category.gender === genderFilter
      const matchesLevel =
        categoryLevelFilter === 'all' ||
        category.level === Number(categoryLevelFilter)
      const matchesStatus =
        categoryStatusFilter === 'all' ||
        (categoryStatusFilter === 'active'
          ? category.isActive
          : !category.isActive)

      return matchesKeyword && matchesGender && matchesLevel && matchesStatus
    }

    categories.forEach((category) => {
      if (!category.parent_id || !categoryById.has(category.parent_id)) return
      const children = childrenByParentId.get(category.parent_id) ?? []
      children.push(category)
      childrenByParentId.set(category.parent_id, children)
    })

    const roots = categories.filter(
      (category) => !category.parent_id || !categoryById.has(category.parent_id),
    )
    const collectGroup = (root: ManagedCategory) => {
      const group: ManagedCategory[] = []
      const visited = new Set<string>()
      const visit = (category: ManagedCategory) => {
        if (visited.has(category._id)) return
        visited.add(category._id)
        group.push(category)
        const children = childrenByParentId.get(category._id) ?? []
        children.forEach(visit)
      }
      visit(root)
      return group
    }

    const matchingGroups = roots
      .map<CategoryRootGroup>((root) => ({ root, items: collectGroup(root) }))
      .filter(({ items }) => items.some(matchesCategoryFilter))
    const totalRoots = matchingGroups.length
    const totalPages = Math.max(1, Math.ceil(totalRoots / categoryRootsPerPage))
    const safePage = Math.min(categoryPage, totalPages)
    const startIndex = (safePage - 1) * categoryRootsPerPage
    const pageGroups = matchingGroups.slice(startIndex, startIndex + categoryRootsPerPage)

    return {
      categories: pageGroups.flatMap(({ items }) => items),
      totalRoots,
      totalPages,
      safePage,
      startRoot: totalRoots ? startIndex + 1 : 0,
      endRoot: Math.min(startIndex + categoryRootsPerPage, totalRoots),
    }
  }, [
    categories,
    categoryKeyword,
    categoryLevelFilter,
    categoryPage,
    categoryStatusFilter,
    genderFilter,
  ])

  useEffect(() => {
    setCategoryPage(1)
  }, [categoryKeyword, categoryLevelFilter, categoryStatusFilter, genderFilter])

  useEffect(() => {
    if (categoryPage !== categoryPagination.safePage) {
      setCategoryPage(categoryPagination.safePage)
    }
  }, [categoryPage, categoryPagination.safePage])

  const visibleBrands = useMemo(() => {
    const keyword = brandKeyword.trim().toLocaleLowerCase('vi')
    return brands.filter((brand) => {
      const matchesKeyword =
        !keyword || brand.name.toLocaleLowerCase('vi').includes(keyword)
      const matchesStatus =
        brandStatusFilter === 'all' ||
        (brandStatusFilter === 'active' ? brand.isActive : !brand.isActive)
      return matchesKeyword && matchesStatus
    })
  }, [brands, brandKeyword, brandStatusFilter])

  const saveCategoryMutation = useMutation({
    mutationFn: ({
      input,
      imageFile,
      categoryId,
    }: {
      input: CategoryInput
      imageFile?: File | null
      categoryId?: string
    }) =>
      categoryId
        ? updateManagedCategory(categoryId, input, imageFile)
        : createManagedCategory(input, imageFile),
    onMutate: () => {
      setNotice(null)
    },
    onSuccess: async (_savedCategory, variables) => {
      setNotice({
        type: 'success',
        message: variables.categoryId
          ? 'Danh mục đã được cập nhật.'
          : 'Danh mục mới đã sẵn sàng để sử dụng.',
      })
      setEditor(null)
      await loadCatalog()
    },
    onError: (error) => {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    },
  })

  const saveBrandMutation = useMutation({
    mutationFn: ({
      input,
      imageFile,
      brandId,
    }: {
      input: BrandInput
      imageFile?: File | null
      brandId?: string
    }) =>
      brandId
        ? updateManagedBrand(brandId, input, imageFile)
        : createManagedBrand(input, imageFile),
    onMutate: () => {
      setNotice(null)
    },
    onSuccess: async (_savedBrand, variables) => {
      setNotice({
        type: 'success',
        message: variables.brandId
          ? 'Thương hiệu đã được cập nhật.'
          : 'Thương hiệu mới đã sẵn sàng để sử dụng.',
      })
      setEditor(null)
      await loadCatalog()
    },
    onError: (error) => {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    },
  })

  const saveSizeTemplateMutation = useMutation({
    mutationFn: ({
      categoryId,
      input,
      sizeGuideImageFile,
    }: {
      categoryId: string
      input: SizeTemplateInput
      sizeGuideImageFile?: File | null
    }) => upsertManagedCategorySizeTemplate(categoryId, input, sizeGuideImageFile),
    onMutate: () => {
      setNotice(null)
    },
    onSuccess: async () => {
      setNotice({ type: 'success', message: 'Bộ size đã được lưu. Bạn có thể tiếp tục chỉnh các bộ size khác.' })
      await loadCatalog()
    },
    onError: (error) => {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    },
  })

  const saveFitTypeTemplateMutation = useMutation({
    mutationFn: ({
      categoryId,
      input,
    }: {
      categoryId: string
      input: FitTypeTemplateInput
    }) => upsertManagedCategoryFitTypeTemplate(categoryId, input),
    onMutate: () => {
      setNotice(null)
    },
    onSuccess: async () => {
      setNotice({ type: 'success', message: 'Bộ phom dáng đã được lưu. Bạn có thể tiếp tục chỉnh các bộ khác.' })
      await loadCatalog()
    },
    onError: (error) => {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    },
  })

  const deleteCatalogMutation = useMutation({
    mutationFn: async ({
      target,
      mode,
    }: {
      target: DeleteState
      mode: CatalogDeleteMode
    }) => {
      if (!target) {
        throw new Error('Chưa chọn mục catalog cần xử lý.')
      }

      if (target.type === 'category') {
        if (mode === 'permanent') {
          await deleteManagedCategoryPermanently(target.item._id)
        } else {
          await deleteManagedCategory(target.item._id, {
            cascadeProducts: target.item.activeProductCount > 0,
          })
        }
      } else if (mode === 'permanent') {
        await deleteManagedBrandPermanently(target.item._id)
      } else {
        await deleteManagedBrand(target.item._id, {
          cascadeProducts: target.item.activeProductCount > 0,
        })
      }

      return { target, mode }
    },
    onMutate: () => {
      setNotice(null)
    },
    onSuccess: async ({ target, mode }) => {
      if (target.type === 'category') {
        setNotice({
          type: 'success',
          message: mode === 'permanent'
            ? 'Danh mục đã được gỡ khỏi hệ thống.'
            : 'Danh mục đã tạm ngừng hiển thị.',
        })
      } else {
        setNotice({
          type: 'success',
          message: mode === 'permanent'
            ? 'Thương hiệu đã được gỡ khỏi hệ thống.'
            : 'Thương hiệu đã tạm ngừng hiển thị.',
        })
      }
      setPendingDelete(null)
      setPendingDeleteMode(null)
      await loadCatalog()
    },
    onError: (error) => {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    },
  })

  const isSaving =
    saveCategoryMutation.isPending ||
    saveBrandMutation.isPending ||
    saveSizeTemplateMutation.isPending ||
    saveFitTypeTemplateMutation.isPending ||
    deleteCatalogMutation.isPending

  const handleSaveCategory = async (
    input: CategoryInput,
    imageFile?: File | null,
    categoryId?: string,
  ) => {
    await saveCategoryMutation.mutateAsync({ input, imageFile, categoryId }).catch(() => undefined)
  }

  const handleSaveBrand = async (
    input: BrandInput,
    imageFile?: File | null,
    brandId?: string,
  ) => {
    await saveBrandMutation.mutateAsync({ input, imageFile, brandId }).catch(() => undefined)
  }

  const handleSaveSizeTemplate = async (
    categoryId: string,
    input: SizeTemplateInput,
    sizeGuideImageFile?: File | null,
  ) => {
    await saveSizeTemplateMutation.mutateAsync({ categoryId, input, sizeGuideImageFile })
  }

  const handleSaveFitTypeTemplate = async (
    categoryId: string,
    input: FitTypeTemplateInput,
  ) => {
    await saveFitTypeTemplateMutation.mutateAsync({ categoryId, input })
  }

  const handleDelete = async (mode: CatalogDeleteMode = 'soft') => {
    if (!pendingDelete) return

    await deleteCatalogMutation.mutateAsync({ target: pendingDelete, mode }).catch(() => undefined)
  }

  return (
    <section className="admin-catalog-page" aria-busy={isLoading}>
      <header className="admin-page-heading">
        <div>
          <h1>Danh mục & thương hiệu</h1>
          <p>Quản lý Danh mục và Thương hiệu</p>
        </div>
        <button className="admin-secondary-button" type="button" onClick={() => void loadCatalog()}>
          Làm mới
        </button>
      </header>

      <div className="admin-catalog-stats" aria-label="Thống kê catalog">
        <div>
          <span className="admin-catalog-stat-icon is-category" aria-hidden="true">
            <CategoryStatIcon />
          </span>
          <span className="admin-catalog-stat-content">
            <span>Tổng danh mục</span>
            <strong>{categories.length.toLocaleString('vi-VN')}</strong>
          </span>
        </div>
        <div>
          <span className="admin-catalog-stat-icon is-brand" aria-hidden="true">
            <BrandStatIcon />
          </span>
          <span className="admin-catalog-stat-content">
            <span>Tổng thương hiệu</span>
            <strong>{brands.length.toLocaleString('vi-VN')}</strong>
          </span>
        </div>
      </div>

      {loadError ? (
        <div className="admin-empty-state" role="alert">
          <strong>Không tải được catalog</strong>
          <span>{loadError}</span>
          <button className="admin-secondary-button" type="button" onClick={() => void loadCatalog()}>
            Thử lại
          </button>
        </div>
      ) : (
        <>
          <CategoryManagementSection
            categories={categories}
            categoryById={categoryById}
            categoryNameById={categoryNameById}
            pagination={categoryPagination}
            keyword={categoryKeyword}
            genderFilter={genderFilter}
            levelFilter={categoryLevelFilter}
            statusFilter={categoryStatusFilter}
            isLoading={isLoading}
            canWrite={canWrite}
            onKeywordChange={setCategoryKeyword}
            onGenderFilterChange={setGenderFilter}
            onLevelFilterChange={setCategoryLevelFilter}
            onStatusFilterChange={setCategoryStatusFilter}
            onPageChange={setCategoryPage}
            onAdd={() => setEditor({ type: 'category' })}
            onManageSizes={() => setIsManagingSizes(true)}
            onManageFitTypes={() => setIsManagingFitTypes(true)}
            onView={setViewingCategory}
            onEdit={(category) => setEditor({ type: 'category', item: category })}
            onDelete={(category) => {
              setPendingDelete({ type: 'category', item: category })
              setPendingDeleteMode(null)
            }}
          />

          <BrandManagementSection
            brands={visibleBrands}
            keyword={brandKeyword}
            statusFilter={brandStatusFilter}
            isLoading={isLoading}
            canWrite={canWrite}
            onKeywordChange={setBrandKeyword}
            onStatusFilterChange={setBrandStatusFilter}
            onAdd={() => setEditor({ type: 'brand' })}
            onView={setViewingBrand}
            onEdit={(brand) => setEditor({ type: 'brand', item: brand })}
            onDelete={(brand) => {
              setPendingDelete({ type: 'brand', item: brand })
              setPendingDeleteMode(null)
            }}
          />
        </>
      )}

      {editor?.type === 'category' ? (
        <CategoryEditor
          categories={categories}
          item={editor.item}
          isSaving={isSaving}
          errorMessage={notice?.type === 'error' ? notice.message : ''}
          onClose={() => setEditor(null)}
          onSave={handleSaveCategory}
        />
      ) : null}

      {isManagingSizes ? (
        <SizeTemplateManager
          categories={categories}
          isSaving={isSaving}
          errorMessage={notice?.type === 'error' ? notice.message : ''}
          onClose={() => setIsManagingSizes(false)}
          onSave={handleSaveSizeTemplate}
        />
      ) : null}

      {isManagingFitTypes ? (
        <FitTypeTemplateManager
          categories={categories}
          isSaving={isSaving}
          errorMessage={notice?.type === 'error' ? notice.message : ''}
          onClose={() => setIsManagingFitTypes(false)}
          onSave={handleSaveFitTypeTemplate}
        />
      ) : null}

      {viewingCategory ? (
        <CategoryDetailDialog
          category={viewingCategory}
          categoryById={categoryById}
          categoryNameById={categoryNameById}
          onClose={() => setViewingCategory(null)}
        />
      ) : null}

      {editor?.type === 'brand' ? (
        <BrandEditor
          item={editor.item}
          isSaving={isSaving}
          errorMessage={notice?.type === 'error' ? notice.message : ''}
          onClose={() => setEditor(null)}
          onSave={handleSaveBrand}
        />
      ) : null}

      {viewingBrand ? (
        <BrandDetailDialog brand={viewingBrand} onClose={() => setViewingBrand(null)} />
      ) : null}

      {pendingDelete ? (
        <CatalogDeleteConfirmDialog
          target={pendingDelete}
          mode={pendingDeleteMode}
          isSaving={isSaving}
          onCancel={() => {
            setPendingDelete(null)
            setPendingDeleteMode(null)
          }}
          onModeChange={setPendingDeleteMode}
          onConfirm={(mode) => void handleDelete(mode)}
        />
      ) : null}
    </section>
  )
}
