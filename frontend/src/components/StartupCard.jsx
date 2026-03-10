import { useState, memo } from 'react'
import { scoreStartup } from '../api'
import { getScoreColor } from '../utils/scoreColors'

// ─── Design tokens ────────────────────────────────────────────────────────────

// All use -100 bg + ring-1 ring-*-200 to match sector tag pattern
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

// Normalized: all use -100 bg + ring-1 (Pre-Seed was missing ring)
const STAGE_COLORS = {
  'Pre-Seed': 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  'Seed':     'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
  'Series A': 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
  'Series B': 'bg-purple-100 text-purple-700 ring-1 ring-purple-200',
}

// Normalized: all use -100 bg + ring-1, matching sector/stage pattern
const SOURCE_BADGE = {
  'seed':   { label: 'Curated', class: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' },
  'hn':     { label: 'HN',      class: 'bg-orange-100 text-orange-700 ring-1 ring-orange-200' },
  'github': { label: 'GitHub',  class: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200' },
  'rss':    { label: 'News',    class: 'bg-sky-100 text-sky-700 ring-1 ring-sky-200' },
}

const COUNTRY_FLAGS = {
  'France': '🇫🇷', 'Germany': '🇩🇪', 'Spain': '🇪🇸', 'Israel': '🇮🇱',
  'United Kingdom': '🇬🇧', 'Sweden': '🇸🇪', 'Netherlands': '🇳🇱',
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const BoltIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
)

// ─── ScoreBadge ───────────────────────────────────────────────────────────────

const SCORE_RING_RADIUS = 22
const SCORE_RING_CIRCUMFERENCE = 2 * Math.PI * SCORE_RING_RADIUS

function ScoreBadge({ score }) {
  if (score == null) {
    return (
      <div
        className="w-14 h-14 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center"
        role="img"
        aria-label="Not yet scored"
      >
        <span className="text-slate-400 text-xs font-medium" aria-hidden="true">?</span>
      </div>
    )
  }

  const pct = Math.min(100, Math.max(0, score))
  const { hex } = getScoreColor(pct)
  const offset = SCORE_RING_CIRCUMFERENCE - (pct / 100) * SCORE_RING_CIRCUMFERENCE

  return (
    <div
      className="relative w-14 h-14 flex items-center justify-center"
      role="img"
      aria-label={`Fit score: ${Math.round(pct)} out of 100`}
    >
      <svg className="absolute inset-0 -rotate-90" width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
        <circle cx="28" cy="28" r={SCORE_RING_RADIUS} fill="none" stroke="#e2e8f0" strokeWidth="4" />
        <circle
          cx="28" cy="28" r={SCORE_RING_RADIUS}
          fill="none"
          stroke={hex}
          strokeWidth="4"
          strokeDasharray={SCORE_RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span className="relative z-10 font-bold text-sm" style={{ color: hex }} aria-hidden="true">
        {Math.round(pct)}
      </span>
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function StartupCard({ startup, onViewMemo, onScored }) {
  const [scoring, setScoring] = useState(false)

  const sectorClass = SECTOR_COLORS[startup.sector] || 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
  const stageClass  = STAGE_COLORS[startup.stage]   || 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
  const flag        = COUNTRY_FLAGS[startup.country] || '🌍'
  const sourceBadge = SOURCE_BADGE[startup.source]   || { label: startup.source, class: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200' }

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
            <span className={`tag ${sectorClass}`}>{startup.sector}</span>
            <span className={`tag ${stageClass}`}>{startup.stage}</span>
            <span className={`tag ${sourceBadge.class}`}>{sourceBadge.label}</span>
          </div>
          <h3 className="font-bold text-slate-900 text-base leading-tight truncate" title={startup.name}>
            {startup.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-500">
            <span aria-hidden="true">{flag}</span>
            <span>{startup.country}</span>
            {startup.founded_year && (
              <>
                <span className="text-slate-300" aria-hidden="true">·</span>
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
        <p className="text-slate-600 text-sm leading-relaxed line-clamp-3 break-words">
          {startup.description}
        </p>

        {startup.founders && (
          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
            <span aria-hidden="true">👥</span>
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
            <span className="text-amber-500 text-xs mt-0.5" aria-hidden="true">⚠</span>
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
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                Scoring…
              </>
            ) : (
              <>
                <BoltIcon /> Score with AI
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
            aria-label="Visit website"
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
            className="btn-ghost text-xs px-3 min-h-[2.75rem] text-orange-600 hover:text-orange-700 hover:bg-orange-50"
            aria-label="View on HackerNews"
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
            className="btn-ghost text-xs px-3 min-h-[2.75rem] text-purple-600 hover:text-purple-700 hover:bg-purple-50"
            aria-label="View on GitHub"
          >
            <span aria-hidden="true">🐙</span>
          </a>
        )}
        {startup.hn_url && startup.source === 'rss' && (
          <a
            href={startup.hn_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="btn-ghost text-xs px-3 min-h-[2.75rem] text-sky-600 hover:text-sky-700 hover:bg-sky-50"
            aria-label="Read article"
          >
            <span aria-hidden="true">📰</span>
          </a>
        )}
      </div>
    </div>
  )
}

export default memo(StartupCard)
