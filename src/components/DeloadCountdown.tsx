'use client'
import { useEffect, useState, useCallback } from 'react'

interface DeloadData {
  is_deload_week: boolean
  weeks_since_deload: number
  weeks_until_deload: number
  next_deload_planned: string | null
  should_trigger: boolean
  trigger_reason: string
  sustained_low_readiness: boolean
  low_readiness_days: number
}

export default function DeloadCountdown() {
  const [data, setData] = useState<DeloadData | null>(null)
  const [starting, setStarting] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/deload')
    setData(await res.json())
  }, [])

  useEffect(() => { load() }, [load])

  async function startDeload() {
    setStarting(true)
    await fetch('/api/deload', { method: 'POST' })
    setStarting(false)
    load()
  }

  if (!data) return null

  if (data.is_deload_week) {
    return (
      <div className="card border-moderate/50 bg-moderate/5 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔄</span>
          <h3 className="font-semibold text-moderate">Deload-Woche aktiv</h3>
        </div>
        <p className="text-sm text-slate-300">Volumen −40% · Intensität −20% · Frequenz wie geplant</p>
        <p className="text-xs text-slate-400">Kein Verhandeln – im Defizit ist Übertraining die häufigste Plateau-Ursache.</p>
      </div>
    )
  }

  // Trigger-Warnung: automatischer Deload empfohlen
  if (data.should_trigger) {
    return (
      <div className="card border-low/50 bg-low/5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚠️</span>
          <h3 className="font-semibold text-low">Deload empfohlen</h3>
        </div>
        <p className="text-sm text-slate-300">{data.trigger_reason}</p>
        <button onClick={startDeload} disabled={starting} className="btn-primary text-sm w-full">
          {starting ? 'Wird gestartet…' : 'Deload-Woche jetzt starten'}
        </button>
      </div>
    )
  }

  // Anhaltend niedrige Readiness (5+ Tage)
  if (data.sustained_low_readiness) {
    return (
      <div className="card border-moderate/40 bg-moderate/5 space-y-2">
        <p className="text-sm text-moderate font-semibold">
          Anhaltend niedrige Readiness ({data.low_readiness_days} Tage)
        </p>
        <p className="text-xs text-slate-400">Schlaf, Stress und Ernährung prüfen. Deload in Betracht ziehen.</p>
      </div>
    )
  }

  // Normaler Countdown
  const nextDate = data.next_deload_planned
    ? new Date(data.next_deload_planned).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })
    : null

  const urgency = data.weeks_since_deload >= 5 ? 'text-moderate' : 'text-slate-400'

  return (
    <div className="card-sm flex items-center justify-between">
      <div>
        <div className="stat-label">Nächster Deload</div>
        <div className={`font-semibold text-sm mt-0.5 ${urgency}`}>
          {data.weeks_until_deload === 0
            ? 'Diese Woche fällig'
            : `In ${data.weeks_until_deload} Woche${data.weeks_until_deload !== 1 ? 'n' : ''}`}
          {nextDate ? ` (${nextDate})` : ''}
        </div>
      </div>
      <div className="text-right">
        <div className="stat-label">Wochen seit letztem</div>
        <div className={`font-bold text-lg ${data.weeks_since_deload >= 5 ? 'text-moderate' : 'text-slate-300'}`}>
          {data.weeks_since_deload}
        </div>
      </div>
    </div>
  )
}
