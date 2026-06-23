'use client'
import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function ChangePasswordPage() {
  const { data: session, status } = useSession({ required: true })
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isForced = (session?.user as any)?.forcePasswordChange

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirm) { setError('Passwörter stimmen nicht überein'); return }
    if (newPassword.length < 8) { setError('Mindestens 8 Zeichen erforderlich'); return }
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.ok) {
      await signOut({ redirect: false })
      router.push('/login')
    } else {
      setError(data.error ?? 'Fehler')
    }
  }

  if (status === 'loading') return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-slate-400">Lädt…</p>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-100">
            {isForced ? 'Bitte Passwort ändern' : 'Passwort ändern'}
          </h1>
          {isForced && <p className="text-slate-400 text-sm mt-2">Bitte vergib beim ersten Login ein persönliches Passwort.</p>}
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="stat-label block mb-1.5">Aktuelles Passwort</label>
            <input type="password" className="input-field w-full" placeholder="••••••••"
              value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
          </div>
          <div>
            <label className="stat-label block mb-1.5">Neues Passwort</label>
            <input type="password" className="input-field w-full" placeholder="mind. 8 Zeichen"
              value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} />
          </div>
          <div>
            <label className="stat-label block mb-1.5">Passwort bestätigen</label>
            <input type="password" className="input-field w-full" placeholder="••••••••"
              value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} />
          </div>
          {error && <p className="text-low text-sm text-center">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
            {loading ? 'Speichere…' : 'Passwort ändern'}
          </button>
        </form>
      </div>
    </div>
  )
}
