import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

const MIGRATIONS = [
  {
    name: '008_password_reset',
    sql: `
      ALTER TABLE user_credentials
        ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS password_reset_token TEXT,
        ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;

      CREATE INDEX IF NOT EXISTS idx_uc_reset_token
        ON user_credentials (password_reset_token)
        WHERE password_reset_token IS NOT NULL;
    `,
  },
  {
    name: '009_fix_missing_columns',
    sql: `
      ALTER TABLE garmin_activity_hr_zones
        ADD COLUMN IF NOT EXISTS time_in_zone_seconds INT;

      UPDATE garmin_activity_hr_zones
        SET time_in_zone_seconds = seconds_in_zone
        WHERE time_in_zone_seconds IS NULL AND seconds_in_zone IS NOT NULL;

      ALTER TABLE profile_goals
        ADD COLUMN IF NOT EXISTS weekly_cardio_sessions INTEGER DEFAULT 2;
    `,
  },
  {
    name: '010_daily_readiness_columns',
    sql: `
      ALTER TABLE daily_readiness
        ADD COLUMN IF NOT EXISTS hrv_status TEXT,
        ADD COLUMN IF NOT EXISTS training_status TEXT;
    `,
  },
]

export async function GET(req: NextRequest) {
  const results: { name: string; status: string; error?: string }[] = []

  for (const migration of MIGRATIONS) {
    try {
      await query(migration.sql)
      results.push({ name: migration.name, status: 'ok' })
    } catch (err: any) {
      results.push({ name: migration.name, status: 'error', error: err.message })
    }
  }

  return NextResponse.json({ ok: true, results })
}
