import { Input as AntInput } from 'antd'
import type { InputProps as AntInputProps } from 'antd'

type InputProps = AntInputProps

export function Input(props: InputProps) {
  return <AntInput {...props} />
}
