'use client'
import { useEffect, useState, useCallback } from 'react'

interface LadderStep {
  movement_pattern: string
  skill_level: number
  exercise_name: string
  advancement_criteria: string
  notes: string | null
}

interface ProgressionEntry {
  movement_pattern: string
  current_skill_level: number
  current_exercise: string
  progression_criteria_met: boolean
  last_assessed_date: string | null
  history: Array<{ date: string; level: number; exercise: string }> | null
}

interface ProgressionData {
  progressions: ProgressionEntry[]
  ladder: Record<string, LadderStep[]>
  max_levels: Record<string, number>
}

const PATTERN_LABELS: Record<string, string> = {
  pullup: 'Klimmzug',
  dip: 'Dip',
  push: 'Push',
  leg: 'Bein',
}

const PATTERN_ICONS: Record<string, string> = {
  pullup: '🏋️',
  dip: '💪',
  push: '🤸',
  leg: '🦵',
}

function PatternCard({
  pattern,
  progression,
  steps,
  maxLevel,
  onLevelUp,
}: {
  pattern: string
  progression: ProgressionEntry | undefined
  steps: LadderStep[]
  maxLevel: number
  onLevelUp: (p: string) => void
}) {
  const currentLevel = progression?.current_skill_level ?? 0
  const criteraMet = progression?.progression_criteria_met ?? false
  const atMax = currentLevel >= maxLevel

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{PATTERN_ICONS[pattern]}</span>
          <div>
            <h3 className="font-semibold text-slate-200">{PATTERN_LABELS[pattern] ?? pattern}</h3>
            <p className="text-xs text-slate-400">
              Stufe {currentLevel}/{maxLevel}
              {atMax ? ' · Meister' : ''}
            </p>
          </div>
        </div>
        {criteraMet && !atMax && (
          <button
            onClick={() => onLevelUp(pattern)}
            className="btn-primary text-xs px-3 py-1.5"
          >
            Level Up ↑
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-prime rounded-full transition-all"
          style={{ width: `${(currentLevel / maxLevel) * 100}%` }}
        />
      </div>

      {/* Leiter */}
      <div className="space-y-1.5">
        {steps.map(step => {
          const isDone = step.skill_level < currentLevel
          const isCurrent = step.skill_level === currentLevel
          const isCriteriaMet = isCurrent && criteraMet
          return (
            <div
              key={step.skill_level}
              className={`flex items-start gap-2.5 p-2 rounded-lg text-sm transition-colors
                ${isCurrent ? 'bg-prime/10 border border-prime/30' : ''}
                ${isDone ? 'opacity-40' : ''}
                ${!isCurrent && !isDone ? 'opacity-60' : ''}
              `}
            >
              <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                ${isDone ? 'bg-prime/20 text-prime' : isCurrent ? 'bg-prime text-black' : 'bg-white/10 text-slate-400'}
              `}>
                {isDone ? '✓' : step.skill_level}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`font-medium ${isCurrent ? 'text-slate-100' : 'text-slate-300'}`}>
                  {step.exercise_name}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{step.advancement_criteria}</div>
                {isCriteriaMet && (
                  <div className="text-xs text-prime mt-1 font-medium">Kriterium erfüllt – bereit für Level Up!</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ProgressionLadder() {
  const [data, setData] = useState<ProgressionData | null>(null)
  const [levelingUp, setLevelingUp] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/strength/progression')
    setData(await res.json())
  }, [])

  useEffect(() => { load() }, [load])

  async function handleLevelUp(pattern: string) {
    setLevelingUp(pattern)
    await fetch('/api/strength/progression', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movement_pattern: pattern }),
    })
    setLevelingUp(null)
    load()
  }

  if (!data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="card animate-pulse h-48" />
        ))}
      </div>
    )
  }

  const patterns = ['pullup', 'dip', 'push', 'leg']

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {patterns.map(pattern => (
        <PatternCard
          key={pattern}
          pattern={pattern}
          progression={data.progressions.find(p => p.movement_pattern === pattern)}
          steps={data.ladder[pattern] ?? []}
          maxLevel={data.max_levels[pattern] ?? 7}
          onLevelUp={p => !levelingUp && handleLevelUp(p)}
        />
      ))}
    </div>
  )
}
