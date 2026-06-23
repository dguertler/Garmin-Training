const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

  try {
    // Check if schema already applied
    const { rows } = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
      ) AS exists
    `)

    if (!rows[0].exists) {
      console.log('[migrate] Applying schema.sql...')
      const schema = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8')
      await pool.query(schema)
      console.log('[migrate] schema.sql done')
    }

    // Always run migrations (all use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
    const migrationsDir = path.join(__dirname, '../db/migrations')
    const files = fs.readdirSync(migrationsDir).sort().filter(f => f.endsWith('.sql'))
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
      await pool.query(sql)
      console.log(`[migrate] ${file} done`)
    }

    // Create initial user if env vars set and no users exist
    const email = process.env.INITIAL_USER_EMAIL
    const password = process.env.INITIAL_USER_PASSWORD
    const name = process.env.INITIAL_USER_NAME || 'Admin'

    if (email && password) {
      const { rows: countRows } = await pool.query('SELECT COUNT(*)::int AS count FROM users')
      if (countRows[0].count === 0) {
        const bcrypt = require('bcryptjs')
        const hash = await bcrypt.hash(password, 12)
        const { rows: userRows } = await pool.query(
          'INSERT INTO users (email, name, profile_key) VALUES ($1, $2, $3) RETURNING id',
          [email.toLowerCase(), name, 'daniel']
        )
        const userId = userRows[0].id
        await pool.query(
          'INSERT INTO user_credentials (user_id, password_hash, force_password_change) VALUES ($1, $2, FALSE)',
          [userId, hash]
        )
        await pool.query(
          `INSERT INTO user_profiles (user_id, current_phase, phase_start_date, daily_steps_goal)
           VALUES ($1, 'cut', CURRENT_DATE, 8000)`,
          [userId]
        )
        console.log(`[migrate] Initial user created: ${email}`)
      }
    }

    console.log('[migrate] All done.')
  } finally {
    await pool.end()
  }
}

migrate().catch(err => {
  console.error('[migrate] FATAL:', err)
  process.exit(1)
})
