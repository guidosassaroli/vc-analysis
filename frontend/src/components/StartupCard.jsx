import { useState, useRef, memo } from 'react'
import { scoreStartup, deleteStartup } from '../api'
import { getScoreColor } from '../utils/scoreColors'
import { getStatusClass } from '../utils/statusColors'

// ─── Sector dots ─────────────────────────────────────────────────────────────
const SECTOR_DOTS = {
  'AI/ML':               'bg-violet-400',
  'Biotech':             'bg-emerald-400',
  'Quantum':             'bg-cyan-400',
  'Cybersecurity':       'bg-red-400',
  'Climate Tech':        'bg-green-400',
  'Semiconductors':      'bg-orange-400',
  'Fintech':             'bg-blue-400',
  'Industrial Robotics': 'bg-slate-400',
  'Software':            'bg-indigo-400',
}

const COUNTRY_FLAGS = {
  'France': '🇫🇷', 'Germany': '🇩🇪', 'Spain': '🇪🇸', 'Israel': '🇮🇱',
  'United Kingdom': '🇬🇧', 'Sweden': '🇸🇪', 'Netherlands': '🇳🇱',
  'Switzerland': '🇨🇭', 'Finland': '🇫🇮', 'Denmark': '🇩🇰',
}

const SOURCE_LABELS = {
  seed: 'Curated', hn: 'HN', github: 'GitHub', rss: 'News', manual: 'Added',
}

const STATUS_STYLES = {
  'Sourced':        'bg-slate-100 text-slate-500',
  'In Review':      'bg-blue-50 text-blue-600',
  'Meeting Booked': 'bg-violet-50 text-violet-600',
  'Term Sheet':     'bg-emerald-50 text-emerald-600',
  'Pass':           'bg-red-50 text-red-500',
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const BoltIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
)

const TrashIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const ArrowUpRightIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
  </svg>
)

// ─── Score ring ───────────────────────────────────────────────────────────────
const RING_R = 19
const RING_C = 2 * Math.PI * RING_R

function ScoreBadge({ score }) {
  if (score == null) {
    return (
      <div
        className="w-12 h-12 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center shrink-0"
        role="img"
        aria-label="Not yet scored"
      >
        <span className="text-slate-300 text-[11px] font-medium">—</span>
      </div>
    )
  }

  const pct = Math.min(100, Math.max(0, score))
  const { hex } = getScoreColor(pct)
  const offset = RING_C - (pct / 100) * RING_C

  return (
    <div
      className="relative w-12 h-12 shrink-0 flex items-center justify-center"
      role="img"
      aria-label={`Fit score: ${Math.round(pct)} out of 100`}
    >
      <svg className="absolute inset-0 -rotate-90" width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r={RING_R} fill="none" stroke="#f1f5f9" strokeWidth="2.5" />
        <circle
          cx="24" cy="24" r={RING_R}
          fill="none"
          stroke={hex}
          strokeWidth="2.5"
          strokeDasharray={RING_C}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <span
        className="relative z-10 text-[13px] font-semibold numeral"
        style={{ color: hex }}
        aria-hidden="true"
      >
        {Math.round(pct)}
      </span>
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function StartupCard({ startup, onViewMemo, onScored, onDeleted }) {
  const [scoring, setScoring] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const confirmTimerRef = useRef(null)

  const dotClass = SECTOR_DOTS[startup.sector] || 'bg-slate-300'
  const flag = COUNTRY_FLAGS[startup.country] || '🌍'
  const sourceLabel = SOURCE_LABELS[startup.source] || startup.source
  const statusStyle = STATUS_STYLES[startup.status] || STATUS_STYLES['Sourced']
  const status = startup.status || 'Sourced'

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

  const handleDeleteClick = (e) => {
    e.stopPropagation()
    if (!confirmDelete) {
      setConfirmDelete(true)
      confirmTimerRef.current = setTimeout(() => setConfirmDelete(false), 4000)
      return
    }
    clearTimeout(confirmTimerRef.current)
    setConfirmDelete(false)
    executeDelete()
  }

  const executeDelete = async () => {
    setDeleting(true)
    try {
      await deleteStartup(startup.id)
      onDeleted?.(startup.id)
    } catch (err) {
      console.error('Delete failed:', err)
      setDeleting(false)
    }
  }

  return (
    <div className="card flex flex-col h-full animate-fade-in">

      {/* Top */}
      <div className="p-5 pb-4 flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          {/* Sector + status */}
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} aria-hidden="true" />
              {startup.sector}
            </span>
            {status !== 'Sourced' && (
              <span className={`tag ${statusStyle} text-[10px]`}>{status}</span>
            )}
          </div>

          {/* Name */}
          <h3
            className="font-semibold text-slate-900 text-[15px] leading-snug tracking-tight truncate"
            title={startup.name}
          >
            {startup.name}
          </h3>

          {/* Metadata line */}
          <p className="text-[11.5px] text-slate-400 flex items-center gap-1 flex-wrap">
            <span>{flag} {startup.country}</span>
            {startup.founded_year && <><span aria-hidden="true">·</span><span>{startup.founded_year}</span></>}
            <span aria-hidden="true">·</span>
            <span>{startup.stage}</span>
            <span aria-hidden="true">·</span>
            <span>{sourceLabel}</span>
          </p>
        </div>

        <ScoreBadge score={startup.fit_score} />
      </div>

      {/* Body */}
      <div className="px-5 pb-4 flex-1 space-y-3">
        <p className="text-[13px] text-slate-500 leading-relaxed line-clamp-3">
          {startup.description}
        </p>

        {startup.founders && (
          <p className="text-[12px] text-slate-400 line-clamp-1 flex items-center gap-1">
            <span className="text-slate-300" aria-hidden="true">—</span>
            {startup.founders}
          </p>
        )}

        {startup.score_rationale && (
          <p className="text-[12px] text-slate-400 italic line-clamp-2 pt-3 border-t border-slate-50">
            "{startup.score_rationale}"
          </p>
        )}

        {startup.red_flag && (
          <div className="flex items-start gap-1.5 text-[12px] text-amber-600/90">
            <span className="shrink-0 mt-px" aria-hidden="true">⚠</span>
            <span className="line-clamp-1">{startup.red_flag}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 pt-3 flex items-center gap-1.5 border-t border-slate-50">
        {/* Primary action */}
        {startup.fit_score != null ? (
          <button
            onClick={() => onViewMemo?.(startup)}
            className="btn-primary flex-1 text-[12.5px] py-[7px]"
          >
            View Memo
          </button>
        ) : (
          <button
            onClick={handleScore}
            disabled={scoring}
            className="btn-primary flex-1 text-[12.5px] py-[7px] disabled:opacity-60"
          >
            {scoring ? (
              <>
                <span className="w-3 h-3 border-[1.5px] border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                Scoring…
              </>
            ) : (
              <><BoltIcon /> Score</>
            )}
          </button>
        )}

        {/* External link */}
        {startup.website && (
          <a
            href={startup.website}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="btn-ghost px-2.5 py-[7px] text-slate-400 hover:text-slate-600"
            aria-label="Visit website"
            title={startup.website}
          >
            <ArrowUpRightIcon />
          </a>
        )}

        {/* HN / GitHub / RSS link */}
        {startup.hn_url && (
          <a
            href={startup.hn_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className={`btn-ghost px-2.5 py-[7px] text-[11px] font-semibold ${
              startup.source === 'hn'     ? 'text-orange-400 hover:text-orange-600 hover:bg-orange-50' :
              startup.source === 'github' ? 'text-slate-400 hover:text-slate-600' :
              'text-sky-400 hover:text-sky-600 hover:bg-sky-50'
            }`}
            aria-label={`View on ${startup.source === 'hn' ? 'HN' : startup.source === 'github' ? 'GitHub' : 'source'}`}
          >
            {startup.source === 'hn' ? 'HN' : startup.source === 'github' ? '⌥' : '↗'}
          </a>
        )}

        {/* Delete */}
        <button
          onClick={handleDeleteClick}
          disabled={deleting}
          aria-label={confirmDelete ? 'Confirm remove' : 'Remove from pipeline'}
          title={confirmDelete ? 'Click again to confirm' : 'Remove'}
          className={`btn-ghost px-2.5 py-[7px] disabled:opacity-40 transition-colors ${
            confirmDelete
              ? 'text-red-500 hover:text-red-600 hover:bg-red-50'
              : 'text-slate-300 hover:text-red-400 hover:bg-red-50'
          }`}
        >
          {deleting
            ? <span className="w-3 h-3 border-[1.5px] border-slate-200 border-t-slate-400 rounded-full animate-spin" />
            : <TrashIcon />
          }
        </button>
      </div>
    </div>
  )
}

export default memo(StartupCard)
