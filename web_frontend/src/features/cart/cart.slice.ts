import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { cartService } from './cart.service'
import type { Cart } from './cart.types'

type CartState = { data: Cart | null; isLoading: boolean; pendingItemIds: string[]; error: string | null }
const initialState: CartState = { data: null, isLoading: false, pendingItemIds: [], error: null }
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Không thể cập nhật giỏ hàng.'

export const fetchCart = createAsyncThunk('cart/fetch', cartService.getCart)
export const changeCartQuantity = createAsyncThunk('cart/changeQuantity', async (input: { itemId: string; quantity: number }) => {
  return cartService.updateItem(input.itemId, input.quantity)
})
export const toggleCartItem = createAsyncThunk('cart/toggleItem', async (input: { itemId: string; isSelected: boolean }) => {
  return cartService.selectItem(input.itemId, input.isSelected)
})
export const toggleAllCartItems = createAsyncThunk('cart/toggleAll', cartService.selectAll)
export const removeCartItem = createAsyncThunk('cart/removeItem', async (itemId: string) => cartService.removeItem(itemId))

const itemThunks = [changeCartQuantity, toggleCartItem, removeCartItem] as const
const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    setCart(state, action: { payload: Cart }) {
      state.data = action.payload
      state.isLoading = false
      state.error = null
    },
    clearCart(state) {
      state.data = null
      state.isLoading = false
      state.pendingItemIds = []
      state.error = null
    },
  },
  extraReducers(builder) {
    builder
      .addCase(fetchCart.pending, (state) => { state.isLoading = true; state.error = null })
      .addCase(fetchCart.fulfilled, (state, action) => { state.isLoading = false; state.data = action.payload })
      .addCase(fetchCart.rejected, (state, action) => { state.isLoading = false; state.error = messageOf(action.error) })
      .addCase(toggleAllCartItems.fulfilled, (state, action) => { state.data = action.payload })
    itemThunks.forEach((thunk) => {
      builder
        .addCase(thunk.pending, (state, action) => {
          const itemId = typeof action.meta.arg === 'string' ? action.meta.arg : action.meta.arg.itemId
          if (!state.pendingItemIds.includes(itemId)) state.pendingItemIds.push(itemId)
        })
        .addCase(thunk.fulfilled, (state, action) => {
          state.data = action.payload
          const itemId = typeof action.meta.arg === 'string' ? action.meta.arg : action.meta.arg.itemId
          state.pendingItemIds = state.pendingItemIds.filter((id) => id !== itemId)
        })
        .addCase(thunk.rejected, (state, action) => {
          const itemId = typeof action.meta.arg === 'string' ? action.meta.arg : action.meta.arg.itemId
          state.pendingItemIds = state.pendingItemIds.filter((id) => id !== itemId)
          state.error = messageOf(action.error)
        })
    })
  },
})

export const { clearCart, setCart } = cartSlice.actions
export default cartSlice.reducer
