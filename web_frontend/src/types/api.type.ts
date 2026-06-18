export type ApiResponse<T> = {
  message?: string
  data?: T
}

export type PaginatedResponse<T> = {
  items: T[]
  totalItems: number
  page: number
  limit: number
  totalPages: number
}
