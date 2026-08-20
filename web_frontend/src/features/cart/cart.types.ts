export type CartItem = {
  _id: string
  productId: string
  variantId: string
  colorVariantId: string
  size: string
  sku: string
  quantity: number
  priceAtAddedTime: number
  lineTotal: number
  isSelected: boolean
  name?: string
  brand?: { _id: string; name: string; image?: string }
  color?: string
  colorCode?: string
  image?: string
  originalPrice: number
  discount: number
  availableQuantity: number
  isAvailable: boolean
}

export type Cart = {
  _id?: string
  user_id?: string
  product_list: CartItem[]
  summary: { itemCount: number; selectedItemCount: number; subTotal: number }
}

export type PaymentMethod = 'COD' | 'VNPAY'

export type CheckoutSummary = {
  subTotal: number
  shippingFee: number
  couponDiscountAmount: number
  shippingDiscountAmount: number
  membershipDiscountAmount: number
  taxAmount: number
  totalAmount: number
}

export type CheckoutPreview = {
  quoteVersion: string
  summary: CheckoutSummary
  shippingQuote?: {
    provider: 'GHN' | 'FIXED' | 'GHTK'
    status: 'quoted' | 'fallback'
  } | null
  coupon: null | { code: string; name: string; description?: string; discountAmount: number }
  appliedMembership: null | { name: string; discountPercent: number; discountAmount: number }
}

export type CreateOrderResponse = {
  _id: string
  orderCode: string
  totalAmount: number
  paymentMethod: PaymentMethod
}

