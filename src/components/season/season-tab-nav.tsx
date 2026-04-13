'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const tabs = [
  { label: 'Overview', segment: '' },
  { label: 'Activities', segment: '/activities' },
  { label: 'Expenses', segment: '/expenses' },
  { label: 'Payments', segment: '/payments' },
  { label: 'Insights', segment: '/insights' },
]

export function SeasonTabNav({ seasonId }: { seasonId: string }) {
  const pathname = usePathname()
  const basePath = `/seasons/${seasonId}`

  return (
    <nav className="flex gap-1 border-b">
      {tabs.map((tab) => {
        const href = `${basePath}${tab.segment}`
        const isActive =
          tab.segment === ''
            ? pathname === basePath
            : pathname.startsWith(href)

        return (
          <Link
            key={tab.segment}
            href={href}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors -mb-px',
              isActive
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
