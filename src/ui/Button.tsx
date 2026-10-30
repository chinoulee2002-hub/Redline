import type { ComponentChildren, JSX } from 'preact';
import { Icon, type IconName } from './Icon';

type ButtonProps = Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'icon'> & {
  variant?: 'default' | 'primary' | 'ghost';
  size?: 'md' | 'sm';
  icon?: IconName;
  /** Icon-only button: `label` becomes the accessible name and tooltip. */
  iconOnly?: boolean;
  label?: string;
  children?: ComponentChildren;
};

export function Button({ variant = 'default', size = 'md', icon, iconOnly, label, children, class: cls, ...rest }: ButtonProps) {
  const classes = ['btn', `btn--${variant}`, size === 'sm' && 'btn--sm', iconOnly && 'btn--icon', cls]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" class={classes} aria-label={iconOnly ? label : undefined} title={iconOnly ? label : undefined} {...rest}>
      {icon && <Icon name={icon} />}
      {!iconOnly && (children ?? label)}
    </button>
  );
}
