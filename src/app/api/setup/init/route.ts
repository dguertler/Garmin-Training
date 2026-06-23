import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { query, queryOne } from '@/lib/db'

export async function POST(req: NextRequest) {
  const count = await queryOne<{ count: string }>('SELECT COUNT(*)::text as count FROM users')
  if (count && parseInt(count.count) > 0) {
    return NextResponse.json({ error: 'Setup bereits abgeschlossen. Bitte einloggen.' }, { status: 403 })
  }

  const { name, email, password } = await req.json()
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, E-Mail und Passwort erforderlich' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Passwort muss mindestens 8 Zeichen haben' }, { status: 400 })
  }

  const hash = await bcrypt.hash(password, 12)

  const users = await query<{ id: string }>(
    'INSERT INTO users (email, name, profile_key) VALUES ($1, $2, $3) RETURNING id',
    [email.toLowerCase(), name, 'daniel']
  )
  const userId = users[0].id

  await query(
    `INSERT INTO user_credentials (user_id, password_hash, force_password_change) VALUES ($1, $2, TRUE)`,
    [userId, hash]
  )

  await query(
    `INSERT INTO user_profiles (user_id, current_phase, phase_start_date, daily_steps_goal)
     VALUES ($1, 'cut', CURRENT_DATE, 8000)`,
    [userId]
  )

  const movements = ['pullup', 'dip', 'push', 'leg']
  for (const m of movements) {
    const ladder = await queryOne<{ exercise_name: string }>(
      'SELECT exercise_name FROM progression_ladder WHERE movement_pattern = $1 AND skill_level = 1',
      [m]
    )
    if (ladder) {
      await query(
        `INSERT INTO calisthenics_progression (user_id, movement_pattern, current_skill_level, current_exercise)
         VALUES ($1, $2, 1, $3) ON CONFLICT (user_id, movement_pattern) DO NOTHING`,
        [userId, m, ladder.exercise_name]
      )
    }
  }

  return NextResponse.json({ ok: true, user_id: userId })
}
