'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import ProfileSwitcher from '@/components/ProfileSwitcher'

const NAV = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
        <rect x="1" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
      </svg>
    ),
  },
  {
    href: '/strength',
    label: 'Training',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
        <polyline points="1,7.5 3.5,7.5 4.5,3 6.5,12 8.5,5.5 10,9.5 12,7.5 14,7.5"
          stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/nutrition',
    label: 'Ernährung',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
        <path d="M7.5 13C7.5 13 2.5 10 2.5 5.5C2.5 3.5 4.5 1.5 7.5 1.5C10.5 1.5 12.5 3.5 12.5 5.5C12.5 10 7.5 13 7.5 13Z"
          stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
        <line x1="7.5" y1="13" x2="7.5" y2="7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/trends',
    label: 'Trends',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
        <polyline points="1,11 4.5,6.5 7.5,8.5 11,3.5 14,5.5"
          stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="1" y1="13.5" x2="14" y2="13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Setup',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
        <line x1="1" y1="4" x2="14" y2="4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <circle cx="5" cy="4" r="2" fill="#070A0F" stroke="currentColor" strokeWidth="1.4"/>
        <line x1="1" y1="11" x2="14" y2="11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <circle cx="10" cy="11" r="2" fill="#070A0F" stroke="currentColor" strokeWidth="1.4"/>
      </svg>
    ),
  },
]

export default function NavBar({ userName }: { userName?: string }) {
  const path = usePathname()

  return (
    <nav className="sticky top-0 z-40 bg-surface/95 backdrop-blur-md border-b border-surface-border">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-signal flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-white tracking-tight"
              style={{ fontFamily: 'var(--font-display)' }}>GT</span>
          </div>
          <span className="text-sm font-semibold text-ink hidden sm:block"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.01em' }}>
            Training
          </span>
        </Link>

        {/* Navigation */}
        <div className="flex items-center gap-0.5">
          {NAV.map(n => {
            const active = path === n.href || (n.href !== '/dashboard' && path.startsWith(n.href))
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-150
                  ${active
                    ? 'bg-signal/12 text-signal'
                    : 'text-fade hover:text-ink hover:bg-white/5'
                  }`}
              >
                {n.icon}
                <span className="hidden sm:block">{n.label}</span>
              </Link>
            )
          })}
        </div>

        {/* User */}
        <div className="flex items-center gap-1.5 shrink-0">
          <ProfileSwitcher />
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-xs text-fade hover:text-ink transition-colors px-2 py-1.5 rounded-lg hover:bg-white/5"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  )
}
