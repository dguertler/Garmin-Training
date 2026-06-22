'use client'
import { useEffect, useRef } from 'react'
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler } from 'chart.js'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler)

interface TrendPoint {
  date: string
  score: number | null
  level: string
  color: string
}

interface Props {
  trend: TrendPoint[]
  baselineLow?: number | null
  baselineHigh?: number | null
  lastNight?: number | null
}

function fmt(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getDate()}.${d.getMonth() + 1}.`
}

export default function HRVChart({ trend, baselineLow, baselineHigh, lastNight }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current || !trend.length) return
    chartRef.current?.destroy()

    const labels = trend.map(t => fmt(t.date))
    const scores = trend.map(t => t.score)

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Readiness',
            data: scores,
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34,197,94,0.08)',
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: trend.map(t => t.color),
            borderWidth: 2,
            spanGaps: true,
          },
          // Baseline-Band (falls vorhanden)
          ...(baselineLow && baselineHigh ? [{
            label: 'Baseline',
            data: Array(trend.length).fill((baselineLow + baselineHigh) / 2),
            borderColor: 'rgba(148,163,184,0.3)',
            borderDash: [4, 4],
            borderWidth: 1,
            pointRadius: 0,
            fill: false,
          }] : []),
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            backgroundColor: '#1e293b',
            borderColor: '#334155',
            borderWidth: 1,
            titleColor: '#94a3b8',
            bodyColor: '#f1f5f9',
            callbacks: {
              label: ctx => ` Readiness: ${ctx.raw ?? '–'}`,
            },
          },
          legend: { display: false },
        },
        scales: {
          x: {
            grid: { color: 'rgba(51,65,85,0.5)', drawTicks: false },
            ticks: { color: '#475569', maxTicksLimit: 8, font: { size: 10 } },
          },
          y: {
            min: 0,
            max: 100,
            grid: { color: 'rgba(51,65,85,0.5)' },
            ticks: { color: '#475569', font: { size: 10 }, stepSize: 25 },
          },
        },
        // Schwellen-Annotations ohne Plugin (nur via Datasets)
      },
    })

    return () => { chartRef.current?.destroy() }
  }, [trend, baselineLow, baselineHigh])

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-200">Readiness-Verlauf (30 Tage)</h3>
        {lastNight !== null && lastNight !== undefined && (
          <span className="text-xs text-slate-400">
            Gestern Nacht: <span className="text-slate-200 font-semibold">{lastNight}</span>
          </span>
        )}
      </div>
      {/* Threshold-Legende */}
      <div className="flex gap-4 text-xs">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-prime inline-block" />Prime ≥73</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-moderate inline-block" />Moderat 34–72</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-low inline-block" />Niedrig &lt;34</span>
      </div>
      <div className="h-44">
        {trend.length ? (
          <canvas ref={canvasRef} />
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            Noch keine Verlaufsdaten
          </div>
        )}
      </div>
    </div>
  )
}
