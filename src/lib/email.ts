import nodemailer from 'nodemailer'

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'mail.gmx.net',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to,
    subject: 'Passwort zurücksetzen – Garmin Dashboard',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>Passwort zurücksetzen</h2>
        <p>Klicke auf den folgenden Link (gültig 1 Stunde):</p>
        <p><a href="${resetUrl}" style="color:#22c55e">${resetUrl}</a></p>
        <p style="color:#888;font-size:12px">Falls du diese Anfrage nicht gestellt hast, ignoriere diese E-Mail.</p>
      </div>
    `,
  })
}
