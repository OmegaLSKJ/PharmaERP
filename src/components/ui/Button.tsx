import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

type Variant = 'default' | 'secondary' | 'outline' | 'success' | 'destructive' | 'ghost'
type Size = 'default' | 'sm' | 'icon'

const variants: Record<Variant, string> = {
  default: 'bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white shadow-xs border border-blue-500/50 hover:shadow-sm',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/60 shadow-2xs',
  outline: 'border border-border bg-card text-foreground hover:bg-secondary hover:text-foreground shadow-2xs',
  success: 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs border border-emerald-500/50',
  destructive: 'bg-rose-600 text-white hover:bg-rose-500 shadow-xs border border-rose-500/50',
  ghost: 'text-muted-foreground hover:bg-secondary hover:text-foreground',
}

const sizes: Record<Size, string> = {
  default: 'h-9 px-3.5 sm:px-4 py-2 text-xs sm:text-sm',
  sm: 'h-8 px-2.5 sm:px-3 py-1 text-xs',
  icon: 'h-8 w-8 p-1.5',
}

export function Button({ className, variant = 'default', size = 'default', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={cn('inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg font-semibold tracking-tight transition-all duration-150 active:scale-[0.98] select-none cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2', variants[variant], sizes[size], className)} {...props} />
}
