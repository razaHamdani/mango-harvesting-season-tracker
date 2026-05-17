'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Sprout,
  Home,
  Users,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

type NavItem = {
  label: string
  href: string
  Icon: React.ComponentType<{ size?: number }>
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', Icon: LayoutDashboard },
  { label: 'Seasons', href: '/seasons', Icon: Sprout },
  { label: 'Farms', href: '/farms', Icon: Home },
  { label: 'Workers', href: '/workers', Icon: Users },
]

export function MobileNav() {
  const [open, setOpen] = React.useState(false)
  const pathname = usePathname()
  const router = useRouter()

  React.useEffect(() => {
    setOpen(false)
  }, [pathname])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className="md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <Menu />
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute inset-y-0 left-0 flex w-64 flex-col shadow-xl"
            style={{
              background: 'var(--bark)',
              color: 'oklch(0.92 0.02 80)',
            }}
          >
            <div
              className="flex items-center justify-between"
              style={{ padding: '14px 16px 12px' }}
            >
              <span
                style={{
                  fontWeight: 600,
                  fontSize: 16,
                  letterSpacing: '-0.02em',
                  color: 'var(--cream)',
                }}
              >
                AamDaata
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="inline-flex items-center justify-center rounded-md"
                style={{
                  width: 28,
                  height: 28,
                  color: 'oklch(0.78 0.02 70)',
                }}
              >
                <X size={16} />
              </button>
            </div>
            <nav className="flex-1" style={{ padding: '6px 10px' }}>
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + '/')
                const Icon = item.Icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center transition-colors"
                    style={{
                      gap: 11,
                      padding: '9px 10px',
                      borderRadius: 8,
                      fontSize: '13.5px',
                      color: isActive ? 'var(--cream)' : 'oklch(0.78 0.02 70)',
                      background: isActive ? 'oklch(1 0 0 / 6%)' : 'transparent',
                      boxShadow: isActive
                        ? 'inset 2px 0 0 var(--mango)'
                        : 'none',
                    }}
                  >
                    <span
                      style={{
                        color: isActive
                          ? 'var(--mango)'
                          : 'oklch(0.72 0.06 75)',
                        display: 'inline-flex',
                      }}
                    >
                      <Icon size={16} />
                    </span>
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>
            <div
              style={{
                padding: '12px 14px 16px',
                borderTop: '1px solid oklch(1 0 0 / 6%)',
              }}
            >
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex w-full items-center transition-colors"
                style={{
                  gap: 11,
                  padding: '9px 10px',
                  borderRadius: 8,
                  fontSize: '13.5px',
                  color: 'oklch(0.78 0.02 70)',
                  background: 'transparent',
                }}
              >
                <LogOut size={16} />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
