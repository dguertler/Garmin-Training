'use client'

interface Meal {
  mealNumber: number
  timeLabel: string
  slot: string
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  name: string
  notes?: string
}

interface Props {
  meals: Meal[] | null
  isTrainingDay: boolean
}

const SLOT_ICON: Record<string, string> = {
  breakfast: '☀️',
  lunch: '🥗',
  pre_workout: '⚡',
  dinner: '🍽️',
  pre_sleep: '🌙',
}

export default function MealPlan({ meals, isTrainingDay }: Props) {
  if (!meals?.length) {
    return (
      <div className="card">
        <h3 className="font-semibold text-slate-200 mb-3">Mahlzeitenplan</h3>
        <p className="text-slate-500 text-sm">Gewicht eingeben um Mahlzeitenplan zu berechnen.</p>
      </div>
    )
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-200">Mahlzeitenplan</h3>
        <span className="text-xs text-slate-500">{isTrainingDay ? 'Training' : 'Ruhetag'}</span>
      </div>

      <div className="space-y-2">
        {meals.map((meal) => (
          <div key={meal.mealNumber}
            className="flex items-start gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/8 transition-colors">
            <div className="text-lg shrink-0 mt-0.5">{SLOT_ICON[meal.slot] ?? '🍱'}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-200">{meal.name}</span>
                <span className="text-xs text-slate-500">{meal.timeLabel}</span>
                <span className="text-xs font-bold text-slate-300 ml-auto">{meal.kcal} kcal</span>
              </div>
              {meal.notes && (
                <p className="text-xs text-slate-500 mt-0.5 italic">{meal.notes}</p>
              )}
              <div className="flex gap-3 mt-1.5">
                <MacroTag label="P" value={meal.proteinG} color="#22c55e" />
                <MacroTag label="C" value={meal.carbsG}   color="#3b82f6" />
                <MacroTag label="F" value={meal.fatG}     color="#f59e0b" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MacroTag({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className="text-xs font-medium" style={{ color }}>
      {label} {Math.round(value)}g
    </span>
  )
}
