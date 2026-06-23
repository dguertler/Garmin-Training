export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { query, queryOne } = await import('@/lib/db')
  const fs = await import('fs')
  const path = await import('path')

  // Auto-migrate: run schema + all migrations if users table doesn't exist
  try {
    const tableCheck = await queryOne<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
      ) AS exists`
    )

    if (!tableCheck?.exists) {
      console.log('[instrumentation] No schema found — running full migration')
      const schemaPath = path.join(process.cwd(), 'db', 'schema.sql')
      const schemaSql = fs.readFileSync(schemaPath, 'utf8')
      await query(schemaSql)
      console.log('[instrumentation] schema.sql applied')

      const migrationsDir = path.join(process.cwd(), 'db', 'migrations')
      const files = fs.readdirSync(migrationsDir).sort()
      for (const file of files) {
        if (!file.endsWith('.sql')) continue
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
        await query(sql)
        console.log(`[instrumentation] migration applied: ${file}`)
      }
    }
  } catch (e) {
    console.error('[instrumentation] auto-migration error:', e)
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
