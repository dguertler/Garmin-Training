import type { Metadata } from 'next'
import './globals.css'
import Providers from '@/components/Providers'

export const metadata: Metadata = {
  title: 'Garmin Training Dashboard',
  description: 'Readiness-gesteuertes Training & Ernährungs-Dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
