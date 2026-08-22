/** Shared contracts only: platform UIs retain their own interaction patterns. */
export type UserRole = 'admin' | 'manager' | 'operator'

export interface CurrentUser {
  id: string
  name: string
  email: string
  role: UserRole
}

export interface ApiResult<T> {
  data: T
  requestId?: string
}
