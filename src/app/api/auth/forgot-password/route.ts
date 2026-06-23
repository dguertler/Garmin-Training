import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { queryOne, query } from '@/lib/db'
import { sendPasswordResetEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'E-Mail erforderlich' }, { status: 400 })

  const user = await queryOne<{ id: string; email: string }>(
    'SELECT id, email FROM users WHERE email = $1',
    [email.toLowerCase()]
  )

  if (!user) return NextResponse.json({ ok: true })

  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 60 * 60 * 1000)

  await query(
    `UPDATE user_credentials SET password_reset_token = $1, password_reset_expires_at = $2 WHERE user_id = $3`,
    [token, expires.toISOString(), user.id]
  )

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  await sendPasswordResetEmail(user.email, `${baseUrl}/reset-password?token=${token}`)

  return NextResponse.json({ ok: true })
}
