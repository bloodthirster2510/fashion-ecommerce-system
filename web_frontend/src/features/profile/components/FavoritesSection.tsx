import { useEffect, useState } from 'react'
import { DeleteOutlined } from '@ant-design/icons'
import { Alert, Button, Empty, Input, Pagination, Select, Switch, message } from 'antd'
import { ProductCard } from '../../../components/ProductCard/ProductCard'
import {
  customerProductActionsService,
  type FavoriteProduct,
  type FavoriteSortOption,
} from '../../catalog/customerProductActions.service'
import '../../catalog/catalog.css'
import { AccountSectionSkeleton } from './AccountSectionSkeleton'

const PAGE_SIZE = 12

const sortOptions: Array<{ label: string; value: FavoriteSortOption }> = [
  { label: 'Yêu thích gần đây', value: 'favorited_desc' },
  { label: 'Yêu thích lâu nhất', value: 'favorited_asc' },
  { label: 'Giá thấp đến cao', value: 'price_asc' },
  { label: 'Giá cao đến thấp', value: 'price_desc' },
  { label: 'Đánh giá cao', value: 'rating_desc' },
]

export function FavoritesSection() {
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([])
  const [searchValue, setSearchValue] = useState('')
  const [keyword, setKeyword] = useState('')
  const [sort, setSort] = useState<FavoriteSortOption>('favorited_desc')
  const [inStock, setInStock] = useState(false)
  const [page, setPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [removingProductId, setRemovingProductId] = useState('')
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let isMounted = true

    setIsLoading(true)
    setError('')

    customerProductActionsService
      .listFavorites({ keyword, inStock, sort, page, limit: PAGE_SIZE })
      .then((result) => {
        if (!isMounted) return

        if (result.pagination.totalPages > 0 && page > result.pagination.totalPages) {
          setPage(result.pagination.totalPages)
          return
        }

        setFavorites(result.items)
        setTotalItems(result.pagination.totalItems)
      })
      .catch((loadError) => {
        if (!isMounted) return

        setFavorites([])
        setTotalItems(0)
        setError(loadError instanceof Error ? loadError.message : 'Không thể tải danh sách yêu thích.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [inStock, keyword, page, reloadKey, sort])

  const handleRemove = async (product: FavoriteProduct) => {
    setRemovingProductId(product._id)

    try {
      await customerProductActionsService.removeFavorite(product._id)
      message.success(`Đã bỏ “${product.name}” khỏi danh sách yêu thích.`)

      if (favorites.length === 1 && page > 1) {
        setPage((currentPage) => currentPage - 1)
      } else {
        setReloadKey((value) => value + 1)
      }
    } catch (removeError) {
      message.error(removeError instanceof Error ? removeError.message : 'Không thể bỏ sản phẩm yêu thích.')
    } finally {
      setRemovingProductId('')
    }
  }

  return (
    <section className="account-favorites" aria-labelledby="favorites-heading">
      <div className="account-section-heading account-favorites-heading">
        <div>
          <h1 id="favorites-heading">Sản phẩm yêu thích</h1>
          <p>{totalItems} sản phẩm đã lưu</p>
        </div>
      </div>

      <div className="account-favorite-controls">
        <Input.Search
          allowClear
          aria-label="Tìm trong sản phẩm yêu thích"
          placeholder="Tìm trong danh sách yêu thích"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          onSearch={(value) => {
            setKeyword(value.trim())
            setPage(1)
          }}
        />
        <Select<FavoriteSortOption>
          aria-label="Sắp xếp sản phẩm yêu thích"
          value={sort}
          options={sortOptions}
          onChange={(value) => {
            setSort(value)
            setPage(1)
          }}
        />
        <label className="account-favorite-stock-filter">
          <Switch
            aria-label="Chỉ hiển thị sản phẩm còn hàng"
            checked={inStock}
            onChange={(checked) => {
              setInStock(checked)
              setPage(1)
            }}
          />
          <span>Chỉ còn hàng</span>
        </label>
      </div>

      {error && (
        <Alert
          showIcon
          type="error"
          message={error}
          action={<Button onClick={() => setReloadKey((value) => value + 1)}>Thử lại</Button>}
        />
      )}

      {isLoading ? (
        <AccountSectionSkeleton variant="grid" />
      ) : !error && favorites.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={keyword || inStock ? 'Không có sản phẩm phù hợp.' : 'Bạn chưa có sản phẩm yêu thích.'}
          >
            <Button type="primary" href="/products">Khám phá sản phẩm</Button>
          </Empty>
        ) : (
          !error && (
            <div className="account-favorite-grid">
              {favorites.map((product) => (
                <div className="account-favorite-card" key={product._id}>
                  <ProductCard product={product} showFavoriteButton={false} />
                  <Button
                    danger
                    block
                    icon={<DeleteOutlined />}
                    loading={removingProductId === product._id}
                    disabled={Boolean(removingProductId) && removingProductId !== product._id}
                    onClick={() => void handleRemove(product)}
                  >
                    Bỏ yêu thích
                  </Button>
                </div>
              ))}
            </div>
          )
        )}

      {!error && totalItems > PAGE_SIZE && (
        <Pagination
          className="account-favorite-pagination"
          current={page}
          pageSize={PAGE_SIZE}
          total={totalItems}
          showSizeChanger={false}
          onChange={setPage}
        />
      )}
    </section>
  )
}
