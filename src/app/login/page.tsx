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

        {/* Logo */}
        <div className="flex flex-col items-center mb-10 gap-4">
          <div className="w-12 h-12 rounded-2xl bg-signal flex items-center justify-center shadow-lg shadow-signal/30">
            <span
              className="text-sm font-bold text-surface tracking-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >GT</span>
          </div>
          <div className="text-center">
            <h1
              className="text-xl font-semibold text-ink"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.01em' }}
            >
              Garmin Training
            </h1>
            <p className="text-xs text-fade mt-1 tracking-wide">Readiness-gesteuertes Training</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label htmlFor="login-email" className="stat-label block mb-1.5">E-Mail</label>
            <input
              id="login-email"
              type="email"
              className="input-field w-full"
              placeholder="name@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="stat-label block mb-1.5">Passwort</label>
            <input
              id="login-password"
              type="password"
              className="input-field w-full"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p className="text-low text-xs text-center">{error}</p>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
            {loading ? 'Anmelden…' : 'Anmelden'}
          </button>
          <div className="text-center">
            <Link href="/forgot-password" className="text-xs text-fade hover:text-ink transition-colors">
              Passwort vergessen?
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
