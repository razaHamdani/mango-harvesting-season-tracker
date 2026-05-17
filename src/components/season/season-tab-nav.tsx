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
    <nav
      className="flex gap-1 border-b border-[color:var(--border)] px-1"
      role="tablist"
      aria-label="Season sections"
    >
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
            role="tab"
            aria-selected={isActive}
            className={cn(
              'inline-flex h-9 items-center px-3.5 -mb-px text-sm transition-colors border-b-2',
              isActive
                ? 'border-[color:var(--mango)] text-[color:var(--heading)] font-medium'
                : 'border-transparent text-[color:var(--text-muted)] hover:text-[color:var(--heading)]'
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
