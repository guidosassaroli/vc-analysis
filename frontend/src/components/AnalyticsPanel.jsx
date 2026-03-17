import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

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

export default function AnalyticsPanel({ startups }) {
  const [open, setOpen] = useState(false)

  const { sectorData, scoreData, stageData } = useMemo(() => {
    // Sector distribution
    const sectorMap = {}
    startups.forEach(s => { sectorMap[s.sector] = (sectorMap[s.sector] || 0) + 1 })
    const sectorData = Object.entries(sectorMap)
      .map(([sector, count]) => ({ sector, count }))
      .sort((a, b) => b.count - a.count)

    // Score histogram
    const scored = startups.filter(s => s.fit_score != null)
    const scoreData = SCORE_BUCKETS.map(({ range, lo, hi, color }) => ({
      range,
      count: scored.filter(s => s.fit_score >= lo && s.fit_score < hi).length,
      color,
    }))

    // Stage breakdown
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
        {!open && (
          <span className="text-xs text-slate-400 font-normal ml-1">
            {startups.length} startups · {startups.filter(s => s.fit_score != null).length} scored
          </span>
        )}
      </button>

      {open && (
        <div
          id="analytics-panel"
          className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {/* Sector Distribution */}
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

          {/* Score Distribution */}
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

          {/* Stage Breakdown */}
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
      )}
    </div>
  )
}
