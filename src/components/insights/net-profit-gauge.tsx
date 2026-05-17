// No 'use client' needed — pure SVG, no hooks

import { formatPKR } from '@/lib/utils/format'

interface NetProfitGaugeProps {
  revenue: number
  expenses: number
}

export function NetProfitGauge({ revenue, expenses }: NetProfitGaugeProps) {
  const profit = revenue - expenses
  const total = revenue + expenses
  // Guard against zero-data case
  if (total <= 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div className="section-label">Net profit</div>
        <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: 'var(--heading)', marginTop: 4 }}>—</div>
      </div>
    )
  }

  const expFrac = expenses / total

  // SVG semicircle: 220×130 viewBox, centre (110,110), radius 90
  const cx = 110, cy = 110, r = 90

  function polar(angDeg: number): { x: number; y: number } {
    const a = (angDeg * Math.PI) / 180
    return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) }
  }

  // Arc sweeps from 180° (left) to 0° (right) — total 180°.
  // Expenses occupy left portion, revenue the rest.
  const start = polar(180)
  const mid = polar(180 - expFrac * 180)
  const end = polar(0)

  // largeArcFlag = 1 if arc > 180° — here each segment is ≤ 180°.
  const expLargeArc = expFrac > 0.5 ? 1 : 0
  const revLargeArc = expFrac < 0.5 ? 1 : 0

  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginTop: 8 }}>
      <svg width="220" height="130" viewBox="0 0 220 130" aria-hidden="true">
        {/* Track (full arc, muted) */}
        <path
          d={`M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${end.x} ${end.y}`}
          fill="none"
          stroke="var(--border)"
          strokeWidth="18"
          strokeLinecap="round"
        />
        {/* Expenses arc (rust) */}
        {expenses > 0 && (
          <path
            d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${expLargeArc} 1 ${mid.x} ${mid.y}`}
            fill="none"
            stroke="var(--rust)"
            strokeWidth="18"
            strokeLinecap="round"
          />
        )}
        {/* Revenue arc (mango) */}
        {revenue > 0 && (
          <path
            d={`M ${mid.x} ${mid.y} A ${r} ${r} 0 ${revLargeArc} 1 ${end.x} ${end.y}`}
            fill="none"
            stroke="var(--mango)"
            strokeWidth="18"
            strokeLinecap="round"
          />
        )}
      </svg>
      <div style={{
        position: 'absolute',
        bottom: 28,
        left: 0, right: 0,
        textAlign: 'center',
        pointerEvents: 'none',
      }}>
        <div className="section-label">Net profit</div>
        <div className="mono" style={{
          fontSize: 22, fontWeight: 600,
          color: profit >= 0 ? 'var(--leaf)' : 'var(--rust)',
          marginTop: 2,
          letterSpacing: '-0.02em',
        }}>{formatPKR(profit)}</div>
      </div>
    </div>
  )
}
