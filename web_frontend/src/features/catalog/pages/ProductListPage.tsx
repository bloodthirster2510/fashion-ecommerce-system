import { useEffect, useMemo, useState } from 'react'
import { Alert, Empty, Spin } from 'antd'
import { MainLayout } from '../../../layouts/MainLayout'
import { ProductCard } from '../../../components/ProductCard'
import { Pagination } from '../../../components/Pagination'
import { CatalogHero } from '../components/CatalogHero'
import { CatalogToolbar } from '../components/CatalogToolbar'
import { catalogService } from '../catalog.service'
import type {
  CatalogCategory,
  ProductListFilters,
  ProductListQuery,
  ProductListResponse,
  ProductSortOption,
} from '../catalog.types'
import '../catalog.css'

const LIMIT = 10

const sortOptions: Array<{ value: ProductSortOption; label: string }> = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'best_seller', label: 'Bán chạy' },
  { value: 'price_asc', label: 'Giá thấp đến cao' },
  { value: 'price_desc', label: 'Giá cao đến thấp' },
  { value: 'name_asc', label: 'Tên (A-Z)' },
  { value: 'name_desc', label: 'Tên (Z-A)' },
  { value: 'rating_desc', label: 'Đánh giá cao' },
]

const getNumberParam = (params: URLSearchParams, key: string) => {
  const value = params.get(key)
  if (!value) return undefined

  const parsedValue = Number(value)
  return Number.isFinite(parsedValue) ? parsedValue : undefined
}

const getBooleanParam = (params: URLSearchParams, key: string) => {
  const value = params.get(key)
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

const getListParam = (params: URLSearchParams, key: string) => {
  return params
    .getAll(key)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean)
}

const parseQuery = (search: string): ProductListQuery => {
  const params = new URLSearchParams(search)
  const color = getListParam(params, 'color')
  const fitType = getListParam(params, 'fitType')
  const size = getListParam(params, 'size')
  const gender = params.get('gender')

  return {
    keyword: params.get('keyword') || undefined,
    gender: gender === 'male' || gender === 'female' ? gender : undefined,
    categoryId: params.get('categoryId') || undefined,
    brandId: params.get('brandId') || undefined,
    ...(color.length ? { color } : {}),
    ...(fitType.length ? { fitType } : {}),
    ...(size.length ? { size } : {}),
    minPrice: getNumberParam(params, 'minPrice'),
    maxPrice: getNumberParam(params, 'maxPrice'),
    isSale: getBooleanParam(params, 'isSale'),
    isNew: getBooleanParam(params, 'isNew'),
    sort: (params.get('sort') as ProductSortOption | null) || 'newest',
    page: getNumberParam(params, 'page') || 1,
    limit: LIMIT,
  }
}

const setOptionalParam = (params: URLSearchParams, key: string, value?: string | number | boolean) => {
  if (value === undefined || value === '' || value === false) {
    params.delete(key)
    return
  }

  params.set(key, String(value))
}

const setListParam = (params: URLSearchParams, key: string, values?: string[]) => {
  params.delete(key)
  values?.forEach((value) => {
    if (value) {
      params.append(key, value)
    }
  })
}

export function ProductListPage() {
  const [search, setSearch] = useState(window.location.search)
  const query = useMemo(() => parseQuery(search), [search])
  const [productList, setProductList] = useState<ProductListResponse | null>(null)
  const [filters, setFilters] = useState<ProductListFilters>()
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const handlePopState = () => setSearch(window.location.search)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
  let isMounted = true

  const loadCatalog = async () => {
    try {
      setIsLoading(true)
      setError('')

      const productsPromise = catalogService.getProducts(query, false)
      const filtersPromise = catalogService.getProductFilters(query)
      const categoriesPromise = catalogService.getActiveCategories()
      void Promise.all([filtersPromise, categoriesPromise])
        .then(([nextFilters, activeCategories]) => {
          if (!isMounted) return
          setFilters(nextFilters)
          setCategories(activeCategories)
        })
        .catch(() => {
          // Dữ liệu bộ lọc không được phép chặn việc hiển thị lưới sản phẩm.
        })

      const products = await productsPromise

      if (!isMounted) return

      setProductList(products)
    } catch (loadError: unknown) {
      if (!isMounted) return

      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Không thể tải danh sách sản phẩm.'
      )
    } finally {
      if (isMounted) {
        setIsLoading(false)
      }
    }
  }

  loadCatalog()

  return () => {
    isMounted = false
  }
}, [query])

  const fitTypeLabelById = useMemo(() => {
    const labelById = new Map<string, string>()
    categories.forEach((category) => {
      category.fitTypes?.forEach((fitType) => {
        if (fitType.isActive) {
          labelById.set(fitType._id, fitType.label)
        }
      })
    })
    return labelById
  }, [categories])

  const updateQuery = (updates: Partial<ProductListQuery>, resetPage = true) => {
    const params = new URLSearchParams(window.location.search)

    setOptionalParam(params, 'keyword', updates.keyword)
    setOptionalParam(params, 'gender', updates.gender)
    setOptionalParam(params, 'categoryId', updates.categoryId)
    setOptionalParam(params, 'brandId', updates.brandId)
    setListParam(params, 'color', updates.color)
    setListParam(params, 'fitType', updates.fitType)
    setListParam(params, 'size', updates.size)
    setOptionalParam(params, 'minPrice', updates.minPrice)
    setOptionalParam(params, 'maxPrice', updates.maxPrice)
    setOptionalParam(params, 'isSale', updates.isSale)
    setOptionalParam(params, 'isNew', updates.isNew)
    setOptionalParam(params, 'sort', updates.sort)
    setOptionalParam(params, 'page', resetPage ? 1 : updates.page)

    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === null || value === false || (Array.isArray(value) && value.length === 0)) {
        params.delete(key)
      }
    })

    if (params.get('page') === '1') {
      params.delete('page')
    }

    const nextSearch = params.toString()
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`
    window.history.pushState({}, '', nextUrl)
    setSearch(window.location.search)
  }

  const applyQueryValue = <K extends keyof ProductListQuery>(key: K, value: ProductListQuery[K]) => {
    updateQuery({ ...query, [key]: value })
  }

  const clearFilters = () => {
    const params = new URLSearchParams()
    if (query.gender) params.set('gender', query.gender)
    if (query.sort && query.sort !== 'newest') params.set('sort', query.sort)

    const nextSearch = params.toString()
    window.history.pushState({}, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`)
    setSearch(window.location.search)
  }

  const selectedSort = sortOptions.find((option) => option.value === query.sort) ?? sortOptions[0]
  return (
    <MainLayout>
      <main className="catalog-page">
        <CatalogHero categories={categories} query={query} fallbackCategoryId={productList?.items[0]?.category?._id} />

        <CatalogToolbar
          query={query}
          filters={filters}
          fitTypeLabelById={fitTypeLabelById}
          sortOptions={sortOptions}
          selectedSort={selectedSort}
          onQueryValueChange={applyQueryValue}
          onClearFilters={clearFilters}
        />

        {error && <Alert className="catalog-alert" type="error" message={error} showIcon />}

        <Spin spinning={isLoading}>
          {productList && productList.items.length > 0 ? (
            <>
              <section className="product-grid" aria-label="Danh sách sản phẩm">
                {productList.items.map((product) => (
                  <ProductCard product={product} key={product._id} />
                ))}
              </section>

              <Pagination
                className="catalog-pagination"
                current={productList.pagination.page}
                pageSize={productList.pagination.limit}
                total={productList.pagination.totalItems}
                showSizeChanger={false}
                onChange={(page) => updateQuery({ ...query, page }, false)}
              />
            </>
          ) : (
            !isLoading && <Empty className="catalog-empty" description="Chưa có sản phẩm phù hợp." />
          )}
        </Spin>
      </main>
    </MainLayout>
  )
}
