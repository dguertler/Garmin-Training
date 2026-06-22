import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ProgressionLadder from '@/components/ProgressionLadder'

export const metadata = { title: 'Calisthenics Progression' }

export default async function ProgressionPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/strength" className="text-slate-400 hover:text-slate-200 text-sm">← Kraft</Link>
        <h1 className="text-xl font-bold text-slate-100">Calisthenics Progressionsleiter</h1>
      </div>
      <p className="text-sm text-slate-400">
        Erfülle das Aufstiegskriterium in einer Session → Level Up wird freigeschaltet.
        Kriterium: mind. 3 Sätze, Ø Wdh ≥ 10, max RIR ≤ 1.
      </p>
      <ProgressionLadder />
    </div>
  )
}
