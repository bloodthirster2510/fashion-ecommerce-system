import { Pagination as AntPagination } from 'antd'
import type { PaginationProps as AntPaginationProps } from 'antd'

type PaginationProps = AntPaginationProps

export function Pagination(props: PaginationProps) {
  return <AntPagination {...props} />
}
