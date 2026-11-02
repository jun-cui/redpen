import { Link, type LinkProps } from 'react-router'
import { buttonClassName, ButtonContent, type ButtonStyleProps } from './Button'

export interface ButtonLinkProps extends LinkProps, ButtonStyleProps {}

/** A react-router Link that looks like a Button. Use it for navigation, Button for actions. */
export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  leadingIcon,
  trailingIcon,
  fullWidth = false,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={buttonClassName({ variant, size, fullWidth, className })} {...rest}>
      <ButtonContent leadingIcon={leadingIcon} trailingIcon={trailingIcon}>
        {children}
      </ButtonContent>
    </Link>
  )
}
