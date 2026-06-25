'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M2 12C2 9.8 4.2 8 7 8C9.8 8 12 9.8 12 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}

export default function ProfileSwitcher() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)

  const profileKey = session?.user?.profileKey ?? 'daniel'
  const name = session?.user?.name ?? 'Profil'
  const isWife = profileKey === 'wife'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-fade hover:text-ink hover:bg-white/5 transition-all"
      >
        <UserIcon />
        <span className="hidden sm:block">{name}</span>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="opacity-50" aria-hidden>
          <path d="M1 3L4 6L7 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 bg-surface-card border border-surface-border rounded-xl shadow-2xl w-48 py-1 z-50">
          <div className="px-3 py-2 text-xs text-fade border-b border-surface-border">
            Aktiv: <span className="text-ink">{name}</span>
          </div>

          <Link
            href="/dashboard/shared"
            className="flex items-center gap-2 px-3 py-2 text-xs text-ink hover:bg-surface-lift transition-colors"
            onClick={() => setOpen(false)}
          >
            <UserIcon />
            {isWife ? 'Daniels Übersicht' : 'Frau-Übersicht'}
          </Link>

          <div className="border-t border-surface-border mt-1 pt-1">
            <Link
              href="/dashboard"
              className="block px-3 py-2 text-xs text-fade hover:text-ink hover:bg-surface-lift transition-colors"
              onClick={() => setOpen(false)}
            >
              Mein Dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
