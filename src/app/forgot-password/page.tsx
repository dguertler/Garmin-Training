'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setLoading(false)
    setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-100">Passwort vergessen</h1>
          <p className="text-slate-400 text-sm mt-1">Wir senden dir einen Reset-Link</p>
        </div>
        {sent ? (
          <div className="card text-center space-y-4">
            <p className="text-high text-lg">E-Mail gesendet ✓</p>
            <p className="text-slate-400 text-sm">Falls ein Account mit dieser E-Mail existiert, erhältst du einen Reset-Link. Der Link ist 1 Stunde gültig.</p>
            <Link href="/login" className="btn-primary block">Zurück zum Login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-4">
            <div>
              <label className="stat-label block mb-1.5">E-Mail</label>
              <input type="email" className="input-field w-full" placeholder="deine@email.de"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
              {loading ? 'Sende…' : 'Reset-Link senden'}
            </button>
            <div className="text-center">
              <Link href="/login" className="text-slate-400 text-sm hover:text-slate-200">Zurück zum Login</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
