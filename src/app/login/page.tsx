'use client'
import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await signIn('credentials', { email, password, redirect: false })
    if (res?.ok) {
      const session = await getSession()
      if ((session?.user as any)?.forcePasswordChange) {
        router.push('/change-password')
      } else {
        router.push('/dashboard')
      }
    } else {
      setLoading(false)
      setError('E-Mail oder Passwort falsch.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🏃</div>
          <h1 className="text-2xl font-bold text-slate-100">Garmin Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Readiness-gesteuertes Training</p>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="stat-label block mb-1.5">E-Mail</label>
            <input type="email" className="input-field w-full" placeholder="daniel@example.com"
              value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div>
            <label className="stat-label block mb-1.5">Passwort</label>
            <input type="password" className="input-field w-full" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          {error && <p className="text-low text-sm text-center">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
            {loading ? 'Anmelden…' : 'Anmelden'}
          </button>
          <div className="text-center">
            <Link href="/forgot-password" className="text-slate-400 text-sm hover:text-slate-200">
              Passwort vergessen?
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
