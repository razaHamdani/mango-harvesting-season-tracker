import * as React from 'react'
import { cn } from '@/lib/utils'

type EmptyStateProps = {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      {icon && (
        <div style={{width:56,height:56,borderRadius:999,background:'var(--clay-soft)',display:'grid',placeItems:'center',color:'var(--bark)',marginBottom:16}}
          className="[&_svg]:h-6 [&_svg]:w-6">
          {icon}
        </div>
      )}
      <h3 style={{fontWeight:600,color:'var(--heading)',fontSize:15}}>{title}</h3>
      {description && (
        <p className="mt-1 max-w-md muted" style={{fontSize:13}}>{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
