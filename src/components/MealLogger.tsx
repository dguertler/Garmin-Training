'use client'
import { useEffect, useState, useCallback } from 'react'

interface Template {
  id: string
  name: string
  meal_slot: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

interface LogEntry {
  id: string
  meal_slot: string
  name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  notes: string | null
  template_id: string | null
}

interface Props {
  slot: string
  slotLabel: string
  date: string
  entries: LogEntry[]
  onUpdate: () => void
}

export default function MealLogger({ slot, slotLabel, date, entries, onUpdate }: Props) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [open, setOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [manual, setManual] = useState({ name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '', notes: '' })
  const [mode, setMode] = useState<'template' | 'manual'>('template')
  const [saving, setSaving] = useState(false)

  const loadTemplates = useCallback(async () => {
    const res = await fetch(`/api/meals/templates?slot=${slot}`)
    const data = await res.json()
    setTemplates(data.templates ?? [])
  }, [slot])

  useEffect(() => {
    if (open) loadTemplates()
  }, [open, loadTemplates])

  const selectedTpl = templates.find(t => t.id === selectedTemplate)

  async function handleLog() {
    setSaving(true)
    try {
      let body: Record<string, unknown>
      if (mode === 'template' && selectedTpl) {
        body = {
          template_id: selectedTpl.id,
          meal_slot: slot,
          name: selectedTpl.name,
          calories: selectedTpl.calories,
          protein_g: selectedTpl.protein_g,
          carbs_g: selectedTpl.carbs_g,
          fat_g: selectedTpl.fat_g,
          log_date: date,
        }
      } else {
        if (!manual.name || !manual.calories) return
        body = {
          meal_slot: slot,
          name: manual.name,
          calories: Number(manual.calories),
          protein_g: Number(manual.protein_g) || 0,
          carbs_g: Number(manual.carbs_g) || 0,
          fat_g: Number(manual.fat_g) || 0,
          notes: manual.notes || null,
          log_date: date,
        }
      }
      await fetch('/api/meals/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      setOpen(false)
      setSelectedTemplate('')
      setManual({ name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '', notes: '' })
      onUpdate()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/meals/log?id=${id}`, { method: 'DELETE' })
    onUpdate()
  }

  const slotCalories = entries.reduce((s, e) => s + e.calories, 0)

  return (
    <div className="space-y-2">
      {/* Slot Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-200">{slotLabel}</span>
          {slotCalories > 0 && (
            <span className="text-xs text-slate-400">{slotCalories} kcal</span>
          )}
        </div>
        <button
          onClick={() => setOpen(v => !v)}
          className="text-xs btn-ghost py-1 px-2"
        >
          + Hinzufügen
        </button>
      </div>

      {/* Logged entries */}
      {entries.length > 0 && (
        <div className="space-y-1.5">
          {entries.map(e => (
            <div key={e.id} className="flex items-center gap-2 bg-white/3 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-200 truncate">{e.name}</div>
                <div className="text-xs text-slate-400">
                  {e.calories} kcal · {Math.round(Number(e.protein_g))}P · {Math.round(Number(e.carbs_g))}C · {Math.round(Number(e.fat_g))}F
                </div>
              </div>
              <button
                onClick={() => handleDelete(e.id)}
                className="text-slate-500 hover:text-low transition-colors ml-2 shrink-0"
                aria-label="Löschen"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {open && (
        <div className="bg-white/5 rounded-xl p-4 space-y-3 border border-white/10">
          {/* Mode toggle */}
          <div className="flex gap-1 bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setMode('template')}
              className={`flex-1 text-xs py-1 rounded-md transition-colors ${mode === 'template' ? 'bg-white/10 text-slate-100' : 'text-slate-400 hover:text-slate-300'}`}
            >
              Template
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`flex-1 text-xs py-1 rounded-md transition-colors ${mode === 'manual' ? 'bg-white/10 text-slate-100' : 'text-slate-400 hover:text-slate-300'}`}
            >
              Manuell
            </button>
          </div>

          {mode === 'template' ? (
            <div className="space-y-2">
              <select
                value={selectedTemplate}
                onChange={e => setSelectedTemplate(e.target.value)}
                className="input text-sm w-full"
              >
                <option value="">Template wählen…</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.calories} kcal)
                  </option>
                ))}
              </select>
              {selectedTpl && (
                <div className="text-xs text-slate-400 flex gap-3">
                  <span>{Math.round(Number(selectedTpl.protein_g))}g Protein</span>
                  <span>{Math.round(Number(selectedTpl.carbs_g))}g Carbs</span>
                  <span>{Math.round(Number(selectedTpl.fat_g))}g Fett</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <input
                placeholder="Name"
                value={manual.name}
                onChange={e => setManual(v => ({ ...v, name: e.target.value }))}
                className="input text-sm w-full"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Kalorien"
                  type="number"
                  value={manual.calories}
                  onChange={e => setManual(v => ({ ...v, calories: e.target.value }))}
                  className="input text-sm"
                />
                <input
                  placeholder="Protein (g)"
                  type="number"
                  value={manual.protein_g}
                  onChange={e => setManual(v => ({ ...v, protein_g: e.target.value }))}
                  className="input text-sm"
                />
                <input
                  placeholder="Carbs (g)"
                  type="number"
                  value={manual.carbs_g}
                  onChange={e => setManual(v => ({ ...v, carbs_g: e.target.value }))}
                  className="input text-sm"
                />
                <input
                  placeholder="Fett (g)"
                  type="number"
                  value={manual.fat_g}
                  onChange={e => setManual(v => ({ ...v, fat_g: e.target.value }))}
                  className="input text-sm"
                />
              </div>
              <input
                placeholder="Notiz (optional)"
                value={manual.notes}
                onChange={e => setManual(v => ({ ...v, notes: e.target.value }))}
                className="input text-sm w-full"
              />
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button onClick={() => setOpen(false)} className="btn-ghost text-sm py-1.5 px-3">
              Abbrechen
            </button>
            <button
              onClick={handleLog}
              disabled={saving || (mode === 'template' ? !selectedTemplate : !manual.name || !manual.calories)}
              className="btn-primary text-sm py-1.5 px-3 disabled:opacity-50"
            >
              {saving ? 'Speichern…' : 'Loggen'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
