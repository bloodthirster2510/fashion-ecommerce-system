import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { tokenService } from '../../services/tokenService'
import type { AuthUser } from './auth.types'

type AuthState = {
  currentUser: AuthUser | null
}

const initialState: AuthState = {
  // localStorage chỉ là nguồn khôi phục sau refresh.
  // Trong lúc app chạy, Redux là nguồn state chính cho header/profile.
  currentUser: tokenService.getCurrentUser(),
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCurrentUser(state, action: PayloadAction<AuthUser>) {
      state.currentUser = action.payload
    },
    clearCurrentUser(state) {
      state.currentUser = null
    },
  },
})

export const { setCurrentUser, clearCurrentUser } = authSlice.actions
export default authSlice.reducer
