import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Alert, Empty, Spin } from 'antd'
import { MainLayout } from '../../../layouts/MainLayout'
import { ProductCard } from '../../../components/ProductCard'
import { Pagination } from '../../../components/Pagination'
import { CatalogHero } from '../components/CatalogHero'
import { CatalogToolbar } from '../components/CatalogToolbar'
import { VisualSearchResultHeader } from '../components/VisualSearchResultHeader'
import { catalogService } from '../catalog.service'
import {
  recordInteractionBestEffort,
  waitForInteractionBestEffort,
  type InteractionPayload,
} from '../../recommendation/interaction.service'
import type {
  CatalogCategory,
  ProductListFilters,
  ProductListQuery,
  ProductListResponse,
  ProductSortOption,
  VisualSearchResponse,
} from '../catalog.types'
import '../catalog.css'

const LIMIT = 20
const MAX_VISUAL_SEARCH_FILE_SIZE = 5 * 1024 * 1024
const VISUAL_SEARCH_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const CATALOG_VISUAL_SEARCH_FILE_EVENT = 'catalog:visual-search-file-selected'
const PRICE_RANGE_ERROR = 'Giá thấp nhất không được cao hơn giá cao nhất.'

function ProductListSkeleton() {
  return (
    <section className="product-grid product-grid-skeleton" aria-label="Đang tải danh sách sản phẩm" aria-busy="true">
      {Array.from({ length: 10 }, (_, index) => (
        <article className="product-card product-card-skeleton" key={index} aria-hidden="true">
          <div className="product-card-media" />
          <div className="product-card-body">
            <span className="product-skeleton-line is-title" />
            <span className="product-skeleton-line is-title-short" />
            <span className="product-skeleton-line is-price" />
            <div className="product-skeleton-action">
              <span />
              <span />
            </div>
          </div>
        </article>
      ))}
    </section>
  )
}

const sortOptions: Array<{ value: ProductSortOption; label: string }> = [
  { value: 'relevance', label: 'Liên quan' },
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
const getDefaultSort = (keyword?: string): ProductSortOption => (keyword ? 'relevance' : 'newest')

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

const getPriceRangeError = (minPrice?: number, maxPrice?: number) =>
  minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice
    ? PRICE_RANGE_ERROR
    : ''

const getQueryValidationError = (search: string) => {
  const params = new URLSearchParams(search)
  return getPriceRangeError(
    getNonNegativeNumberParam(params, 'minPrice'),
    getNonNegativeNumberParam(params, 'maxPrice'),
  )
}

const isAbortError = (error: unknown) => error instanceof Error && error.name === 'AbortError'

// Đọc tham số true/false từ URL cho các bộ lọc như sale hoặc hàng mới.
const getBooleanParam = (params: URLSearchParams, key: string) => {
  const value = params.get(key)
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

// Đọc filter có thể có nhiều giá trị, ví dụ màu sắc hoặc size.
const getListParam = (params: URLSearchParams, key: string) => {
  return params
    .getAll(key)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean)
}

// Chuyển query string hiện tại thành object filter để dùng trong catalog.
const parseQuery = (search: string): ProductListQuery => {
  const params = new URLSearchParams(search)
  const color = getListParam(params, 'color')
  const fitType = getListParam(params, 'fitType').filter((value) => objectIdPattern.test(value))
  const size = getListParam(params, 'size')
  const keyword = params.get('keyword')?.trim() || undefined
  const gender = params.get('gender')
  const categoryId = params.get('categoryId')
  const brandId = params.get('brandId')
  const requestedSort = params.get('sort') as ProductSortOption | null
  const requestedMinPrice = getNonNegativeNumberParam(params, 'minPrice')
  const requestedMaxPrice = getNonNegativeNumberParam(params, 'maxPrice')

  return {
    keyword,
    visualText: params.get('visualText')?.trim() || undefined,
    gender: gender === 'male' || gender === 'female' ? gender : undefined,
    categoryId: categoryId && objectIdPattern.test(categoryId) ? categoryId : undefined,
    brandId: brandId && objectIdPattern.test(brandId) ? brandId : undefined,
    ...(color.length ? { color } : {}),
    ...(fitType.length ? { fitType } : {}),
    ...(size.length ? { size } : {}),
    minPrice: requestedMinPrice,
    maxPrice: requestedMaxPrice,
    isSale: getBooleanParam(params, 'isSale'),
    isNew: getBooleanParam(params, 'isNew'),
    sort: requestedSort && validSortOptions.has(requestedSort) ? requestedSort : getDefaultSort(keyword),
    page: getPositiveIntegerParam(params, 'page') || 1,
    limit: LIMIT,
  }
}

// Ghi một tham số lên URL; nếu giá trị trống thì xóa khỏi URL.
const setOptionalParam = (params: URLSearchParams, key: string, value?: string | number | boolean) => {
  if (value === undefined || value === '' || value === false) {
    params.delete(key)
    return
  }

  params.set(key, String(value))
}

// Ghi filter nhiều giá trị lên URL, ví dụ color=red&color=blue.
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
  setOptionalParam(params, 'visualText', query.visualText)
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
  if (query.sort && query.sort !== getDefaultSort(query.keyword)) params.set('sort', query.sort)
  if (query.page && query.page > 1) params.set('page', String(query.page))

  const normalizedSearch = params.toString()
  return normalizedSearch ? `?${normalizedSearch}` : ''
}

// Trang danh mục sản phẩm, bao gồm lọc thường và tìm kiếm bằng hình ảnh.
export function ProductListPage() {
  const [search, setSearch] = useState(window.location.search)
  const query = useMemo(() => parseQuery(search), [search])
  const queryValidationError = useMemo(() => getQueryValidationError(search), [search])
  const [productList, setProductList] = useState<ProductListResponse | null>(null)
  const [filters, setFilters] = useState<ProductListFilters>()
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterDataError, setFilterDataError] = useState('')
  const [visualSearchResult, setVisualSearchResult] = useState<VisualSearchResponse | null>(null)
  const [visualSearchPreviewUrl, setVisualSearchPreviewUrl] = useState('')
  const [visualSearchImageName, setVisualSearchImageName] = useState('')
  const [visualSearchError, setVisualSearchError] = useState('')
  const [isVisualSearchLoading, setIsVisualSearchLoading] = useState(false)
  const visualSearchRequestId = useRef(0)

  useEffect(() => {
    const handlePopState = () => setSearch(window.location.search)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (queryValidationError) return

    const normalizedSearch = buildNormalizedSearch(query)
    if (normalizedSearch === search) return

    window.history.replaceState({}, '', `${window.location.pathname}${normalizedSearch}`)
    setSearch(normalizedSearch)
  }, [query, queryValidationError, search])

  useEffect(() => {
    return () => {
      if (visualSearchPreviewUrl) {
        URL.revokeObjectURL(visualSearchPreviewUrl)
      }
    }
  }, [visualSearchPreviewUrl])

  useEffect(() => {
    let isMounted = true
    const abortController = new AbortController()

    // Tải danh sách sản phẩm theo filter hiện tại; filter phụ được tải song song.
    const loadCatalog = async () => {
      if (queryValidationError) {
        setIsLoading(false)
        setProductList(null)
        setError(queryValidationError)
        setFilterDataError('')
        return
      }

      try {
        setIsLoading(true)
        setError('')
        setFilterDataError('')

        const productsPromise = catalogService.getProducts(query, false, { signal: abortController.signal })
        const filtersPromise = catalogService.getProductFilters(query, { signal: abortController.signal })
        const categoriesPromise = catalogService.getActiveCategories()
        void Promise.all([filtersPromise, categoriesPromise])
          .then(([nextFilters, activeCategories]) => {
            if (!isMounted) return
            setFilters(nextFilters)
            setCategories(activeCategories)
          })
          .catch((filterError: unknown) => {
            if (isAbortError(filterError)) return
            if (!isMounted) return
            setFilterDataError('Không thể tải bộ lọc danh mục. Vui lòng thử lại sau.')
          })

        const products = await productsPromise

        if (!isMounted) return

        setProductList(products)
      } catch (loadError: unknown) {
        if (isAbortError(loadError)) return
        if (!isMounted) return

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Không thể tải danh sách sản phẩm.'
        )
      } finally {
        if (isMounted && !abortController.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadCatalog()

    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [query, queryValidationError])

  useEffect(() => {
    const text = query.visualText?.trim()
    if (!text || queryValidationError) return

    let isMounted = true
    const requestId = visualSearchRequestId.current + 1
    visualSearchRequestId.current = requestId
    setVisualSearchPreviewUrl('')
    setVisualSearchImageName(text)
    setVisualSearchError('')
    setVisualSearchResult(null)
    setIsVisualSearchLoading(true)

    catalogService
      .searchProductsByText(text, {
        ...query,
        page: 1,
        limit: LIMIT,
      })
      .then((result) => {
        if (!isMounted || visualSearchRequestId.current !== requestId) return
        setVisualSearchResult(result)
      })
      .catch((searchError: unknown) => {
        if (!isMounted || visualSearchRequestId.current !== requestId) return
        setVisualSearchError(
          searchError instanceof Error
            ? searchError.message
            : 'Không thể tìm sản phẩm bằng mô tả.'
        )
      })
      .finally(() => {
        if (!isMounted || visualSearchRequestId.current !== requestId) return
        setIsVisualSearchLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [query, queryValidationError])

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

  // Xóa trạng thái tìm kiếm bằng ảnh/text và quay về danh sách sản phẩm thông thường.
  const resetVisualSearchState = () => {
    visualSearchRequestId.current += 1
    setVisualSearchResult(null)
    setVisualSearchPreviewUrl('')
    setVisualSearchImageName('')
    setVisualSearchError('')
    setIsVisualSearchLoading(false)
  }

  const clearVisualSearch = () => {
    resetVisualSearchState()

    if (!query.visualText) {
      return
    }

    const params = new URLSearchParams(window.location.search)
    params.delete('visualText')
    const nextSearch = params.toString()
    window.history.pushState({}, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`)
    setSearch(window.location.search)
  }

  // Kiểm tra file ảnh, gửi lên backend và nhận danh sách sản phẩm tương tự.
  const handleVisualSearch = useCallback(async (file: File) => {
    if (!VISUAL_SEARCH_MIME_TYPES.includes(file.type)) {
      visualSearchRequestId.current += 1
      setIsVisualSearchLoading(false)
      setVisualSearchResult(null)
      setVisualSearchError('Chỉ hỗ trợ ảnh JPEG, PNG hoặc WEBP.')
      return
    }

    if (file.size > MAX_VISUAL_SEARCH_FILE_SIZE) {
      visualSearchRequestId.current += 1
      setIsVisualSearchLoading(false)
      setVisualSearchResult(null)
      setVisualSearchError('Ảnh tìm kiếm không được vượt quá 5MB.')
      return
    }

    const previewUrl = URL.createObjectURL(file)
    const requestId = visualSearchRequestId.current + 1
    visualSearchRequestId.current = requestId
    setVisualSearchPreviewUrl(previewUrl)
    setVisualSearchImageName(file.name)
    setVisualSearchError('')
    setVisualSearchResult(null)
    setIsVisualSearchLoading(true)

    try {
      const result = await catalogService.searchProductsByImage(file, {
        ...query,
        page: 1,
        limit: LIMIT,
      })
      if (visualSearchRequestId.current !== requestId) return
      setVisualSearchResult(result)
    } catch (searchError: unknown) {
      if (visualSearchRequestId.current !== requestId) return
      setVisualSearchError(
        searchError instanceof Error
          ? searchError.message
          : 'Không thể tìm sản phẩm bằng hình ảnh.'
      )
    } finally {
      if (visualSearchRequestId.current === requestId) {
        setIsVisualSearchLoading(false)
      }
    }
  }, [query])

  useEffect(() => {
    const handleHeaderVisualSearchFile = (event: Event) => {
      const file = (event as CustomEvent<File>).detail

      if (file) {
        void handleVisualSearch(file)
      }
    }

    const pendingFile = (window as Window & { __pendingVisualSearchFile?: File }).__pendingVisualSearchFile
    if (pendingFile) {
      delete (window as Window & { __pendingVisualSearchFile?: File }).__pendingVisualSearchFile
      void handleVisualSearch(pendingFile)
    }

    window.addEventListener(CATALOG_VISUAL_SEARCH_FILE_EVENT, handleHeaderVisualSearchFile)
    return () => window.removeEventListener(CATALOG_VISUAL_SEARCH_FILE_EVENT, handleHeaderVisualSearchFile)
  }, [handleVisualSearch])

  // Cập nhật filter lên URL để trang có thể reload/chia sẻ mà vẫn giữ bộ lọc.
  const updateQuery = (updates: Partial<ProductListQuery>, resetPage = true) => {
    resetVisualSearchState()
    const params = new URLSearchParams(window.location.search)
    params.delete('visualText')

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

  // Hàm nhỏ giúp các control filter cập nhật đúng field trong query.
  const applyQueryValue = <K extends keyof ProductListQuery>(key: K, value: ProductListQuery[K]) => {
    updateQuery({ ...query, [key]: value })
  }

  const applyQueryValues = (updates: Partial<ProductListQuery>) => {
    updateQuery({ ...query, ...updates })
  }

  // Xóa các filter phụ nhưng vẫn giữ giới tính và cách sắp xếp nếu đang chọn.
  const clearFilters = () => {
    resetVisualSearchState()
    const params = new URLSearchParams()
    if (query.gender) params.set('gender', query.gender)
    if (query.sort && query.sort !== 'relevance' && query.sort !== 'newest') params.set('sort', query.sort)

    const nextSearch = params.toString()
    window.history.pushState({}, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`)
    setSearch(window.location.search)
  }

  const visibleSortOptions = useMemo(() => {
    const shouldShowRelevance = Boolean(query.keyword || query.sort === 'relevance')

    return shouldShowRelevance
      ? sortOptions
      : sortOptions.filter((option) => option.value !== 'relevance')
  }, [query.keyword, query.sort])
  const selectedSort = visibleSortOptions.find((option) => option.value === query.sort) ?? visibleSortOptions[0]
  const displayedProductList = visualSearchResult ?? productList
  const searchKeyword = query.keyword?.trim()
  const getProductCardClickPayload = (product: ProductListResponse['items'][number]): InteractionPayload => {
    const rank = (displayedProductList?.items.findIndex((item) => item._id === product._id) ?? -1) + 1
    const keyword = query.keyword?.trim() || new URLSearchParams(window.location.search).get('keyword')?.trim()

    if (visualSearchResult) {
      const visualProduct = visualSearchResult.items.find((item) => item._id === product._id)
      const isTextVisualSearch = visualSearchResult.query.searchType === 'text'
      return {
        productId: product._id,
        actionType: 'search_result_click',
        source: isTextVisualSearch ? 'search' : 'image_search',
        metadata: {
          surface: 'product_list',
          ...(isTextVisualSearch
            ? { keyword: visualSearchImageName, semanticSearch: true }
            : { imageName: visualSearchImageName }),
          ...(rank > 0 ? { rank } : {}),
          ...(visualProduct
            ? {
                visualScore: visualProduct.visualScore,
                finalVisualScore: visualProduct.finalVisualScore,
                matchedSource: visualProduct.matchedSource,
                matchedVariantId: visualProduct.matchedVariantId,
                matchedColorVariantId: visualProduct.matchedColorVariantId,
                matchedColor: visualProduct.matchedColor,
              }
            : {}),
        },
      }
    }

    if (keyword) {
      return {
        productId: product._id,
        actionType: 'search_result_click',
        source: 'search',
        metadata: {
          keyword,
          surface: 'product_list',
          page: displayedProductList?.pagination.page ?? query.page,
          sort: query.sort,
          ...(rank > 0 ? { rank } : {}),
        },
      }
    }

    return {
      productId: product._id,
      actionType: 'click',
      source: 'product_list',
      metadata: {
        surface: 'product_list',
        page: displayedProductList?.pagination.page ?? query.page,
        sort: query.sort,
        gender: query.gender,
        categoryId: query.categoryId,
        brandId: query.brandId,
        ...(rank > 0 ? { rank } : {}),
      },
    }
  }

  const handleProductCardClick = async (
    product: ProductListResponse['items'][number],
    href: string,
    event: MouseEvent<HTMLElement>,
  ) => {
    const payload = getProductCardClickPayload(product)

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      void recordInteractionBestEffort(payload)
      return
    }

    event.preventDefault()
    await waitForInteractionBestEffort(payload)
    window.location.assign(href)
  }

  return (
    <MainLayout>
      <main className="catalog-page">
        <CatalogHero categories={categories} query={query} />

        <CatalogToolbar
          query={query}
          filters={filters}
          fitTypeLabelById={fitTypeLabelById}
          sortOptions={visibleSortOptions}
          selectedSort={selectedSort}
          isVisualSearchLoading={isVisualSearchLoading}
          visualSearchDisabled={Boolean(queryValidationError)}
          onQueryValueChange={applyQueryValue}
          onQueryChange={applyQueryValues}
          onClearFilters={clearFilters}
          onVisualSearchFile={(file) => void handleVisualSearch(file)}
        />

        {searchKeyword && !visualSearchResult && (
          <section className="catalog-search-result-header" aria-label="Kết quả tìm kiếm">
            <h2>Kết quả tìm kiếm cho &quot;{searchKeyword}&quot;</h2>
          </section>
        )}

        {visualSearchResult && visualSearchResult.query.searchType !== 'text' && (
          <VisualSearchResultHeader
            result={visualSearchResult}
            previewUrl={visualSearchPreviewUrl}
            imageName={visualSearchImageName}
            queryText={query.visualText}
            onClear={clearVisualSearch}
          />
        )}

        {visualSearchError && <Alert className="catalog-alert" type="error" message={visualSearchError} showIcon />}
        {error && <Alert className="catalog-alert" type="error" message={error} showIcon />}
        {!error && filterDataError && <Alert className="catalog-alert" type="warning" message={filterDataError} showIcon />}

        <Spin spinning={false}>
          {!error && (isLoading || isVisualSearchLoading) ? (
            <ProductListSkeleton />
          ) : !error && displayedProductList && displayedProductList.items.length > 0 ? (
            <>
              <section className="product-grid" aria-label="Danh sách sản phẩm">
                {displayedProductList.items.map((product) => (
                  <ProductCard product={product} key={product._id} onProductClick={handleProductCardClick} />
                ))}
              </section>

              {!visualSearchResult && (
                <Pagination
                  className="catalog-pagination"
                  current={displayedProductList.pagination.page}
                  pageSize={displayedProductList.pagination.limit}
                  total={displayedProductList.pagination.totalItems}
                  showSizeChanger={false}
                  onChange={(page) => updateQuery({ ...query, page }, false)}
                />
              )}
            </>
          ) : (
            !error && !isLoading && !isVisualSearchLoading && (
              <Empty
                className="catalog-empty"
                description={
                  visualSearchResult
                    ? visualSearchResult.query.searchType === 'text'
                      ? 'Chưa tìm thấy sản phẩm phù hợp với mô tả này.'
                      : 'Chưa tìm thấy sản phẩm tương tự với ảnh này.'
                    : 'Chưa có sản phẩm phù hợp.'
                }
              />
            )
          )}
        </Spin>
      </main>
    </MainLayout>
  )
}
