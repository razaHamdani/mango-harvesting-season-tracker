import { getActiveSeasonSnapshot } from '@/lib/queries/season-queries'

export async function SidebarSeasonCard() {
  const snapshot = await getActiveSeasonSnapshot()
  if (!snapshot) return null

  const pct = Math.max(0, Math.min(100, Math.round(snapshot.paid_pct)))

  return (
    <div
      className="rounded-lg border"
      style={{
        margin: '8px 12px 12px',
        padding: '12px 12px 10px',
        background: 'oklch(1 0 0 / 4%)',
        borderColor: 'oklch(1 0 0 / 6%)',
      }}
    >
      <div
        style={{
          fontSize: '10.5px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'oklch(0.65 0.02 70)',
        }}
      >
        Active season
      </div>
      <div
        style={{
          fontSize: '18px',
          fontWeight: 600,
          color: 'var(--cream)',
          marginTop: '2px',
        }}
      >
        {snapshot.year}
      </div>
      <div style={{ fontSize: '11.5px', color: 'oklch(0.72 0.02 70)' }}>
        {snapshot.contractor_name} · Day {snapshot.day_of_harvest}
      </div>
      <div
        style={{
          marginTop: '8px',
          height: '4px',
          background: 'oklch(1 0 0 / 8%)',
          borderRadius: '999px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: 'var(--mango)',
            borderRadius: '999px',
          }}
        />
      </div>
    </div>
  )
}
