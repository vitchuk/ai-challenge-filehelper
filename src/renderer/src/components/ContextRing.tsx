function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(value)
}

export function ContextRing({ current, max }: { current: number; max: number }): JSX.Element {
  const ratio = max > 0 ? Math.min(1, current / max) : 0
  const radius = 9
  const circumference = 2 * Math.PI * radius
  const color = ratio > 0.85 ? '#f87171' : ratio > 0.6 ? '#fbbf24' : '#60a5fa'
  const percent = Math.round(ratio * 100)

  return (
    <div
      className="ctx-ring"
      title={`Контекст: ${formatTokens(current)} / ${formatTokens(max)} токенов (${percent}%)`}
    >
      <svg width="26" height="26" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r={radius} fill="none" stroke="#2a2f3a" strokeWidth="3" />
        <circle
          cx="12"
          cy="12"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${circumference * ratio} ${circumference}`}
          transform="rotate(-90 12 12)"
        />
      </svg>
      <span className="ctx-ring-label">{percent}%</span>
    </div>
  )
}
