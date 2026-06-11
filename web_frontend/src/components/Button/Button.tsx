import { Button as AntButton } from 'antd'
import type { ButtonProps as AntButtonProps } from 'antd'

type ButtonProps = AntButtonProps

export function Button(props: ButtonProps) {
  return <AntButton {...props} />
}
