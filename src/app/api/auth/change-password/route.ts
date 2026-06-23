import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { queryOne, query } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }

  const { currentPassword, newPassword } = await req.json()
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Felder erforderlich' }, { status: 400 })
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Passwort muss mindestens 8 Zeichen haben' }, { status: 400 })
  }

  const cred = await queryOne<{ password_hash: string }>(
    'SELECT password_hash FROM user_credentials WHERE user_id = $1',
    [session.user.id]
  )
  if (!cred) return NextResponse.json({ error: 'Benutzer nicht gefunden' }, { status: 404 })

  const valid = await bcrypt.compare(currentPassword, cred.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'Aktuelles Passwort falsch' }, { status: 400 })
  }

  const hash = await bcrypt.hash(newPassword, 12)
  await query(
    `UPDATE user_credentials SET password_hash = $1, force_password_change = FALSE, updated_at = NOW() WHERE user_id = $2`,
    [hash, session.user.id]
  )

  return NextResponse.json({ ok: true })
}
