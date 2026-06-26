/**
 * GET /api/training-schedule  – wöchentlicher Trainingsplan (Zeiten + Typen)
 * PUT /api/training-schedule  – Plan speichern, heutige Ernährungsziele neu berechnen
 *
 * Format: { schedule: { "1": { time: "18:00", type: "strength" }, ... } }
 * Key = Wochentag nach JS getDay() (0=So … 6=Sa).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { recomputeDailyTargets, type WeeklySchedule } from '@/lib/nutritionEngine'

const VALID_TYPES = new Set([
  'strength', 'push', 'pull', 'legs', 'cardio', 'zone2', 'vo2max',
  'refeed', 'mobility', 'rest',
])

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const row = await queryOne<{ weekly_training_schedule: WeeklySchedule | null }>(
    `SELECT weekly_training_schedule FROM user_profiles WHERE user_id = $1`,
    [userId]
  )
  return NextResponse.json({ schedule: row?.weekly_training_schedule ?? null })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const input = (body?.schedule ?? {}) as Record<string, { time?: string | null; type?: string | null }>

  // Validieren & säubern
  const clean: WeeklySchedule = {}
  for (const [dow, entry] of Object.entries(input)) {
    if (!/^[0-6]$/.test(dow) || !entry) continue
    const time = typeof entry.time === 'string' && /^\d{2}:\d{2}$/.test(entry.time) ? entry.time : null
    const type = typeof entry.type === 'string' && VALID_TYPES.has(entry.type) ? entry.type : null
    if (!time && !type) continue
    clean[dow] = { time, type }
  }

  await query(
    `UPDATE user_profiles SET weekly_training_schedule = $2, updated_at = NOW() WHERE user_id = $1`,
    [userId, JSON.stringify(clean)]
  )

  // Heutige Ziele/Mahlzeiten an neue Zeiten anpassen (falls Gewicht erfasst)
  const today = new Date().toISOString().split('T')[0]
  await recomputeDailyTargets(userId, today)

  return NextResponse.json({ ok: true, schedule: clean })
}
