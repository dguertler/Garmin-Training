import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import bcrypt from 'bcryptjs'

// Protected with MIGRATE_KEY env var
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  if (!key || key !== process.env.MIGRATE_KEY) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const out: Record<string, unknown> = {}

  // 1. Check / add missing columns
  try {
    await query(`
      ALTER TABLE user_credentials
        ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS password_reset_token TEXT,
        ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ
    `)
    out.migration = 'ok'
  } catch (e) {
    out.migration = `ERROR: ${e}`
  }

  // 2. Show columns present
  try {
    const cols = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'user_credentials' ORDER BY ordinal_position`
    )
    out.columns = cols.map(r => r.column_name)
  } catch (e) {
    out.columns = `ERROR: ${e}`
  }

  // 3. User count + emails
  try {
    const users = await query<{ email: string; profile_key: string }>(
      'SELECT email, profile_key FROM users'
    )
    out.users = users
  } catch (e) {
    out.users = `ERROR: ${e}`
  }

  // 4. Create initial user if none exist
  const email = process.env.INITIAL_USER_EMAIL
  const password = process.env.INITIAL_USER_PASSWORD
  const name = process.env.INITIAL_USER_NAME ?? 'Daniel'

  out.initial_email_set = !!email
  out.initial_password_set = !!password

  if (email && password && Array.isArray(out.users) && out.users.length === 0) {
    try {
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
      out.user_created = email
    } catch (e) {
      out.user_created = `ERROR: ${e}`
    }
  } else if (Array.isArray(out.users) && out.users.length > 0) {
    out.user_created = 'skipped – user(s) already exist'
  }

  // 5. Check garmin_raw_metrics – last 3 rows
  try {
    const garminRows = await query<Record<string, unknown>>(
      `SELECT user_id, metric_date,
              training_readiness_score, hrv_last_night, hrv_status,
              sleep_score, sleep_duration_seconds,
              body_battery_morning, resting_heart_rate,
              steps_total, vo2max, training_status
       FROM garmin_raw_metrics ORDER BY metric_date DESC LIMIT 3`
    )
    out.garmin_raw_metrics = garminRows
  } catch (e) {
    out.garmin_raw_metrics = `ERROR: ${e}`
  }

  // 6. Check garmin_raw_metrics columns
  try {
    const grCols = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'garmin_raw_metrics' ORDER BY ordinal_position`
    )
    out.garmin_raw_metrics_columns = grCols.map(r => r.column_name)
  } catch (e) {
    out.garmin_raw_metrics_columns = `ERROR: ${e}`
  }

  // 7. Last 3 sync_jobs
  try {
    const jobs = await query(
      `SELECT user_id, job_type, status, started_at, finished_at,
              endpoints_total, endpoints_success, error_details
       FROM sync_jobs ORDER BY started_at DESC LIMIT 3`
    )
    out.sync_jobs = jobs
  } catch (e) {
    out.sync_jobs = `ERROR: ${e}`
  }

  // 8. garmin_tokens status
  try {
    const tokens = await query(
      `SELECT user_id, status, last_refreshed_at, error_message FROM garmin_tokens`
    )
    out.garmin_tokens = tokens
  } catch (e) {
    out.garmin_tokens = `ERROR: ${e}`
  }

  return NextResponse.json(out, { status: 200 })
}
