'use client'
import { useEffect, useState } from 'react'

interface PR {
  record_type: string
  value: number
  unit: string
  achieved_date: string
  delta_vs_year_ago: number | null
}

const PR_META: Record<string, { label: string; icon: string; format: (v: number) => string }> = {
  run_5k:       { label: '5K Lauf',      icon: '🏃', format: fmtTime },
  run_10k:      { label: '10K Lauf',     icon: '🏃', format: fmtTime },
  run_hm:       { label: 'Halbmarathon', icon: '🏃', format: fmtTime },
  run_marathon: { label: 'Marathon',     icon: '🏃', format: fmtTime },
  pullup_max:   { label: 'Klimmzüge',    icon: '💪', format: v => `${v} Wdh.` },
  dip_max:      { label: 'Dips',         icon: '💪', format: v => `${v} Wdh.` },
  push_max:     { label: 'Push-Ups',     icon: '💪', format: v => `${v} Wdh.` },
  squat_max:    { label: 'Squat (BW)',   icon: '🦵', format: v => `${v} Wdh.` },
}

function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function PRBoard() {
  const [records, setRecords] = useState<PR[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    record_type: 'pullup_max',
    value: '',
    unit: 'reps',
    achieved_date: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    fetch('/api/personal-records')
      .then(r => r.json())
      .then(d => { setRecords(d.records ?? []); setLoading(false) })
  }, [])

  async function handleAdd() {
    if (!form.value) return
    await fetch('/api/personal-records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, value: Number(form.value) }),
    })
    setAdding(false)
    setLoading(true)
    const d = await fetch('/api/personal-records').then(r => r.json())
    setRecords(d.records ?? [])
    setLoading(false)
  }

  // Metadaten für unbekannte record_types
  function getMeta(rt: string) {
    return PR_META[rt] ?? { label: rt, icon: '🏆', format: (v: number) => String(v) }
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-200">Persönliche Rekorde</h2>
        <button
          onClick={() => setAdding(!adding)}
          className="text-xs text-prime border border-prime/30 rounded-lg px-3 py-1 hover:bg-prime/10 transition-all"
        >
          {adding ? 'Abbrechen' : '+ PR eintragen'}
        </button>
      </div>

      {/* Neuen PR eintragen */}
      {adding && (
        <div className="bg-white/5 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Disziplin</label>
              <select
                className="input-field w-full text-sm"
                value={form.record_type}
                onChange={e => {
                  const rt = e.target.value
                  const isRun = rt.startsWith('run_')
                  setForm(f => ({ ...f, record_type: rt, unit: isRun ? 'seconds' : 'reps' }))
                }}
              >
                {Object.entries(PR_META).map(([k, m]) => (
                  <option key={k} value={k}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">
                Wert ({form.record_type.startsWith('run_') ? 'Sekunden' : 'Wiederholungen'})
              </label>
              <input
                type="number"
                className="input-field w-full text-sm"
                placeholder={form.record_type.startsWith('run_') ? 'z.B. 1500' : 'z.B. 12'}
                value={form.value}
                onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Datum</label>
            <input
              type="date"
              className="input-field w-full text-sm"
              value={form.achieved_date}
              onChange={e => setForm(f => ({ ...f, achieved_date: e.target.value }))}
            />
          </div>
          <button onClick={handleAdd} className="btn-primary w-full text-sm">PR speichern</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-10 bg-white/5 rounded-lg animate-pulse" />)}
        </div>
      ) : records.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-4">
          Noch keine PRs eingetragen.
        </div>
      ) : (
        <div className="space-y-2">
          {records.map(r => {
            const meta = getMeta(r.record_type)
            const isPositiveBetter = !r.record_type.startsWith('run_')
            const delta = r.delta_vs_year_ago
            const deltaGood = delta !== null && (isPositiveBetter ? delta > 0 : delta < 0)

            return (
              <div key={r.record_type} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                <span className="text-lg">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-200">{meta.label}</div>
                  <div className="text-xs text-slate-500">
                    {new Date(r.achieved_date).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-100">{meta.format(Number(r.value))}</div>
                  {delta !== null && (
                    <div className={`text-xs font-medium ${deltaGood ? 'text-prime' : 'text-red-400'}`}>
                      {delta > 0 && isPositiveBetter ? '+' : delta < 0 && !isPositiveBetter ? '' : ''}
                      {r.unit === 'seconds' ? fmtTime(Math.abs(delta)) : `${Math.round(delta > 0 ? delta : -delta)} Wdh.`}
                      {' '}vs. Vorjahr
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
