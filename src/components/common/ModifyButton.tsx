import React from 'react'
import { Edit3, LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface ModifyButtonProps {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  label?: string
  icon?: LucideIcon
  className?: string
  size?: 'sm' | 'md'
  disabled?: boolean
  title?: string
}

export default function ModifyButton({
  onClick,
  label = 'Modify',
  icon: Icon = Edit3,
  className,
  size = 'md',
  disabled = false,
  title = 'Modify this record',
}: ModifyButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-all duration-150 select-none cursor-pointer',
        'text-amber-800 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500/25',
        'border border-amber-500/30 hover:border-amber-500/50 shadow-2xs hover:shadow-xs active:scale-[0.98]',
        disabled && 'opacity-50 pointer-events-none cursor-not-allowed',
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-xs sm:text-sm',
        className
      )}
      title={title}
    >
      <Icon size={size === 'sm' ? 13 : 14} className="shrink-0 text-amber-600 dark:text-amber-400" />
      <span>{label}</span>
    </button>
  )
}
