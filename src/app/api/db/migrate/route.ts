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
]

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  if (!key || key !== process.env.MIGRATE_KEY) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

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
