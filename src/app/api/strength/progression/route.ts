/**
 * GET  /api/strength/progression – Aktueller Fortschritt aller 4 Muster
 * POST /api/strength/progression – Level-Up für ein Bewegungsmuster
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Alle 4 Bewegungsmuster mit aktueller Stufe + Leiter-Definition
  const [progressions, ladder] = await Promise.all([
    query<{
      movement_pattern: string
      current_skill_level: number
      current_exercise: string
      progression_criteria_met: boolean
      last_assessed_date: string | null
      history: Array<{ date: string; level: number; exercise: string; reps_achieved: number }> | null
    }>(
      `SELECT movement_pattern, current_skill_level, current_exercise,
              progression_criteria_met, last_assessed_date, history
       FROM calisthenics_progression WHERE user_id = $1
       ORDER BY movement_pattern`,
      [userId]
    ),
    query<{
      movement_pattern: string
      skill_level: number
      exercise_name: string
      advancement_criteria: string
      notes: string | null
    }>(
      'SELECT movement_pattern, skill_level, exercise_name, advancement_criteria, notes FROM progression_ladder ORDER BY movement_pattern, skill_level',
      []
    ),
  ])

  // Leiter nach Bewegungsmuster gruppieren
  const ladderByPattern: Record<string, typeof ladder> = {}
  for (const step of ladder) {
    if (!ladderByPattern[step.movement_pattern]) ladderByPattern[step.movement_pattern] = []
    ladderByPattern[step.movement_pattern].push(step)
  }

  // Maximale Level je Muster
  const maxLevels: Record<string, number> = {}
  for (const [pattern, steps] of Object.entries(ladderByPattern)) {
    maxLevels[pattern] = Math.max(...steps.map(s => s.skill_level))
  }

  return NextResponse.json({
    progressions,
    ladder: ladderByPattern,
    max_levels: maxLevels,
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { movement_pattern } = await req.json()
  if (!movement_pattern) {
    return NextResponse.json({ error: 'movement_pattern erforderlich' }, { status: 400 })
  }

  const current = await queryOne<{
    current_skill_level: number
    current_exercise: string
    history: Array<{ date: string; level: number; exercise: string }> | null
  }>(
    'SELECT current_skill_level, current_exercise, history FROM calisthenics_progression WHERE user_id = $1 AND movement_pattern = $2',
    [userId, movement_pattern]
  )

  if (!current) {
    return NextResponse.json({ error: 'Progression nicht gefunden' }, { status: 404 })
  }

  const nextLevel = current.current_skill_level + 1
  const nextStep = await queryOne<{ exercise_name: string; advancement_criteria: string }>(
    'SELECT exercise_name, advancement_criteria FROM progression_ladder WHERE movement_pattern = $1 AND skill_level = $2',
    [movement_pattern, nextLevel]
  )

  if (!nextStep) {
    return NextResponse.json({ error: 'Bereits auf höchster Stufe' }, { status: 422 })
  }

  const today = new Date().toISOString().split('T')[0]
  const historyEntry = { date: today, level: nextLevel, exercise: nextStep.exercise_name }
  const newHistory = [...(current.history ?? []), historyEntry]

  await query(
    `INSERT INTO calisthenics_progression
       (user_id, movement_pattern, current_skill_level, current_exercise,
        progression_criteria_met, last_assessed_date, history)
     VALUES ($1, $2, $3, $4, FALSE, $5, $6::jsonb)
     ON CONFLICT (user_id, movement_pattern) DO UPDATE
       SET current_skill_level = $3, current_exercise = $4,
           progression_criteria_met = FALSE, last_assessed_date = $5,
           history = $6::jsonb, updated_at = NOW()`,
    [userId, movement_pattern, nextLevel, nextStep.exercise_name, today, JSON.stringify(newHistory)]
  )

  return NextResponse.json({
    ok: true,
    movement_pattern,
    new_level: nextLevel,
    new_exercise: nextStep.exercise_name,
    criteria: nextStep.advancement_criteria,
  })
}
