import { requestCustomer } from '../../services/customerHttp'

export type AddCartItemPayload = {
  productId: string
  variantId: string
  colorVariantId: string
  size: string
  quantity: number
}

export type FavoriteStatusResponse = {
  productId: string
  isFavorited: boolean
}

export const customerProductActionsService = {
  addCartItem(input: AddCartItemPayload) {
    return requestCustomer<unknown>('/cart/items', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  getFavoriteStatus(productId: string) {
    return requestCustomer<FavoriteStatusResponse>(`/favorites/status?productId=${encodeURIComponent(productId)}`)
  },

  addFavorite(productId: string) {
    return requestCustomer<FavoriteStatusResponse>('/favorites', {
      method: 'POST',
      body: JSON.stringify({ productId }),
    })
  },

  removeFavorite(productId: string) {
    return requestCustomer<FavoriteStatusResponse>(`/favorites/${encodeURIComponent(productId)}`, {
      method: 'DELETE',
    })
  },
}
