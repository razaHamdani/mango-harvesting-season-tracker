import Link from 'next/link'
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  Leaf,
  Package,
  Droplet,
  Receipt,
  Banknote,
  Bell,
  Home,
  Plus,
  ChevronRight,
} from 'lucide-react'
import { getDashboardData } from '@/lib/queries/season-queries'
import { getActivities } from '@/lib/queries/activity-queries'
import { getExpenses } from '@/lib/queries/expense-queries'
import { getFarms } from '@/lib/queries/farm-queries'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatPKR, formatDate } from '@/lib/utils/format'
import type {
  Activity,
  Expense,
  ExpenseCategory,
  ActivityType,
} from '@/types/database'

type FeedItem =
  | { kind: 'activity'; id: string; date: string; data: Activity & { farm_name: string } }
  | { kind: 'expense'; id: string; date: string; data: Expense & { farm_name: string | null } }

const ACTIVITY_ICON: Record<ActivityType, React.ComponentType<{ size?: number }>> = {
  spray: Sparkles,
  fertilize: Leaf,
  harvest: Package,
  water: Droplet,
}

const EXPENSE_ICON: Record<ExpenseCategory, React.ComponentType<{ size?: number }>> = {
  spray: Sparkles,
  fertilizer: Leaf,
  labor: Banknote,
  electricity: Receipt,
  misc: Receipt,
}

const EXPENSE_CLASS: Record<ExpenseCategory, string> = {
  spray: 'spray',
  fertilizer: 'fertilize',
  labor: 'expense',
  electricity: 'expense',
  misc: 'expense',
}

function ActivityFeedRow({ item }: { item: FeedItem }) {
  if (item.kind === 'activity') {
    const a = item.data
    const Icon = ACTIVITY_ICON[a.type] ?? Package
    let title = 'Activity'
    if (a.type === 'spray')
      title = `Spray${a.item_name ? ` — ${a.item_name}` : ''}`
    else if (a.type === 'fertilize')
      title = `Fertilize${a.item_name ? ` — ${a.item_name}` : ''}`
    else if (a.type === 'harvest')
      title = `Harvest — ${a.boxes_collected ?? 0} boxes`
    else if (a.type === 'water')
      title = 'Water'

    const amount = a.type === 'harvest' ? `${a.boxes_collected ?? 0} bx` : ''

    return (
      <div
        className="activity-row"
        style={{ gridTemplateColumns: '40px minmax(0, 1fr) 96px 48px' }}
      >
        <div className={`activity-icon ${a.type}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <div
            className="truncate"
            style={{ fontSize: 14, fontWeight: 500, color: 'var(--heading)' }}
          >
            {title}
          </div>
          <div
            className="truncate"
            style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}
          >
            {a.farm_name} · {formatDate(a.activity_date)}
          </div>
        </div>
        <div
          className="mono tnum text-right"
          style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--heading)' }}
        >
          {amount}
        </div>
        <div aria-hidden="true" style={{ width: 48, height: 48 }} />
      </div>
    )
  }

  const e = item.data
  const Icon = EXPENSE_ICON[e.category] ?? Receipt
  const cls = EXPENSE_CLASS[e.category] ?? 'expense'
  const title = e.description ?? e.category[0].toUpperCase() + e.category.slice(1)
  return (
    <div
      className="activity-row"
      style={{ gridTemplateColumns: '40px minmax(0, 1fr) 96px 48px' }}
    >
      <div className={`activity-icon ${cls}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <div
          className="truncate"
          style={{ fontSize: 14, fontWeight: 500, color: 'var(--heading)' }}
        >
          {title}
        </div>
        <div
          className="truncate"
          style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}
        >
          {e.category[0].toUpperCase() + e.category.slice(1)}
          {e.farm_name ? ` · ${e.farm_name}` : ''} · {formatDate(e.expense_date)}
        </div>
      </div>
      <div
        className="mono tnum text-right"
        style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--heading)' }}
      >
        {formatPKR(e.amount)}
      </div>
      <div aria-hidden="true" style={{ width: 48, height: 48 }} />
    </div>
  )
}

export default async function DashboardPage() {
  const data = await getDashboardData()
  const { activeSeason } = data

  // Pull farms list separately; cheap and used in the right column.
  const farms = await getFarms()

  // If active season exists, fetch extra activity + expense pages in parallel
  // to build a richer recent-activity feed than what getDashboardData returns.
  let feed: FeedItem[] = []
  if (activeSeason) {
    const [actsRes, expsRes] = await Promise.all([
      getActivities(activeSeason.id),
      getExpenses(activeSeason.id),
    ])
    const acts: FeedItem[] = actsRes.items.slice(0, 10).map((a) => ({
      kind: 'activity',
      id: a.id,
      date: a.activity_date,
      data: a,
    }))
    const exps: FeedItem[] = expsRes.items.slice(0, 10).map((e) => ({
      kind: 'expense',
      id: e.id,
      date: e.expense_date,
      data: e,
    }))
    feed = [...acts, ...exps]
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(0, 10)
  }

  // Async Server Component: rendered once per request, so a single clock
  // snapshot cannot drift across re-renders the way the purity rule assumes.
  // eslint-disable-next-line react-hooks/purity -- RSC, one render per request
  const now = Date.now()

  const dayOfHarvest = activeSeason?.started_at
    ? Math.max(
        0,
        Math.floor(
          (now - new Date(activeSeason.started_at).getTime()) / 86400000,
        ),
      )
    : 0

  // null insights = the RPC failed; render an explicit error card instead of
  // financial numbers (zeros would be indistinguishable from real data).
  const insights = activeSeason?.insights ?? null

  const paymentPct =
    insights && activeSeason && activeSeason.predetermined_amount > 0
      ? Math.min(
          (insights.total_payments_received /
            activeSeason.predetermined_amount) *
            100,
          100,
        )
      : 0

  const boxesReceived = insights?.boxes_received ?? 0
  const agreedBoxes = activeSeason?.agreed_boxes ?? 0
  const boxPct =
    activeSeason && agreedBoxes > 0
      ? Math.min((boxesReceived / agreedBoxes) * 100, 100)
      : 0

  const totalExpenses = insights?.total_expenses ?? 0
  const categoryEntries = Object.entries(
    insights?.expenses_by_category ?? {},
  ) as [string, number][]
  const topCategory =
    categoryEntries.sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
  const leadCategoryLabel =
    topCategory === '—'
      ? 'No expenses yet'
      : `${topCategory[0].toUpperCase() + topCategory.slice(1)} leads`

  const netProfit =
    (insights?.total_payments_received ?? 0) - totalExpenses

  const nextInstallment = activeSeason?.upcomingInstallments[0]
  const dueDateStr = nextInstallment
    ? formatDate(nextInstallment.due_date)
    : ''
  let dueBadge: { label: string; variant: 'mango' | 'overdue' } = {
    label: '',
    variant: 'mango',
  }
  if (nextInstallment) {
    const diffDays = Math.ceil(
      (new Date(nextInstallment.due_date).getTime() - now) / 86400000,
    )
    if (diffDays < 0) {
      dueBadge = { label: `Overdue ${Math.abs(diffDays)}d`, variant: 'overdue' }
    } else if (diffDays === 0) {
      dueBadge = { label: 'Due today', variant: 'mango' }
    } else {
      dueBadge = { label: `Due in ${diffDays} days`, variant: 'mango' }
    }
  }

  const installmentsPaid = insights?.installments_paid ?? 0
  const installmentsTotal = insights?.installments_total ?? 0

  // Render up to 5 ticks evenly spaced — color by index relative to paid count.
  const tickCount = Math.max(installmentsTotal, 0)
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    let cls: 'paid' | 'current' | 'future' = 'future'
    if (i < installmentsPaid) cls = 'paid'
    else if (i === installmentsPaid) cls = 'current'
    return cls
  })

  return (
    <div className="space-y-6">
      {/* Heading row */}
      <div>
        {activeSeason ? (
          <>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: '-0.022em',
                color: 'var(--heading)',
              }}
            >
              Season {activeSeason.year}{' '}
              <span
                style={{
                  color: 'var(--text-muted)',
                  fontWeight: 500,
                  fontSize: 20,
                }}
              >
                — Day {dayOfHarvest} of harvest
              </span>
            </h1>
            <p
              className="mt-1.5"
              style={{ fontSize: 13, color: 'var(--text-muted)' }}
            >
              Contractor: {activeSeason.contractor_name}
            </p>
          </>
        ) : (
          <>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: '-0.022em',
                color: 'var(--heading)',
              }}
            >
              Dashboard
            </h1>
            <p
              className="mt-1.5"
              style={{ fontSize: 13, color: 'var(--text-muted)' }}
            >
              Overview of your farm operations
            </p>
          </>
        )}
      </div>

      {!activeSeason ? (
        <div
          className="flex flex-col items-center text-center"
          style={{
            padding: '56px 24px',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-card)',
            background: 'var(--surface)',
          }}
        >
          <div
            className="grid place-items-center mb-4"
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              background: 'var(--clay-soft)',
              color: 'var(--soil)',
            }}
          >
            <Plus size={22} />
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--heading)',
            }}
          >
            No active season
          </div>
          <p
            className="mt-1"
            style={{
              fontSize: 13,
              color: 'var(--text-muted)',
              maxWidth: 320,
            }}
          >
            Start a new season to begin tracking activities, expenses, and
            payments.
          </p>
          <Button
            className="mt-4"
            render={<Link href="/seasons/new" />}
          >
            <Plus size={16} /> Create season
          </Button>
        </div>
      ) : (
        <>
          {/* Insights RPC failed — say so instead of rendering fake zeros. */}
          {!insights && (
            <div
              style={{
                padding: '20px 24px',
                border: '1px dashed var(--border)',
                borderRadius: 'var(--radius-card)',
                background: 'var(--surface)',
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--heading)',
                }}
              >
                Couldn&apos;t load season insights
              </div>
              <p
                className="mt-1"
                style={{ fontSize: 13, color: 'var(--text-muted)' }}
              >
                Payments, expenses, and harvest figures are temporarily
                unavailable. Try refreshing the page.
              </p>
            </div>
          )}

          {insights && (
            <>
          {/* Hero row: payment progress (60%) + next installment (40%) */}
          <div
            className="grid gap-6"
            style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)' }}
          >
            <div className="dash-hero__progress">
              <div className="section-label">Payments received</div>
              <div
                className="flex items-baseline gap-4 mt-2 flex-wrap"
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 40,
                    fontWeight: 600,
                    color: 'var(--heading)',
                    letterSpacing: '-0.024em',
                    lineHeight: 1,
                  }}
                >
                  {formatPKR(insights.total_payments_received)}
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 18,
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                  }}
                >
                  / {formatPKR(activeSeason.predetermined_amount)}
                </span>
              </div>
              <div
                className="mt-2"
                style={{ fontSize: 13, color: 'var(--text-muted)' }}
              >
                {Math.round(paymentPct)}% of contract paid
              </div>

              {/* Progress bar */}
              <div
                className="relative mt-5 overflow-hidden rounded-full"
                style={{
                  height: 6,
                  background: 'oklch(0.40 0.04 60 / 10%)',
                }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${paymentPct}%`,
                    background:
                      'linear-gradient(90deg, var(--mango-deep) 0%, var(--mango) 100%)',
                    boxShadow:
                      '0 1px 2px oklch(0.78 0.16 75 / 35%)',
                    transition: 'width 600ms var(--ease)',
                  }}
                />
              </div>

              {/* Installment ticks */}
              {ticks.length > 0 && (
                <div className="flex items-center justify-between mt-3 px-1">
                  {ticks.map((cls, i) => (
                    <span
                      key={i}
                      aria-label={`Installment ${i + 1} ${cls}`}
                      style={{
                        width: cls === 'current' ? 10 : 8,
                        height: cls === 'current' ? 10 : 8,
                        borderRadius: 999,
                        background:
                          cls === 'paid'
                            ? 'var(--leaf)'
                            : cls === 'current'
                              ? 'var(--mango)'
                              : 'var(--clay)',
                        boxShadow:
                          cls === 'current'
                            ? '0 0 0 3px oklch(0.78 0.16 75 / 25%)'
                            : 'none',
                      }}
                    />
                  ))}
                </div>
              )}

              <div
                className="mt-3.5"
                style={{ fontSize: 11.5, color: 'var(--text-muted)' }}
              >
                {installmentsPaid} of {installmentsTotal} installments paid
              </div>
            </div>

            <div className="dash-hero__due">
              <div
                className="inline-flex items-center gap-1.5 self-start"
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: 'oklch(0.55 0.20 35 / 14%)',
                  color: 'var(--rust)',
                  fontSize: 11.5,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  textTransform: 'uppercase',
                }}
              >
                <Bell size={12} />
                <span>Next installment</span>
              </div>
              {nextInstallment ? (
                <>
                  <div
                    className="mono"
                    style={{
                      fontSize: 34,
                      fontWeight: 600,
                      color: 'var(--heading)',
                      letterSpacing: '-0.024em',
                      lineHeight: 1,
                      marginTop: 14,
                    }}
                  >
                    {formatPKR(nextInstallment.expected_amount)}
                  </div>
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    <span
                      style={{ fontSize: 13, color: 'var(--heading)' }}
                    >
                      Due {dueDateStr}
                    </span>
                    {dueBadge.label && (
                      <Badge variant={dueBadge.variant} className="ml-auto">
                        <span className="dot" />
                        {dueBadge.label}
                      </Badge>
                    )}
                  </div>
                  <Button
                    className="mt-5 w-full"
                    render={
                      <Link
                        href={`/seasons/${activeSeason.id}/payments`}
                      />
                    }
                  >
                    <Banknote size={16} /> Record payment
                  </Button>
                </>
              ) : (
                <>
                  <div
                    className="mono"
                    style={{
                      fontSize: 24,
                      fontWeight: 600,
                      color: 'var(--heading)',
                      marginTop: 14,
                    }}
                  >
                    All paid
                  </div>
                  <p
                    className="mt-2"
                    style={{ fontSize: 13, color: 'var(--text-muted)' }}
                  >
                    No upcoming installments.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="kpi">
              <div className="kpi__label">Boxes harvested</div>
              <div className="kpi__value">
                {boxesReceived}{' '}
                <span
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: 16,
                    fontWeight: 500,
                  }}
                >
                  / {agreedBoxes}
                </span>
              </div>
              <div className="kpi__sub">
                {Math.round(boxPct)}% of agreed
              </div>
            </div>
            <div className="kpi">
              <div className="kpi__label">Landlord spend</div>
              <div className="kpi__value">{formatPKR(totalExpenses)}</div>
              <div className="kpi__sub">{leadCategoryLabel}</div>
            </div>
            <div className="kpi">
              <div className="kpi__label">Net profit</div>
              <div className="kpi__value">{formatPKR(netProfit)}</div>
              <div
                className={`kpi__delta ${netProfit >= 0 ? 'up' : 'down'} mt-3 inline-flex items-center gap-1.5`}
              >
                {netProfit >= 0 ? (
                  <TrendingUp size={13} />
                ) : (
                  <TrendingDown size={13} />
                )}
                {netProfit >= 0 ? '↑' : '↓'} {formatPKR(Math.abs(netProfit))}
              </div>
            </div>
          </div>
            </>
          )}

          {/* Feed row */}
          <div
            className="grid gap-6"
            style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)' }}
          >
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-card)',
                boxShadow: 'var(--shadow)',
                overflow: 'hidden',
              }}
            >
              <div
                className="flex items-center justify-between"
                style={{ padding: '18px 24px 6px' }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: 'var(--heading)',
                    }}
                  >
                    Recent activity
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: 'var(--text-muted)',
                      marginTop: 2,
                    }}
                  >
                    Last {feed.length} entries
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  render={
                    <Link href={`/seasons/${activeSeason.id}`} />
                  }
                >
                  Open log <ChevronRight size={14} />
                </Button>
              </div>
              <div className="mt-2">
                {feed.length === 0 ? (
                  <p
                    style={{
                      padding: '24px',
                      fontSize: 13,
                      color: 'var(--text-muted)',
                    }}
                  >
                    No activities or expenses yet.
                  </p>
                ) : (
                  feed.map((item) => (
                    <ActivityFeedRow
                      key={`${item.kind}-${item.id}`}
                      item={item}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-card)',
                  boxShadow: 'var(--shadow)',
                  overflow: 'hidden',
                }}
              >
                <div
                  className="flex items-center justify-between"
                  style={{ padding: '18px 24px 6px' }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: 'var(--heading)',
                      }}
                    >
                      Farms
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: 'var(--text-muted)',
                        marginTop: 2,
                      }}
                    >
                      {farms.length} farm{farms.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    render={<Link href="/farms" />}
                  >
                    All <ChevronRight size={14} />
                  </Button>
                </div>
                <div className="pt-2 pb-2">
                  {farms.length === 0 ? (
                    <p
                      style={{
                        padding: '14px 24px',
                        fontSize: 13,
                        color: 'var(--text-muted)',
                      }}
                    >
                      No farms yet.
                    </p>
                  ) : (
                    farms.map((f, i) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between"
                        style={{
                          padding: '12px 24px',
                          borderTop:
                            i === 0
                              ? '0'
                              : '1px solid var(--border)',
                        }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="grid place-items-center"
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 999,
                              background: 'var(--leaf-soft)',
                              color: 'oklch(0.35 0.13 145)',
                            }}
                          >
                            <Home size={15} />
                          </div>
                          <div className="min-w-0">
                            <div
                              className="truncate"
                              style={{
                                fontSize: 13.5,
                                fontWeight: 500,
                                color: 'var(--heading)',
                              }}
                            >
                              {f.name}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: 'var(--text-muted)',
                                marginTop: 2,
                              }}
                            >
                              {f.acreage} acres
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-card)',
                  boxShadow: 'var(--shadow)',
                  padding: 20,
                }}
              >
                <div className="section-label mb-3">Quick actions</div>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="ghost"
                    className="justify-start"
                    render={
                      <Link
                        href={`/seasons/${activeSeason.id}/activities/new`}
                      />
                    }
                  >
                    <Plus size={16} /> Log activity
                  </Button>
                  <Button
                    variant="ghost"
                    className="justify-start"
                    render={
                      <Link
                        href={`/seasons/${activeSeason.id}/expenses/new`}
                      />
                    }
                  >
                    <Plus size={16} /> Add expense
                  </Button>
                  <Button
                    variant="ghost"
                    className="justify-start"
                    render={
                      <Link
                        href={`/seasons/${activeSeason.id}/payments`}
                      />
                    }
                  >
                    <Banknote size={16} /> Record payment
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
