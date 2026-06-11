import { Spin } from 'antd'
import type { SpinProps } from 'antd'

export function Loading(props: SpinProps) {
  return <Spin {...props} />
}
