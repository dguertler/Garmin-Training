'use client'
import { useEffect, useState, useCallback } from 'react'

interface MealTemplate {
  id: string
  name: string
  meal_type: string
  meal_slot: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  ingredients: unknown
  prep_notes: string | null
  user_id: string | null
}

const SLOT_LABELS: Record<string, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  pre_workout: 'Pre-Workout',
  dinner: 'Abendessen',
  pre_sleep: 'Pre-Sleep',
}

const SLOT_ORDER = ['breakfast', 'lunch', 'pre_workout', 'dinner', 'pre_sleep']

export default function MealTemplateLibrary() {
  const [templates, setTemplates] = useState<MealTemplate[]>([])
  const [filter, setFilter] = useState<'all' | 'training' | 'rest'>('all')
  const [adding, setAdding] = useState(false)
  const [newTemplate, setNewTemplate] = useState({
    name: '', meal_type: 'training', meal_slot: 'breakfast',
    calories: '', protein_g: '', carbs_g: '', fat_g: '', prep_notes: '',
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const url = filter === 'all' ? '/api/meals/templates' : `/api/meals/templates?type=${filter}`
    const res = await fetch(url)
    const d = await res.json()
    setTemplates(d.templates ?? [])
  }, [filter])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!newTemplate.name || !newTemplate.calories) return
    setSaving(true)
    await fetch('/api/meals/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newTemplate,
        calories: Number(newTemplate.calories),
        protein_g: Number(newTemplate.protein_g) || 0,
        carbs_g: Number(newTemplate.carbs_g) || 0,
        fat_g: Number(newTemplate.fat_g) || 0,
      }),
    })
    setSaving(false)
    setAdding(false)
    setNewTemplate({ name: '', meal_type: 'training', meal_slot: 'breakfast', calories: '', protein_g: '', carbs_g: '', fat_g: '', prep_notes: '' })
    load()
  }

  async function handleDelete(id: string) {
    await fetch(`/api/meals/templates?id=${id}`, { method: 'DELETE' })
    load()
  }

  const grouped = SLOT_ORDER.reduce<Record<string, MealTemplate[]>>((acc, slot) => {
    acc[slot] = templates.filter(t => t.meal_slot === slot)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex items-center gap-2">
        {(['all', 'training', 'rest'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${filter === f ? 'bg-prime/20 text-prime' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {f === 'all' ? 'Alle' : f === 'training' ? 'Trainingstag' : 'Ruhetag'}
          </button>
        ))}
        <button
          onClick={() => setAdding(a => !a)}
          className="ml-auto btn-primary text-xs px-3 py-1.5"
        >
          + Template
        </button>
      </div>

      {/* Neues Template */}
      {adding && (
        <div className="card space-y-3">
          <h3 className="font-semibold text-slate-200 text-sm">Neues Template</h3>
          <div className="grid grid-cols-2 gap-2">
            <input className="input-field col-span-2" placeholder="Name" value={newTemplate.name} onChange={e => setNewTemplate(p => ({ ...p, name: e.target.value }))} />
            <select className="input-field" value={newTemplate.meal_type} onChange={e => setNewTemplate(p => ({ ...p, meal_type: e.target.value }))}>
              <option value="training">Trainingstag</option>
              <option value="rest">Ruhetag</option>
            </select>
            <select className="input-field" value={newTemplate.meal_slot} onChange={e => setNewTemplate(p => ({ ...p, meal_slot: e.target.value }))}>
              {SLOT_ORDER.map(s => <option key={s} value={s}>{SLOT_LABELS[s]}</option>)}
            </select>
            <input className="input-field" type="number" placeholder="kcal" value={newTemplate.calories} onChange={e => setNewTemplate(p => ({ ...p, calories: e.target.value }))} />
            <input className="input-field" type="number" placeholder="Protein (g)" value={newTemplate.protein_g} onChange={e => setNewTemplate(p => ({ ...p, protein_g: e.target.value }))} />
            <input className="input-field" type="number" placeholder="Kohlenhydrate (g)" value={newTemplate.carbs_g} onChange={e => setNewTemplate(p => ({ ...p, carbs_g: e.target.value }))} />
            <input className="input-field" type="number" placeholder="Fett (g)" value={newTemplate.fat_g} onChange={e => setNewTemplate(p => ({ ...p, fat_g: e.target.value }))} />
            <input className="input-field col-span-2" placeholder="Zubereitung (optional)" value={newTemplate.prep_notes} onChange={e => setNewTemplate(p => ({ ...p, prep_notes: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm flex-1">
              {saving ? 'Speichern…' : 'Speichern'}
            </button>
            <button onClick={() => setAdding(false)} className="btn-ghost text-sm">Abbrechen</button>
          </div>
        </div>
      )}

      {/* Templates nach Slot */}
      {SLOT_ORDER.map(slot => {
        const items = grouped[slot]
        if (!items.length) return null
        return (
          <div key={slot} className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-300">{SLOT_LABELS[slot]}</h3>
            <div className="space-y-2">
              {items.map(t => (
                <div key={t.id} className="card-sm flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-200 text-sm">{t.name}</span>
                      <span className={`badge ${t.meal_type === 'training' ? 'badge-prime' : 'badge-moderate'} text-xs`}>
                        {t.meal_type === 'training' ? 'Training' : 'Ruhe'}
                      </span>
                    </div>
                    <div className="flex gap-3 text-xs text-slate-400 mt-1">
                      <span>{t.calories} kcal</span>
                      <span>{t.protein_g}g P</span>
                      <span>{t.carbs_g}g KH</span>
                      <span>{t.fat_g}g F</span>
                    </div>
                    {t.prep_notes && <p className="text-xs text-slate-500 mt-1">{t.prep_notes}</p>}
                  </div>
                  {t.user_id && (
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="text-slate-500 hover:text-low text-xs flex-shrink-0"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {templates.length === 0 && !adding && (
        <p className="text-sm text-slate-500 text-center py-8">Keine Templates gefunden.</p>
      )}
    </div>
  )
}
