import {useCallback, useEffect, useMemo,useState,} from 'react'
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
} from './catalog.service'
import type {
  BrandInput,
  CatalogGender,
  CategoryInput,
  ManagedBrand,
  ManagedCategory,
} from './catalog.types'
import {
  BrandEditor,
  BrandStatIcon,
  CatalogSection,
  CategoryEditor,
  CategoryStatIcon,
  EmptyRow,
  LoadingRow,
  RowActions,
  StatusPill,
} from './components/CatalogEditors'
import { getPaginationItems } from '../../utils/pagination'
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

type DeleteMode = 'soft' | 'permanent'

const genderLabels: Record<CatalogGender, string> = {
  male: 'Nam',
  female: 'Nữ',
  unisex: 'Unisex',
}

const categoryRootsPerPage = 10

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Không thể xử lý yêu cầu'

export function CatalogManagementPage({ currentUser }: CatalogManagementPageProps) {
  const [categories, setCategories] = useState<ManagedCategory[]>([])
  const [brands, setBrands] = useState<ManagedBrand[]>([])
  const [categoryKeyword, setCategoryKeyword] = useState('')
  const [brandKeyword, setBrandKeyword] = useState('')
  const [genderFilter, setGenderFilter] = useState<'all' | CatalogGender>('all')
  const [categoryLevelFilter, setCategoryLevelFilter] = useState<'all' | string>('all')
  const [categoryStatusFilter, setCategoryStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [brandStatusFilter, setBrandStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [categoryPage, setCategoryPage] = useState(1)
  const [editor, setEditor] = useState<EditorState>(null)
  const [viewingCategory, setViewingCategory] = useState<ManagedCategory | null>(null)
  const [viewingBrand, setViewingBrand] = useState<ManagedBrand | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DeleteState>(null)
  const [pendingDeleteMode, setPendingDeleteMode] = useState<DeleteMode | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
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
    if (notice?.type !== 'success') return

    const timeoutId = window.setTimeout(() => {
      setNotice(null)
    }, 4500)

    return () => window.clearTimeout(timeoutId)
  }, [notice])

  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category._id, category.name])),
    [categories],
  )

  const categoryPagination = useMemo(() => {
    const keyword = categoryKeyword.trim().toLocaleLowerCase('vi')
    const categoryById = new Map(categories.map((category) => [category._id, category]))
    const childrenByParentId = new Map<string, ManagedCategory[]>()

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
      .map((root) => ({ root, items: collectGroup(root) }))
      .filter(({ items }) =>
        items.some((category) => {
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
        }),
      )
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

  const handleSaveCategory = async (
    input: CategoryInput,
    imageFile?: File | null,
    categoryId?: string,
  ) => {
    setIsSaving(true)
    setNotice(null)

    try {
      if (categoryId) {
        await updateManagedCategory(categoryId, input, imageFile)
        setNotice({ type: 'success', message: 'Danh mục đã được cập nhật.' })
      } else {
        await createManagedCategory(input, imageFile)
        setNotice({ type: 'success', message: 'Danh mục mới đã sẵn sàng để sử dụng.' })
      }
      setEditor(null)
      await loadCatalog()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveBrand = async (
    input: BrandInput,
    imageFile?: File | null,
    brandId?: string,
  ) => {
    setIsSaving(true)
    setNotice(null)

    try {
      if (brandId) {
        await updateManagedBrand(brandId, input, imageFile)
        setNotice({ type: 'success', message: 'Thương hiệu đã được cập nhật.' })
      } else {
        await createManagedBrand(input, imageFile)
        setNotice({ type: 'success', message: 'Thương hiệu mới đã sẵn sàng để sử dụng.' })
      }
      setEditor(null)
      await loadCatalog()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (mode: DeleteMode = 'soft') => {
    if (!pendingDelete) return

    setIsSaving(true)
    setNotice(null)

    try {
      if (pendingDelete.type === 'category') {
        if (mode === 'permanent') {
          await deleteManagedCategoryPermanently(pendingDelete.item._id)
          setNotice({ type: 'success', message: 'Danh mục đã được gỡ khỏi hệ thống.' })
        } else {
          await deleteManagedCategory(pendingDelete.item._id, {
            cascadeProducts: pendingDelete.item.activeProductCount > 0,
          })
          setNotice({ type: 'success', message: 'Danh mục đã tạm ngừng hiển thị.' })
        }
      } else {
        if (mode === 'permanent') {
          await deleteManagedBrandPermanently(pendingDelete.item._id)
          setNotice({ type: 'success', message: 'Thương hiệu đã được gỡ khỏi hệ thống.' })
        } else {
          await deleteManagedBrand(pendingDelete.item._id)
          setNotice({ type: 'success', message: 'Thương hiệu đã tạm ngừng hiển thị.' })
        }
      }
      setPendingDelete(null)
      setPendingDeleteMode(null)
      await loadCatalog()
    } catch (error) {
      setNotice({ type: 'error', message: getErrorMessage(error) })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="admin-catalog-page" aria-busy={isLoading}>
      <header className="admin-page-heading">
        <div>
          <p>Quản lý Catalog</p>
          <h1>Danh mục & thương hiệu</h1>
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

      {notice ? (
        <div className="admin-toast-container" aria-live="polite" aria-atomic="true">
          <div className={`admin-toast is-${notice.type}`}>
            <span>{notice.message}</span>
            <button
              type="button"
              className="admin-toast-close"
              onClick={() => setNotice(null)}
              aria-label="Đóng thông báo"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}

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
          <CatalogSection
            title="Danh mục sản phẩm"
            actionLabel="+ Thêm danh mục"
            canWrite={canWrite}
            onAdd={() => setEditor({ type: 'category' })}
          >
            <div className="admin-catalog-filters">
              <input
                type="search"
                value={categoryKeyword}
                onChange={(event) => setCategoryKeyword(event.target.value)}
                placeholder="Tìm kiếm danh mục..."
                aria-label="Tìm kiếm danh mục"
              />
              <select
                value={genderFilter}
                onChange={(event) =>
                  setGenderFilter(event.target.value as 'all' | CatalogGender)
                }
                aria-label="Lọc giới tính"
              >
                <option value="all">Tất cả giới tính</option>
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
                <option value="unisex">Unisex</option>
              </select>
              <select value={categoryLevelFilter} onChange={(event) => setCategoryLevelFilter(event.target.value)} aria-label="Lọc cấp danh mục">
                <option value="all">Tất cả cấp</option>
                {[...new Set(categories.map((category) => category.level))]
                  .sort((left, right) => left - right)
                  .map((level) => <option value={level} key={level}>Cấp {level}</option>)}
              </select>
              <select value={categoryStatusFilter} onChange={(event) => setCategoryStatusFilter(event.target.value as 'all' | 'active' | 'inactive')} aria-label="Lọc trạng thái danh mục">
                <option value="all">Tất cả trạng thái</option>
                <option value="active">Hoạt động</option>
                <option value="inactive">Tạm ngừng</option>
              </select>
              <button
                className="admin-secondary-button"
                type="button"
                onClick={() => {
                  setCategoryKeyword('')
                  setGenderFilter('all')
                  setCategoryLevelFilter('all')
                  setCategoryStatusFilter('all')
                }}
              >
                Đặt lại
              </button>
            </div>

            <div className="admin-table-shell">
              <table className="admin-table admin-catalog-table">
                <thead>
                  <tr>
                    <th>Tên danh mục</th>
                    <th>Danh mục cha</th>
                    <th>Giới tính</th>
                    <th>Số sản phẩm</th>
                    <th>Trạng thái</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? <LoadingRow colSpan={6} /> : null}
                  {!isLoading && categoryPagination.categories.length === 0 ? (
                    <EmptyRow colSpan={6} label="Không có danh mục phù hợp." />
                  ) : null}
                  {!isLoading
                    ? categoryPagination.categories.map((category) => (
                        <tr
                          key={category._id}
                          className={`admin-category-level-${Math.min(category.level, 4)}`}
                        >
                          <td>
                            <strong className="admin-category-level-name">
                              {category.name}
                            </strong>
                          </td>
                          <td>{category.parent_id ? categoryNameById.get(category.parent_id) ?? '-' : '-'}</td>
                          <td>{genderLabels[category.gender]}</td>
                          <td>{category.productCount}</td>
                          <td><StatusPill isActive={category.isActive} /></td>
                          <td>
                            <RowActions
                              disabled={!canWrite}
                              onView={() => setViewingCategory(category)}
                              onEdit={() => setEditor({ type: 'category', item: category })}
                              onDelete={() => {
                                setPendingDelete({ type: 'category', item: category })
                                setPendingDeleteMode(null)
                              }}
                            />
                          </td>
                        </tr>
                      ))
                    : null}
                </tbody>
              </table>
            </div>
            <footer className="admin-table-footer admin-catalog-pagination">
              <span>
                Nhóm danh mục {categoryPagination.startRoot} / {categoryPagination.totalRoots}
              </span>
              <div>
                <button
                  className="admin-secondary-button"
                  type="button"
                  disabled={categoryPagination.safePage <= 1 || isLoading}
                  onClick={() => setCategoryPage((page) => Math.max(1, page - 1))}
                >
                  Trước
                </button>
                <div className="admin-catalog-page-numbers" aria-label="Phân trang danh mục">
                  {getPaginationItems(
                    categoryPagination.totalPages,
                    categoryPagination.safePage,
                  ).map((item) =>
                    typeof item === 'number' ? (
                      <button
                        className={`admin-catalog-page-button${
                          item === categoryPagination.safePage ? ' is-active' : ''
                        }`}
                        type="button"
                        key={item}
                        aria-current={
                          item === categoryPagination.safePage ? 'page' : undefined
                        }
                        disabled={isLoading}
                        onClick={() => setCategoryPage(item)}
                      >
                        {item}
                      </button>
                    ) : (
                      <span className="admin-page-ellipsis" key={item} aria-hidden="true">
                        ...
                      </span>
                    ),
                  )}
                </div>
                <button
                  className="admin-secondary-button"
                  type="button"
                  disabled={categoryPagination.safePage >= categoryPagination.totalPages || isLoading}
                  onClick={() =>
                    setCategoryPage((page) =>
                      Math.min(categoryPagination.totalPages, page + 1),
                    )
                  }
                >
                  Sau
                </button>
              </div>
            </footer>
          </CatalogSection>

          <CatalogSection
            title="Thương hiệu"
            actionLabel="+ Thêm thương hiệu"
            canWrite={canWrite}
            onAdd={() => setEditor({ type: 'brand' })}
          >
            <div className="admin-catalog-filters is-brand">
              <input
                type="search"
                value={brandKeyword}
                onChange={(event) => setBrandKeyword(event.target.value)}
                placeholder="Tìm kiếm thương hiệu..."
                aria-label="Tìm kiếm thương hiệu"
              />
              <select value={brandStatusFilter} onChange={(event) => setBrandStatusFilter(event.target.value as 'all' | 'active' | 'inactive')} aria-label="Lọc trạng thái thương hiệu">
                <option value="all">Tất cả trạng thái</option>
                <option value="active">Hoạt động</option>
                <option value="inactive">Tạm ngừng</option>
              </select>
              <button
                className="admin-secondary-button"
                type="button"
                onClick={() => {
                  setBrandKeyword('')
                  setBrandStatusFilter('all')
                }}
              >
                Đặt lại
              </button>
            </div>

            <div className="admin-table-shell">
              <table className="admin-table admin-catalog-table is-brand">
                <thead>
                  <tr>
                    <th>Logo</th>
                    <th>Tên thương hiệu</th>
                    <th>Số sản phẩm</th>
                    <th>Trạng thái</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? <LoadingRow colSpan={5} /> : null}
                  {!isLoading && visibleBrands.length === 0 ? (
                    <EmptyRow colSpan={5} label="Không có thương hiệu phù hợp." />
                  ) : null}
                  {!isLoading
                    ? visibleBrands.map((brand) => (
                        <tr key={brand._id}>
                          <td>
                            <span className="admin-brand-logo">
                              <img src={brand.image} alt="" />
                            </span>
                          </td>
                          <td><strong>{brand.name}</strong></td>
                          <td>{brand.productCount}</td>
                          <td><StatusPill isActive={brand.isActive} /></td>
                          <td>
                            <RowActions
                              disabled={!canWrite}
                              onView={() => setViewingBrand(brand)}
                              onEdit={() => setEditor({ type: 'brand', item: brand })}
                              onDelete={() => {
                                setPendingDelete({ type: 'brand', item: brand })
                                setPendingDeleteMode(null)
                              }}
                            />
                          </td>
                        </tr>
                      ))
                    : null}
                </tbody>
              </table>
            </div>
          </CatalogSection>
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

      {viewingCategory ? (
        <div className="admin-catalog-modal-layer" role="dialog" aria-modal="true" aria-labelledby="view-category-title">
          <button className="admin-catalog-modal-backdrop" type="button" aria-label="Đóng" onClick={() => setViewingCategory(null)} />
          <section className="admin-catalog-modal admin-category-view-modal">
            <header>
              <div>
                <p>Chi tiết danh mục</p>
                <h2 id="view-category-title">{viewingCategory.name}</h2>
              </div>
              <button className="admin-secondary-button" type="button" onClick={() => setViewingCategory(null)}>Đóng</button>
            </header>
            <div className="admin-category-view-content">
              <div className="admin-catalog-image-preview">
                <img src={viewingCategory.image} alt={viewingCategory.name} />
              </div>
              <dl>
                <div><dt>Danh mục cha</dt><dd>{viewingCategory.parent_id ? categoryNameById.get(viewingCategory.parent_id) ?? '-' : '-'}</dd></div>
                <div><dt>Giới tính</dt><dd>{genderLabels[viewingCategory.gender]}</dd></div>
                <div><dt>Số sản phẩm</dt><dd>{viewingCategory.productCount}</dd></div>
                <div><dt>Trạng thái</dt><dd><StatusPill isActive={viewingCategory.isActive} /></dd></div>
                <div className="is-wide"><dt>Mô tả</dt><dd>{viewingCategory.description || '-'}</dd></div>
              </dl>
            </div>
          </section>
        </div>
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
        <div className="admin-catalog-modal-layer" role="dialog" aria-modal="true" aria-labelledby="view-brand-title">
          <button className="admin-catalog-modal-backdrop" type="button" aria-label="Đóng" onClick={() => setViewingBrand(null)} />
          <section className="admin-catalog-modal admin-brand-view-modal">
            <header>
              <div>
                <p>Chi tiết thương hiệu</p>
                <h2 id="view-brand-title">{viewingBrand.name}</h2>
              </div>
              <button className="admin-secondary-button" type="button" onClick={() => setViewingBrand(null)}>Đóng</button>
            </header>
            <div className="admin-brand-view-content">
              <div className="admin-catalog-image-preview">
                <img src={viewingBrand.image} alt={viewingBrand.name} />
              </div>
              <dl>
                <div><dt>Tên thương hiệu</dt><dd>{viewingBrand.name}</dd></div>
                <div><dt>Số sản phẩm</dt><dd>{viewingBrand.productCount}</dd></div>
                <div><dt>Trạng thái</dt><dd><StatusPill isActive={viewingBrand.isActive} /></dd></div>
              </dl>
            </div>
          </section>
        </div>
      ) : null}

      {pendingDelete ? (
        <div className="admin-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="catalog-delete-title">
          <div className="admin-confirm-box">
            <h2 id="catalog-delete-title">Xóa hoặc tạm ngừng?</h2>
            <p>
              Nếu chỉ muốn ẩn “{pendingDelete.item.name}” khỏi quy trình bán hàng, hãy chọn tạm
              ngừng. Dữ liệu cũ vẫn được giữ lại để tra cứu.
            </p>
            <p className="admin-delete-warning">
              Chỉ xóa vĩnh viễn khi đây là dữ liệu tạo nhầm hoặc chưa từng được sử dụng. Với
              danh mục, hệ thống sẽ chặn nếu còn danh mục con, sản phẩm, mẫu size/form hoặc
              khuyến mãi liên quan.
            </p>
            {pendingDelete.type === 'category' && pendingDelete.item.activeProductCount > 0 ? (
              <p className="admin-delete-blocked">
                Danh mục này còn {pendingDelete.item.activeProductCount.toLocaleString('vi-VN')} sản
                phẩm đang bán. Nếu tạm ngừng danh mục, các sản phẩm liên quan cũng sẽ được ngừng bán.
              </p>
            ) : null}
            <div>
              <button
                className="admin-secondary-button"
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setPendingDelete(null)
                  setPendingDeleteMode(null)
                }}
              >
                Hủy
              </button>
              <button className="admin-danger-button" type="button" disabled={isSaving} onClick={() => setPendingDeleteMode('soft')}>
                {isSaving ? 'Đang xử lý...' : 'Tạm ngừng'}
              </button>
              <button
                className="admin-danger-button is-permanent"
                type="button"
                disabled={isSaving || pendingDelete.item.productCount > 0}
                onClick={() => setPendingDeleteMode('permanent')}
              >
                Xóa vĩnh viễn
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingDelete && pendingDeleteMode ? (
        <div className="admin-confirm-layer is-top" role="dialog" aria-modal="true" aria-labelledby="catalog-delete-final-title">
          <div className="admin-confirm-box">
            <h2 id="catalog-delete-final-title">
              Bạn có thật sự muốn {pendingDeleteMode === 'permanent' ? 'xóa vĩnh viễn' : 'tạm ngừng'}?
            </h2>
            <p>
              Xác nhận thao tác với “{pendingDelete.item.name}”.
            </p>
            {pendingDeleteMode === 'permanent' ? (
              <p className="admin-delete-blocked">
                Sau khi xóa vĩnh viễn, dữ liệu này sẽ không thể khôi phục.
              </p>
            ) : pendingDelete.type === 'category' && pendingDelete.item.activeProductCount > 0 ? (
              <p className="admin-delete-warning">
                Xác nhận tạm ngừng danh mục và ngừng bán{' '}
                {pendingDelete.item.activeProductCount.toLocaleString('vi-VN')} sản phẩm liên quan.
              </p>
            ) : null}
            <div>
              <button
                className="admin-secondary-button"
                type="button"
                disabled={isSaving}
                onClick={() => setPendingDeleteMode(null)}
              >
                Không
              </button>
              <button
                className="admin-danger-button"
                type="button"
                disabled={isSaving}
                onClick={() => void handleDelete(pendingDeleteMode)}
              >
                {isSaving ? 'Đang xử lý...' : 'Có, xác nhận'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
