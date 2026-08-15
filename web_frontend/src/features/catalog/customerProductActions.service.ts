import { requestCustomer } from '../../services/customerHttp'
import type { Cart } from '../cart/cart.types'
import type { ProductListItem, ProductSortOption } from './catalog.types'

export type AddCartItemPayload = {
  productId: string
  variantId: string
  colorVariantId: string
  size: string
  quantity: number
  isSelected?: boolean
  recommendationRequestId?: string
}

export type FavoriteStatusResponse = {
  productId: string
  isFavorited: boolean
}

export type FavoriteSortOption = ProductSortOption | 'favorited_desc' | 'favorited_asc'

export type FavoriteProduct = ProductListItem & {
  favoritedAt: string
  isFavorited: true
}

export type FavoriteListResponse = {
  items: FavoriteProduct[]
  pagination: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
  }
}

export type FavoriteListQuery = {
  keyword?: string
  inStock?: boolean
  sort?: FavoriteSortOption
  page?: number
  limit?: number
}

type CustomerProductActionOptions = {
  authRequiredMessage?: string
}

const productAuthMessages = {
  addToCart: 'Đăng nhập để tiếp tục thêm sản phẩm vào giỏ hàng.',
  buyNow: 'Đăng nhập để tiếp tục mua sản phẩm.',
  checkFavorite: 'Đăng nhập để tiếp tục kiểm tra sản phẩm yêu thích.',
  listFavorites: 'Đăng nhập để tiếp tục xem sản phẩm yêu thích.',
  addFavorite: 'Đăng nhập để tiếp tục lưu sản phẩm yêu thích.',
  removeFavorite: 'Đăng nhập để tiếp tục bỏ sản phẩm khỏi danh sách yêu thích.',
}

const buildFavoriteQuery = (query: FavoriteListQuery) => {
  const params = new URLSearchParams()

  if (query.keyword?.trim()) params.set('keyword', query.keyword.trim())
  if (query.inStock) params.set('inStock', 'true')
  if (query.sort) params.set('sort', query.sort)
  if (query.page) params.set('page', String(query.page))
  if (query.limit) params.set('limit', String(query.limit))

  return params.toString()
}

export const customerProductActionsService = {
  addCartItem(input: AddCartItemPayload, options: CustomerProductActionOptions = {}) {
    return requestCustomer<Cart>('/cart/items', {
      method: 'POST',
      body: JSON.stringify(input),
    }, options.authRequiredMessage ?? productAuthMessages.addToCart)
  },

  getFavoriteStatus(productId: string) {
    return requestCustomer<FavoriteStatusResponse>(
      `/favorites/status?productId=${encodeURIComponent(productId)}`,
      undefined,
      productAuthMessages.checkFavorite,
    )
  },

  listFavorites(query: FavoriteListQuery = {}) {
    const queryString = buildFavoriteQuery(query)
    return requestCustomer<FavoriteListResponse>(
      `/favorites${queryString ? `?${queryString}` : ''}`,
      undefined,
      productAuthMessages.listFavorites,
    )
  },

  addFavorite(productId: string) {
    return requestCustomer<FavoriteStatusResponse>('/favorites', {
      method: 'POST',
      body: JSON.stringify({ productId }),
    }, productAuthMessages.addFavorite)
  },

  removeFavorite(productId: string) {
    return requestCustomer<FavoriteStatusResponse>(`/favorites/${encodeURIComponent(productId)}`, {
      method: 'DELETE',
    }, productAuthMessages.removeFavorite)
  },

  authMessages: productAuthMessages,
}
