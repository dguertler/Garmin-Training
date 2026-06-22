/**
 * POST /api/setup – Erstmalige Benutzeranlage (nur wenn noch keine User existieren).
 * Legt user, user_credentials und user_profile an.
 */
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { query, queryOne } from '@/lib/db'

export async function POST(req: NextRequest) {
  const setupKey = req.headers.get('x-setup-key')
  if (setupKey !== process.env.SETUP_KEY) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { name, email, password, profile_key, weight_kg, body_fat_pct, garmin_username } = body

  if (!name || !email || !password || !profile_key) {
    return NextResponse.json({ error: 'name, email, password, profile_key required' }, { status: 400 })
  }

  const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email.toLowerCase()])
  if (existing) {
    return NextResponse.json({ error: 'User already exists' }, { status: 409 })
  }

  const hash = await bcrypt.hash(password, 12)

  const users = await query<{ id: string }>(
    'INSERT INTO users (email, name, profile_key) VALUES ($1, $2, $3) RETURNING id',
    [email.toLowerCase(), name, profile_key]
  )
  const userId = users[0].id

  await query(
    'INSERT INTO user_credentials (user_id, password_hash) VALUES ($1, $2)',
    [userId, hash]
  )

  await query(
    `INSERT INTO user_profiles
       (user_id, weight_kg, body_fat_pct, current_phase, phase_start_date,
        daily_steps_goal, garmin_username)
     VALUES ($1, $2, $3, 'cut', CURRENT_DATE, 8000, $4)`,
    [userId, weight_kg ?? null, body_fat_pct ?? null, garmin_username ?? null]
  )

  // Initiale Progressions-Einträge anlegen
  const movements = ['pullup', 'dip', 'push', 'leg']
  for (const m of movements) {
    const ladder = await queryOne<{ exercise_name: string }>(
      'SELECT exercise_name FROM progression_ladder WHERE movement_pattern = $1 AND skill_level = 1',
      [m]
    )
    if (ladder) {
      await query(
        `INSERT INTO calisthenics_progression
           (user_id, movement_pattern, current_skill_level, current_exercise)
         VALUES ($1, $2, 1, $3)
         ON CONFLICT (user_id, movement_pattern) DO NOTHING`,
        [userId, m, ladder.exercise_name]
      )
    }
  }

  return NextResponse.json({ ok: true, user_id: userId })
}
