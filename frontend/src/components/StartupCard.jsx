import { useState } from 'react'
import { scoreStartup } from '../api'

const SECTOR_COLORS = {
  'AI/ML':               'bg-violet-100 text-violet-700 ring-1 ring-violet-200',
  'Biotech':             'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
  'Quantum':             'bg-cyan-100 text-cyan-700 ring-1 ring-cyan-200',
  'Cybersecurity':       'bg-red-100 text-red-700 ring-1 ring-red-200',
  'Climate Tech':        'bg-green-100 text-green-700 ring-1 ring-green-200',
  'Semiconductors':      'bg-orange-100 text-orange-700 ring-1 ring-orange-200',
  'Fintech':             'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
  'Industrial Robotics': 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  'Software':            'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200',
}

const STAGE_COLORS = {
  'Pre-Seed': 'bg-slate-100 text-slate-600',
  'Seed':     'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  'Series A': 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  'Series B': 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
}

const COUNTRY_FLAGS = {
  'France':         '🇫🇷',
  'Germany':        '🇩🇪',
  'Spain':          '🇪🇸',
  'Israel':         '🇮🇱',
  'United Kingdom': '🇬🇧',
  'Sweden':         '🇸🇪',
  'Netherlands':    '🇳🇱',
}

const SOURCE_BADGE = {
  'seed':   { label: 'Curated', class: 'bg-emerald-50 text-emerald-600' },
  'hn':     { label: 'HN', class: 'bg-orange-50 text-orange-600' },
  'github': { label: 'GitHub', class: 'bg-purple-50 text-purple-600' },
  'rss':    { label: 'News', class: 'bg-sky-50 text-sky-600' },
}

function ScoreBadge({ score }) {
  if (score == null) {
    return (
      <div className="w-14 h-14 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center">
        <span className="text-slate-400 text-xs font-medium">?</span>
      </div>
    )
  }

  const pct = Math.min(100, Math.max(0, score))
  const isHigh   = pct >= 70
  const isMid    = pct >= 40 && pct < 70
  const isLow    = pct < 40

  const bgColor = isHigh ? '#22c55e' : isMid ? '#f59e0b' : '#ef4444'
  const textColor = '#ffffff'
  const strokeColor = bgColor
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference

  return (
    <div className="relative w-14 h-14 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="4" />
        <circle
          cx="28" cy="28" r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span className="relative z-10 font-bold text-sm" style={{ color: bgColor }}>
        {Math.round(pct)}
      </span>
    </div>
  )
}

export default function StartupCard({ startup, onViewMemo, onScored }) {
  const [scoring, setScoring] = useState(false)

  const sector = startup.sector
  const sectorClass = SECTOR_COLORS[sector] || 'bg-slate-100 text-slate-600'
  const stageClass = STAGE_COLORS[startup.stage] || 'bg-slate-100 text-slate-600'
  const flag = COUNTRY_FLAGS[startup.country] || '🌍'
  const sourceBadge = SOURCE_BADGE[startup.source] || { label: startup.source, class: 'bg-slate-100 text-slate-600' }

  const handleScore = async (e) => {
    e.stopPropagation()
    setScoring(true)
    try {
      const updated = await scoreStartup(startup.id)
      onScored?.(updated)
    } catch (err) {
      console.error('Scoring failed:', err)
    } finally {
      setScoring(false)
    }
  }

  return (
    <div className="card flex flex-col h-full animate-fade-in">
      {/* Card Header */}
      <div className="p-5 flex items-start justify-between gap-3 border-b border-slate-100">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={`tag ${sectorClass}`}>{sector}</span>
            <span className={`tag ${stageClass}`}>{startup.stage}</span>
            <span className={`tag text-xs ${sourceBadge.class}`}>{sourceBadge.label}</span>
          </div>
          <h3 className="font-bold text-slate-900 text-base leading-tight truncate" title={startup.name}>
            {startup.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-500">
            <span>{flag}</span>
            <span>{startup.country}</span>
            {startup.founded_year && (
              <>
                <span className="text-slate-300">·</span>
                <span>Est. {startup.founded_year}</span>
              </>
            )}
          </div>
        </div>

        <div className="shrink-0">
          <ScoreBadge score={startup.fit_score} />
        </div>
      </div>

      {/* Description */}
      <div className="px-5 py-4 flex-1">
        <p className="text-slate-600 text-sm leading-relaxed line-clamp-3">
          {startup.description}
        </p>

        {startup.founders && (
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
            <span>👥</span>
            <span className="line-clamp-1">{startup.founders}</span>
          </p>
        )}

        {startup.score_rationale && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-500 italic line-clamp-2">
              "{startup.score_rationale}"
            </p>
          </div>
        )}

        {startup.red_flag && (
          <div className="mt-2 flex items-start gap-1.5">
            <span className="text-amber-500 text-xs mt-0.5">⚠</span>
            <p className="text-xs text-amber-700 line-clamp-1">{startup.red_flag}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-5 pb-4 flex items-center gap-2 border-t border-slate-100 pt-3">
        {startup.fit_score != null ? (
          <button
            onClick={() => onViewMemo?.(startup)}
            className="btn-primary flex-1 text-sm"
          >
            View Memo
          </button>
        ) : (
          <button
            onClick={handleScore}
            disabled={scoring}
            className="btn-primary flex-1 text-sm disabled:opacity-60"
          >
            {scoring ? (
              <>
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Scoring…
              </>
            ) : (
              <>
                <span>⚡</span> Score with AI
              </>
            )}
          </button>
        )}

        {startup.website && (
          <a
            href={startup.website}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="btn-secondary text-sm px-3"
            title="Visit website"
          >
            ↗
          </a>
        )}

        {startup.hn_url && startup.source === 'hn' && (
          <a
            href={startup.hn_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="btn-ghost text-xs px-2 text-orange-500 hover:text-orange-600 hover:bg-orange-50"
            title="View on HackerNews"
          >
            HN
          </a>
        )}
        {startup.hn_url && startup.source === 'github' && (
          <a
            href={startup.hn_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="btn-ghost text-xs px-2 text-purple-500 hover:text-purple-600 hover:bg-purple-50"
            title="View on GitHub"
          >
            🐙
          </a>
        )}
        {startup.hn_url && startup.source === 'rss' && (
          <a
            href={startup.hn_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="btn-ghost text-xs px-2 text-sky-500 hover:text-sky-600 hover:bg-sky-50"
            title="Read article"
          >
            📰
          </a>
        )}
      </div>
    </div>
  )
}
