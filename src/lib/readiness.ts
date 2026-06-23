export type ReadinessLevel = 'prime' | 'moderate' | 'low' | 'unknown'

export interface ReadinessFactors {
  readiness_score: number | null
  hrv_vs_baseline_pct: number | null
  sleep_score: number | null
  body_battery_morning: number | null
  recovery_time_hours: number | null
  stress_yesterday: number | null
  hrv_status: string | null
  training_status: string | null
}

export function classifyReadiness(score: number | null): ReadinessLevel {
  if (score === null) return 'unknown'
  if (score >= 73) return 'prime'
  if (score >= 34) return 'moderate'
  return 'low'
}

export function getReadinessColor(level: ReadinessLevel): string {
  switch (level) {
    case 'prime':    return '#22c55e'
    case 'moderate': return '#f59e0b'
    case 'low':      return '#ef4444'
    default:         return '#64748b'
  }
}

// Intensity und Volume Modifier nach Readiness-Level
export function getTrainingModifiers(level: ReadinessLevel) {
  switch (level) {
    case 'prime':
      return { intensity: 1.0, volume: 1.0 }
    case 'moderate':
      return { intensity: 0.80, volume: 0.85 }
    case 'low':
      return { intensity: 0.0, volume: 0.0 }  // Mobility/Spaziergang
    default:
      return { intensity: 0.85, volume: 0.85 }
  }
}

export function buildRecommendationReason(factors: ReadinessFactors): string {
  const parts: string[] = []

  if (factors.hrv_vs_baseline_pct !== null && Math.abs(factors.hrv_vs_baseline_pct) >= 8) {
    const dir = factors.hrv_vs_baseline_pct < 0 ? 'unter' : 'über'
    parts.push(`HRV ${Math.abs(Math.round(factors.hrv_vs_baseline_pct))}% ${dir} Baseline`)
  }

  if (factors.body_battery_morning !== null) {
    parts.push(`Body Battery ${factors.body_battery_morning} beim Aufwachen`)
  }

  if (factors.sleep_score !== null && factors.sleep_score < 60) {
    parts.push(`Schlaf-Score ${factors.sleep_score}`)
  }

  if (factors.recovery_time_hours !== null && factors.recovery_time_hours > 24) {
    parts.push(`noch ${factors.recovery_time_hours}h Recovery-Zeit`)
  }

  if (parts.length === 0) return 'Alle Faktoren im Normalbereich.'
  return parts.join(', ') + '.'
}

// Wochenskelett-Zuordnung: Wochentag → Workout-Typ
const WEEKLY_SKELETON: Record<string, string> = {
  monday:    'push',
  tuesday:   'zone2_run',
  wednesday: 'pull',
  thursday:  'mobility',
  friday:    'legs',
  saturday:  'zone2_run',
  sunday:    'rest',
}

// Baseline-Building-Wochenskelett: Zone-2-Fokus, keine schweren Kraft-Sessions
const BASELINE_SKELETON: Record<string, string> = {
  monday:    'zone2_run',
  tuesday:   'mobility',
  wednesday: 'zone2_run',
  thursday:  'mobility',
  friday:    'zone2_run',
  saturday:  'mobility',
  sunday:    'rest',
}

export function getScheduledWorkout(date: Date, phase?: string): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const day = days[date.getDay()]
  if (phase === 'baseline_building') {
    return BASELINE_SKELETON[day] ?? 'rest'
  }
  return WEEKLY_SKELETON[day] ?? 'rest'
}

// Workout-Vorschlag nach Readiness + Wochenskelett
export function getRecommendedWorkout(
  scheduled: string,
  level: ReadinessLevel,
  sleepHours: number | null,
  phase?: string
): { workout: string; reason: string } {
  const isBaseline = phase === 'baseline_building'

  // Baseline Building: Zone-2-Fokus, immer niedriger Intensität
  if (isBaseline) {
    if (scheduled === 'rest') {
      return { workout: 'rest', reason: 'Baseline Building: Ruhetag – aktive Erholung empfohlen.' }
    }
    if (level === 'low') {
      return { workout: 'mobility', reason: 'Baseline Building: Niedrige Readiness – Mobility statt Zone 2.' }
    }
    return {
      workout: 'zone2_run',
      reason: 'Baseline Building: Zone-2-Fokus zum Aufbau aerober Basis. Kein Kraft-Training in dieser Phase.',
    }
  }

  // Unter 6h Schlaf: immer Intensität reduzieren
  const forcedModerate = sleepHours !== null && sleepHours < 6

  if (level === 'low') {
    return {
      workout: scheduled === 'rest' ? 'rest' : 'mobility',
      reason: 'Niedrige Readiness – kein produktives Training möglich. Mobilität oder Spaziergang.',
    }
  }

  if (level === 'moderate' || forcedModerate) {
    if (scheduled === 'zone2_run') {
      return { workout: 'zone2_run', reason: 'Zone 2 wie geplant – passt gut zur moderaten Readiness.' }
    }
    return {
      workout: `${scheduled}_reduced`,
      reason: `Moderate Readiness${forcedModerate ? ' + <6h Schlaf' : ''}: Intensität −20%, Zone-2-Anteil erhöhen.`,
    }
  }

  // Prime
  return {
    workout: scheduled,
    reason: 'Alle Faktoren im grünen Bereich – Plan wie vorgesehen, volles Volumen.',
  }
}

// HR-Zonen aus LTHR berechnen (Matt Fitzgerald / Friel)
export function calculateHRZonesFromLTHR(lthr: number) {
  return {
    zone1: { low: Math.round(lthr * 0.60), high: Math.round(lthr * 0.72) },
    zone2: { low: Math.round(lthr * 0.72), high: Math.round(lthr * 0.82) },
    zone3: { low: Math.round(lthr * 0.82), high: Math.round(lthr * 0.89) },
    zone4: { low: Math.round(lthr * 0.89), high: Math.round(lthr * 0.97) },
    zone5: { low: Math.round(lthr * 0.97), high: Math.round(lthr * 1.05) },
  }
}

// Deload prüfen: 3+ aufeinanderfolgende Tage Score <50
// Baseline Building-Phase: kein Deload-Trigger (noch kein Trainingsvolumen aufgebaut)
export function shouldTriggerDeload(
  recentScores: (number | null)[],
  weeksSinceLastDeload: number,
  phase?: string
): { trigger: boolean; reason: string } {
  if (phase === 'baseline_building') {
    return { trigger: false, reason: '' }
  }
  const lowDays = recentScores.slice(0, 3).filter(s => s !== null && s < 50).length
  if (lowDays >= 3) {
    return {
      trigger: true,
      reason: '3 aufeinanderfolgende Tage mit Readiness <50 – Deload-Woche einleiten.',
    }
  }
  if (weeksSinceLastDeload >= 6) {
    return {
      trigger: true,
      reason: `${weeksSinceLastDeload} Wochen seit letztem Deload – planmäßige Entlastungswoche.`,
    }
  }
  return { trigger: false, reason: '' }
}

// Concurrent-Training-Konflikt: Zone2 + Kraft am selben oder aufeinanderfolgenden Tag
const STRENGTH_TYPES = new Set(['push', 'pull', 'legs', 'push_reduced', 'pull_reduced', 'legs_reduced'])
const CARDIO_TYPES = new Set(['zone2_run', 'zone2_run_reduced'])

export function checkConcurrentTraining(
  weekPlan: Array<{ plan_date: string; recommended_workout_type: string }>
): { warning: boolean; reason: string } {
  for (let i = 0; i < weekPlan.length - 1; i++) {
    const a = weekPlan[i].recommended_workout_type
    const b = weekPlan[i + 1].recommended_workout_type
    const sameDay = weekPlan[i].plan_date === weekPlan[i + 1].plan_date
    const consecutive = !sameDay

    if ((STRENGTH_TYPES.has(a) && CARDIO_TYPES.has(b)) ||
        (CARDIO_TYPES.has(a) && STRENGTH_TYPES.has(b))) {
      const dates = sameDay
        ? `am ${new Date(weekPlan[i].plan_date).toLocaleDateString('de-DE', { weekday: 'long' })}`
        : `${new Date(weekPlan[i].plan_date).toLocaleDateString('de-DE', { weekday: 'short' })} + ${new Date(weekPlan[i + 1].plan_date).toLocaleDateString('de-DE', { weekday: 'short' })}`
      if (sameDay || consecutive) {
        return {
          warning: true,
          reason: `Concurrent Training erkannt (${dates}): Zone-2 und Kraft innerhalb 24h beeinträchtigen AMPK/mTOR-Balance. Zone-2 am Ruhetag empfohlen.`,
        }
      }
    }
  }
  return { warning: false, reason: '' }
}
