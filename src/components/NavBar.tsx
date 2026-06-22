'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import ProfileSwitcher from '@/components/ProfileSwitcher'

const NAV = [
  { href: '/dashboard',  label: 'Dashboard', icon: '📊' },
  { href: '/strength',   label: 'Training',  icon: '💪' },
  { href: '/nutrition',  label: 'Ernährung', icon: '🥗' },
  { href: '/trends',     label: 'Trends',    icon: '📈' },
]

export default function NavBar({ userName }: { userName?: string }) {
  const path = usePathname()

  return (
    <nav className="sticky top-0 z-40 bg-surface/90 backdrop-blur border-b border-surface-border">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="text-xl">🏃</span>
          <span className="font-bold text-sm text-slate-200 hidden sm:block">Garmin Dashboard</span>
        </div>

        {/* Links */}
        <div className="flex items-center gap-1">
          {NAV.map(n => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all
                ${path.startsWith(n.href)
                  ? 'bg-white/10 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
            >
              <span>{n.icon}</span>
              <span className="hidden sm:block">{n.label}</span>
            </Link>
          ))}
        </div>

        {/* User */}
        <div className="flex items-center gap-2">
          <ProfileSwitcher />
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  )
}
