export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { query, queryOne } = await import('@/lib/db')

  // Run migration 008 (idempotent)
  try {
    await query(`
      ALTER TABLE user_credentials
        ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS password_reset_token TEXT,
        ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ
    `)
    await query(`
      CREATE INDEX IF NOT EXISTS idx_uc_reset_token
        ON user_credentials (password_reset_token)
        WHERE password_reset_token IS NOT NULL
    `)
  } catch (e) {
    console.error('[instrumentation] migration error:', e)
  }

  // Create initial user if env vars are set and no users exist
  const email = process.env.INITIAL_USER_EMAIL
  const password = process.env.INITIAL_USER_PASSWORD
  const name = process.env.INITIAL_USER_NAME ?? 'Admin'

  if (!email || !password) return

  try {
    const count = await queryOne<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM users'
    )
    if (!count || parseInt(count.count) > 0) return

    const bcrypt = await import('bcryptjs')
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

    console.log(`[instrumentation] initial user created: ${email}`)
  } catch (e) {
    console.error('[instrumentation] initial user error:', e)
  }
}
