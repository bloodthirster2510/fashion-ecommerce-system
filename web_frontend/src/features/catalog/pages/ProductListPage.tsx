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

const validSortOptions = new Set<ProductSortOption>(sortOptions.map((option) => option.value))
const objectIdPattern = /^[a-f\d]{24}$/i

const getNonNegativeNumberParam = (params: URLSearchParams, key: string) => {
  const value = params.get(key)
  if (!value) return undefined

  const parsedValue = Number(value)
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : undefined
}

const getPositiveIntegerParam = (params: URLSearchParams, key: string) => {
  const value = getNonNegativeNumberParam(params, key)
  return value !== undefined && Number.isInteger(value) && value >= 1 ? value : undefined
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
  const fitType = getListParam(params, 'fitType').filter((value) => objectIdPattern.test(value))
  const size = getListParam(params, 'size')
  const gender = params.get('gender')
  const categoryId = params.get('categoryId')
  const brandId = params.get('brandId')
  const requestedSort = params.get('sort') as ProductSortOption | null
  const requestedMinPrice = getNonNegativeNumberParam(params, 'minPrice')
  const requestedMaxPrice = getNonNegativeNumberParam(params, 'maxPrice')
  const hasValidPriceRange = requestedMinPrice === undefined
    || requestedMaxPrice === undefined
    || requestedMinPrice <= requestedMaxPrice

  return {
    keyword: params.get('keyword')?.trim() || undefined,
    gender: gender === 'male' || gender === 'female' ? gender : undefined,
    categoryId: categoryId && objectIdPattern.test(categoryId) ? categoryId : undefined,
    brandId: brandId && objectIdPattern.test(brandId) ? brandId : undefined,
    ...(color.length ? { color } : {}),
    ...(fitType.length ? { fitType } : {}),
    ...(size.length ? { size } : {}),
    minPrice: hasValidPriceRange ? requestedMinPrice : undefined,
    maxPrice: hasValidPriceRange ? requestedMaxPrice : undefined,
    isSale: getBooleanParam(params, 'isSale'),
    isNew: getBooleanParam(params, 'isNew'),
    sort: requestedSort && validSortOptions.has(requestedSort) ? requestedSort : 'newest',
    page: getPositiveIntegerParam(params, 'page') || 1,
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

const buildNormalizedSearch = (query: ProductListQuery) => {
  const params = new URLSearchParams()

  setOptionalParam(params, 'keyword', query.keyword)
  setOptionalParam(params, 'gender', query.gender)
  setOptionalParam(params, 'categoryId', query.categoryId)
  setOptionalParam(params, 'brandId', query.brandId)
  setListParam(params, 'color', query.color)
  setListParam(params, 'fitType', query.fitType)
  setListParam(params, 'size', query.size)
  setOptionalParam(params, 'minPrice', query.minPrice)
  setOptionalParam(params, 'maxPrice', query.maxPrice)
  setOptionalParam(params, 'isSale', query.isSale)
  setOptionalParam(params, 'isNew', query.isNew)
  if (query.sort && query.sort !== 'newest') params.set('sort', query.sort)
  if (query.page && query.page > 1) params.set('page', String(query.page))

  const normalizedSearch = params.toString()
  return normalizedSearch ? `?${normalizedSearch}` : ''
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
    const normalizedSearch = buildNormalizedSearch(query)
    if (normalizedSearch === search) return

    window.history.replaceState({}, '', `${window.location.pathname}${normalizedSearch}`)
    setSearch(normalizedSearch)
  }, [query, search])

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
    } catch {
      if (!isMounted) return

      setError('Không thể tải danh sách sản phẩm. Vui lòng thử lại.')
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
        <CatalogHero categories={categories} query={query} />

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
          {!error && productList && productList.items.length > 0 ? (
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
            !error && !isLoading && <Empty className="catalog-empty" description="Chưa có sản phẩm phù hợp." />
          )}
        </Spin>
      </main>
    </MainLayout>
  )
}
