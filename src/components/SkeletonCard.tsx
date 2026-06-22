'use client'

interface Props {
  height?: number
  lines?: number
  className?: string
}

export function SkeletonCard({ height = 120, className = '' }: Props) {
  return (
    <div
      className={`card animate-pulse ${className}`}
      style={{ minHeight: height }}
    >
      <div className="space-y-3">
        <div className="h-3 bg-white/8 rounded w-1/3" />
        <div className="h-8 bg-white/8 rounded w-1/2" />
        <div className="h-2 bg-white/5 rounded w-full" />
        <div className="h-2 bg-white/5 rounded w-4/5" />
      </div>
    </div>
  )
}

export function SkeletonChart({ height = 160, className = '' }: { height?: number; className?: string }) {
  return (
    <div className={`card animate-pulse ${className}`}>
      <div className="space-y-3">
        <div className="flex justify-between">
          <div className="h-3 bg-white/8 rounded w-1/4" />
          <div className="h-3 bg-white/8 rounded w-1/6" />
        </div>
        <div className="bg-white/5 rounded-lg" style={{ height }} />
        <div className="flex gap-4">
          <div className="h-2 bg-white/5 rounded w-16" />
          <div className="h-2 bg-white/5 rounded w-16" />
          <div className="h-2 bg-white/5 rounded w-16" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonList({ items = 3, className = '' }: { items?: number; className?: string }) {
  return (
    <div className={`card space-y-3 animate-pulse ${className}`}>
      <div className="h-3 bg-white/8 rounded w-1/3" />
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/8 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 bg-white/8 rounded w-2/3" />
            <div className="h-2 bg-white/5 rounded w-1/2" />
          </div>
          <div className="h-4 bg-white/8 rounded w-12" />
        </div>
      ))}
    </div>
  )
}
