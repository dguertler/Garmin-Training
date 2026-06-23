'use client'
import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwörter stimmen nicht überein'); return }
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.ok) router.push('/login')
    else setError(data.error ?? 'Fehler')
  }

  if (!token) return (
    <div className="card text-center space-y-4">
      <p className="text-low">Ungültiger Link.</p>
      <Link href="/forgot-password" className="btn-primary block">Neu anfordern</Link>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div>
        <label className="stat-label block mb-1.5">Neues Passwort</label>
        <input type="password" className="input-field w-full" placeholder="mind. 8 Zeichen"
          value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
      </div>
      <div>
        <label className="stat-label block mb-1.5">Passwort bestätigen</label>
        <input type="password" className="input-field w-full" placeholder="••••••••"
          value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} />
      </div>
      {error && <p className="text-low text-sm text-center">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
        {loading ? 'Speichere…' : 'Passwort speichern'}
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-100">Neues Passwort setzen</h1>
        </div>
        <Suspense fallback={<div className="card text-center text-slate-400">Lädt…</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
