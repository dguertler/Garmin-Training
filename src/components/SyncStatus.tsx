'use client'
import { useState } from 'react'

interface Props {
  status: {
    status: string
    finished_at: string | null
    endpoints_success: number | null
    endpoints_total: number | null
    error_details: Record<string, string> | null
  } | null
}

export default function SyncStatus({ status }: Props) {
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState('')

  async function triggerSync() {
    setSyncing(true)
    setMsg('')
    try {
      const res = await fetch('/api/sync/trigger', { method: 'POST' })
      const data = await res.json()
      if (res.ok) setMsg('Sync gestartet')
      else setMsg(data.error ?? 'Fehler')
    } catch {
      setMsg('Netzwerkfehler')
    } finally {
      setSyncing(false)
    }
  }

  const color = !status ? '#475569' :
    status.status === 'success' ? '#22c55e' :
    status.status === 'partial' ? '#f59e0b' :
    status.status === 'error'   ? '#ef4444' : '#3b82f6'

  const timeAgo = status?.finished_at
    ? (() => {
        const diff = Date.now() - new Date(status.finished_at).getTime()
        const h = Math.floor(diff / 3600000)
        const m = Math.floor((diff % 3600000) / 60000)
        return h > 0 ? `vor ${h}h` : `vor ${m}m`
      })()
    : null

  return (
    <div className="card-sm flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-xs">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-slate-400">
          {status?.status === 'success' ? `Sync OK ${timeAgo}` :
           status?.status === 'partial' ? `Sync ${timeAgo} (${status.endpoints_success}/${status.endpoints_total})` :
           status?.status === 'error'   ? `Sync-Fehler ${timeAgo}` :
           status?.status === 'running' ? 'Sync läuft…' : 'Noch kein Sync'}
        </span>
        {status?.error_details && (
          <span className="text-low">{Object.values(status.error_details).length} Fehler</span>
        )}
        {msg && <span className="text-slate-300">{msg}</span>}
      </div>
      <button
        onClick={triggerSync}
        disabled={syncing}
        className="text-xs text-slate-400 hover:text-slate-100 disabled:opacity-50 transition-colors shrink-0"
      >
        {syncing ? '⟳ Sync…' : '⟳ Jetzt'}
      </button>
    </div>
  )
}
