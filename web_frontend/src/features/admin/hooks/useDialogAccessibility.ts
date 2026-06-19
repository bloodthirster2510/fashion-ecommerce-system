import { useEffect, useRef } from 'react'

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export const useDialogAccessibility = (
  isOpen: boolean,
  onClose: () => void,
  canClose = true,
) => {
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const canCloseRef = useRef(canClose)

  useEffect(() => {
    onCloseRef.current = onClose
    canCloseRef.current = canClose
  })

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const dialog = dialogRef.current
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const getFocusableElements = () => dialog
      ? Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => element.getAttribute('aria-hidden') !== 'true')
      : []
    const focusFrame = window.requestAnimationFrame(() => {
      const firstFocusable = getFocusableElements()[0]
      ;(firstFocusable ?? dialog)?.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && canCloseRef.current) {
        event.preventDefault()
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab' || !dialog) {
        return
      }

      const focusableElements = getFocusableElements()
      if (focusableElements.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const firstFocusable = focusableElements[0]
      const lastFocusable = focusableElements[focusableElements.length - 1]
      const activeElement = document.activeElement

      if (event.shiftKey && (activeElement === firstFocusable || !dialog.contains(activeElement))) {
        event.preventDefault()
        lastFocusable.focus()
      } else if (!event.shiftKey && activeElement === lastFocusable) {
        event.preventDefault()
        firstFocusable.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus()
    }
  }, [isOpen])

  return dialogRef
}
