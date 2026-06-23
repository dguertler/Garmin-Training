'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SetupPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/setup/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (data.ok) {
      router.push('/login')
    } else {
      setError(data.error ?? 'Fehler beim Erstellen')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">⚙️</div>
          <h1 className="text-2xl font-bold text-slate-100">Ersteinrichtung</h1>
          <p className="text-slate-400 text-sm mt-1">Initialen Benutzer anlegen</p>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="stat-label block mb-1.5">Name</label>
            <input type="text" className="input-field w-full" placeholder="Daniel"
              value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
          </div>
          <div>
            <label className="stat-label block mb-1.5">E-Mail</label>
            <input type="email" className="input-field w-full" placeholder="deine@email.de"
              value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} required />
          </div>
          <div>
            <label className="stat-label block mb-1.5">Temporäres Passwort</label>
            <input type="password" className="input-field w-full" placeholder="mind. 8 Zeichen – wird beim ersten Login geändert"
              value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} required minLength={8} />
          </div>
          {error && <p className="text-low text-sm text-center">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
            {loading ? 'Erstelle…' : 'Benutzer erstellen & zur Anmeldung'}
          </button>
        </form>
      </div>
    </div>
  )
}
