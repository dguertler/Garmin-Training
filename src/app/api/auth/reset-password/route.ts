import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { queryOne, query } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { token, password } = await req.json()
  if (!token || !password) {
    return NextResponse.json({ error: 'Token und Passwort erforderlich' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Passwort muss mindestens 8 Zeichen haben' }, { status: 400 })
  }

  const cred = await queryOne<{ user_id: string }>(
    `SELECT user_id FROM user_credentials WHERE password_reset_token = $1 AND password_reset_expires_at > NOW()`,
    [token]
  )
  if (!cred) {
    return NextResponse.json({ error: 'Link ungültig oder abgelaufen' }, { status: 400 })
  }

  const hash = await bcrypt.hash(password, 12)
  await query(
    `UPDATE user_credentials SET password_hash = $1, password_reset_token = NULL, password_reset_expires_at = NULL, force_password_change = FALSE, updated_at = NOW() WHERE user_id = $2`,
    [hash, cred.user_id]
  )

  return NextResponse.json({ ok: true })
}
