import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function GET() {
  const email = process.env.INITIAL_USER_EMAIL
  const password = process.env.INITIAL_USER_PASSWORD
  const name = process.env.INITIAL_USER_NAME ?? 'Admin'

  if (!email || !password) {
    return NextResponse.json(
      { error: 'INITIAL_USER_EMAIL and INITIAL_USER_PASSWORD env vars must be set' },
      { status: 400 }
    )
  }

  try {
    await query(`
      ALTER TABLE user_credentials
        ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS password_reset_token TEXT,
        ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ
    `)
  } catch (_) {}

  const count = await queryOne<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM users'
  )
  if (count && parseInt(count.count) > 0) {
    return NextResponse.json(
      { error: 'Benutzer existiert bereits – bitte einloggen', login: '/login' },
      { status: 409 }
    )
  }

  const hash = await bcrypt.hash(password, 12)

  const rows = await query<{ id: string }>(
    'INSERT INTO users (email, name, profile_key) VALUES ($1, $2, $3) RETURNING id',
    [email.toLowerCase(), name, 'daniel']
  )
  const userId = rows[0].id

  await query(
    'INSERT INTO user_credentials (user_id, password_hash, force_password_change) VALUES ($1, $2, TRUE)',
    [userId, hash]
  )

  await query(
    `INSERT INTO user_profiles (user_id, current_phase, phase_start_date, daily_steps_goal)
     VALUES ($1, 'cut', CURRENT_DATE, 8000)`,
    [userId]
  )

  return NextResponse.json({
    ok: true,
    message: `Benutzer ${email} wurde angelegt. Bitte jetzt einloggen.`,
    login: '/login'
  })
}
