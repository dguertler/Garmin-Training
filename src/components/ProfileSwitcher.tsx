'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

/**
 * Zeigt das aktuell aktive Profil und ermöglicht den Wechsel zur
 * Read-only-Ansicht des anderen Profils via /dashboard?profile=<key>.
 *
 * Beide Nutzer haben eigene Credentials – das hier ist nur eine
 * Schnellnavigation für den "geteilten Blick".
 */
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
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-sm text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
      >
        <span className="text-base">{isWife ? '👩' : '👤'}</span>
        <span className="hidden sm:block">{name}</span>
        <span className="text-xs opacity-60">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-surface-card border border-surface-border rounded-xl shadow-xl w-48 py-1 z-50">
          <div className="px-3 py-2 text-xs text-slate-500 border-b border-white/5">Aktiv: {name}</div>

          {/* Link zur geteilten Ansicht des anderen Profils */}
          <Link
            href="/dashboard/shared"
            className="block px-3 py-2 text-sm text-slate-300 hover:bg-white/5 transition-colors"
            onClick={() => setOpen(false)}
          >
            {isWife ? '👤 Daniels Übersicht' : '👩 Frau-Übersicht'}
          </Link>

          <div className="border-t border-white/5 mt-1 pt-1">
            <Link
              href="/dashboard"
              className="block px-3 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-white/5"
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
