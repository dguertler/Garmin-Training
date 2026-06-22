import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import TrendsClient from './TrendsClient'

export const metadata = { title: 'Langzeit-Trends' }

export default async function TrendsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  return <TrendsClient />
}
