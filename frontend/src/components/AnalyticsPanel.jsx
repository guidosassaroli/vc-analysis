import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

// ─── Icons ────────────────────────────────────────────────────────────────────

const ChartBarIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
)

const ChevronIcon = ({ open }) => (
  <svg
    className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
)

const BuildingIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
  </svg>
)

const SparklesIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
  </svg>
)

const CheckBadgeIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-.702 3.597 3.745 3.745 0 01-3.597.702A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.597-.702 3.745 3.745 0 01-.702-3.597A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 01.702-3.597 3.745 3.745 0 013.597-.702A3.745 3.745 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.745 3.745 0 013.597.702 3.745 3.745 0 01.702 3.597A3.745 3.745 0 0121 12z" />
  </svg>
)

const SquaresIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
  </svg>
)

const GlobeIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
  </svg>
)

const TrendingUpIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
  </svg>
)

// ─── Data ─────────────────────────────────────────────────────────────────────

const STAT_ITEMS = [
  { key: 'total',     label: 'Total Startups', Icon: BuildingIcon,   color: 'text-slate-700' },
  { key: 'scored',    label: 'Scored',          Icon: SparklesIcon,   color: 'text-elaia-navy' },
  { key: 'high_fit',  label: 'High Fit (≥70)',  Icon: CheckBadgeIcon, color: 'text-emerald-600' },
  { key: 'sectors',   label: 'Sectors',         Icon: SquaresIcon,    color: 'text-violet-600' },
  { key: 'countries', label: 'Countries',       Icon: GlobeIcon,      color: 'text-amber-600' },
  { key: 'avg_score', label: 'Avg Score',       Icon: TrendingUpIcon, color: 'text-elaia-navy', suffix: '/100' },
]

const SCORE_BUCKETS = [
  { range: '0–20',   lo: 0,  hi: 20,  color: '#dc2626' },
  { range: '20–40',  lo: 20, hi: 40,  color: '#ef4444' },
  { range: '40–60',  lo: 40, hi: 60,  color: '#d97706' },
  { range: '60–80',  lo: 60, hi: 80,  color: '#16a34a' },
  { range: '80–100', lo: 80, hi: 101, color: '#15803d' },
]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm text-xs text-slate-700">
      <span className="font-semibold">{label}:</span> {payload[0].value}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AnalyticsPanel({ startups, stats }) {
  const [open, setOpen] = useState(false)

  const { sectorData, scoreData, stageData } = useMemo(() => {
    const sectorMap = {}
    startups.forEach(s => { sectorMap[s.sector] = (sectorMap[s.sector] || 0) + 1 })
    const sectorData = Object.entries(sectorMap)
      .map(([sector, count]) => ({ sector, count }))
      .sort((a, b) => b.count - a.count)

    const scored = startups.filter(s => s.fit_score != null)
    const scoreData = SCORE_BUCKETS.map(({ range, lo, hi, color }) => ({
      range,
      count: scored.filter(s => s.fit_score >= lo && s.fit_score < hi).length,
      color,
    }))

    const stageMap = {}
    startups.forEach(s => { stageMap[s.stage] = (stageMap[s.stage] || 0) + 1 })
    const stageData = Object.entries(stageMap)
      .map(([stage, count]) => ({ stage, count }))
      .sort((a, b) => b.count - a.count)

    return { sectorData, scoreData, stageData }
  }, [startups])

  if (startups.length === 0) return null

  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls="analytics-panel"
        className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors group"
      >
        <span className="group-hover:text-elaia-navy"><ChartBarIcon /></span>
        Analytics
        <ChevronIcon open={open} />
        {!open && stats && (
          <span className="text-xs text-slate-400 font-normal ml-1">
            {stats.total} startups · {stats.scored} scored · avg {stats.avg_score}/100
          </span>
        )}
      </button>

      {open && (
        <div id="analytics-panel" className="mt-4 space-y-4">

          {/* Stats grid */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {STAT_ITEMS.map(item => (
              <div
                key={item.key}
                className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow"
              >
                <div className={`text-2xl font-bold ${item.color} leading-none mb-1`}>
                  {stats ? (stats[item.key] ?? '—') : (
                    <div className="skeleton h-6 w-12 rounded" />
                  )}
                  {item.suffix && stats && (
                    <span className="text-sm font-normal text-slate-400">{item.suffix}</span>
                  )}
                </div>
                <div className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
                  <item.Icon />
                  <span>{item.label}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Charts grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Sector Distribution
              </h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={sectorData} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="sector" type="category" tick={{ fontSize: 10, fill: '#64748b' }} width={105} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="count" fill="#0a1628" radius={[0, 3, 3, 0]} maxBarSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Score Distribution
              </h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={scoreData} margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
                  <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={24} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={36}>
                    {scoreData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Stage Breakdown
              </h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stageData} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="stage" type="category" tick={{ fontSize: 10, fill: '#64748b' }} width={72} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="count" fill="#0d9488" radius={[0, 3, 3, 0]} maxBarSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
