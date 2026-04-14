'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { MenuIcon, XIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Seasons', href: '/seasons' },
  { label: 'Farms', href: '/farms' },
  { label: 'Workers', href: '/workers' },
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
        <MenuIcon />
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-zinc-950 text-zinc-100 shadow-xl">
            <div className="flex h-14 items-center justify-between px-5">
              <span className="text-lg font-bold tracking-tight">AamDaata</span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setOpen(false)}
                className="text-zinc-300 hover:bg-zinc-900"
                aria-label="Close menu"
              >
                <XIcon />
              </Button>
            </div>
            <nav className="flex-1 space-y-1 px-3 py-2">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'block rounded-md px-3 py-2 text-sm font-medium',
                      isActive
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
                    )}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
            <div className="border-t border-zinc-800 px-3 py-3">
              <Button
                variant="ghost"
                className="w-full justify-start text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                onClick={handleSignOut}
              >
                Sign out
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
