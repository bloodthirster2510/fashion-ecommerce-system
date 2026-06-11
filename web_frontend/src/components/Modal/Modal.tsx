import { Modal as AntModal } from 'antd'
import type { ModalProps as AntModalProps } from 'antd'

type ModalProps = AntModalProps

export function Modal(props: ModalProps) {
  return <AntModal {...props} />
}
