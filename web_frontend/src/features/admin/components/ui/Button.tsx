import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  iconOnly?: boolean
  icon?: ReactNode
}

export function Button({
  variant = 'secondary',
  iconOnly = false,
  icon,
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const classes = [
    'admin-ui-button',
    `admin-ui-button--${variant}`,
    iconOnly ? 'admin-ui-button--icon' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <button className={classes} type={type} {...props}>
      {icon}
      {iconOnly ? <span className="sr-only">{children}</span> : children}
    </button>
  )
}
