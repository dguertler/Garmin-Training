import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import NavBar from '@/components/NavBar'

export default async function NutritionLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  return (
    <div className="min-h-screen">
      <NavBar userName={session.user?.name ?? undefined} />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 sm:pb-8">{children}</main>
    </div>
  )
}
