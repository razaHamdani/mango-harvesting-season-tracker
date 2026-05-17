'use client'

import { formatPKR } from '@/lib/utils/format'

const categoryColors: Record<string, string> = {
  spray: 'var(--mango)',
  fertilizer: 'var(--leaf)',
  electricity: 'var(--sky)',
  labor: 'var(--soil)',
  misc: 'var(--rust)',
}

export function ExpenseBreakdownChart({
  expensesByCategory,
}: {
  expensesByCategory: Record<string, number>
}) {
  const sorted = Object.entries(expensesByCategory)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
  const maxVal = sorted[0]?.[1] ?? 1
  const total = sorted.reduce((s, [, v]) => s + v, 0)

  return (
    <div className="card card__pad">
      <div className="card__title">Expense breakdown</div>
      <div className="card__sub mb-6">Landlord share, by category</div>
      {sorted.length === 0 ? (
        <p className="muted text-sm">No expenses recorded yet.</p>
      ) : (
        <>
          {sorted.map(([cat, val]) => (
            <div key={cat} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: categoryColors[cat] ?? 'var(--clay)',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 13, color: 'var(--heading)' }}>
                  {cat[0].toUpperCase() + cat.slice(1)}
                </span>
              </div>
              <div style={{ height: 8, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${(val / maxVal) * 100}%`,
                    background: categoryColors[cat] ?? 'var(--clay)',
                    borderRadius: 999,
                    transition: 'width 0.4s',
                  }}
                />
              </div>
              <div className="mono muted" style={{ fontSize: 12, marginTop: 4, textAlign: 'right' }}>
                {formatPKR(val)}
              </div>
            </div>
          ))}
          <div
            style={{
              borderTop: '1px solid var(--border)',
              marginTop: 16,
              paddingTop: 12,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span className="muted t-12">Total (landlord share)</span>
            <span className="mono fw-600" style={{ color: 'var(--heading)' }}>
              {formatPKR(total)}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
