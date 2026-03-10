import { useState, useEffect } from 'react'
import { generateMemo, scoreStartup } from '../api'

const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const SCORE_RING_COLORS = {
  high: { ring: '#22c55e', bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Strong Fit' },
  mid:  { ring: '#f59e0b', bg: 'bg-amber-50',   text: 'text-amber-700',   label: 'Moderate Fit' },
  low:  { ring: '#ef4444', bg: 'bg-red-50',      text: 'text-red-700',     label: 'Weak Fit' },
}

function getScoreColor(score) {
  if (score >= 70) return SCORE_RING_COLORS.high
  if (score >= 40) return SCORE_RING_COLORS.mid
  return SCORE_RING_COLORS.low
}

const MEMO_SECTIONS = [
  { key: 'memo_problem',   label: 'Problem',          icon: '🔍' },
  { key: 'memo_solution',  label: 'Solution',         icon: '💡' },
  { key: 'memo_team',      label: 'Team Assessment',  icon: '👥' },
  { key: 'memo_traction',  label: 'Traction & Market',icon: '📈' },
  { key: 'memo_elaia_fit', label: 'Elaia Fit',        icon: '🎯' },
  { key: 'memo_red_flags', label: 'Red Flags & Risks',icon: '⚠️' },
]

const COUNTRY_FLAGS = {
  'France': '🇫🇷', 'Germany': '🇩🇪', 'Spain': '🇪🇸', 'Israel': '🇮🇱',
  'United Kingdom': '🇬🇧', 'Sweden': '🇸🇪', 'Netherlands': '🇳🇱',
}

function ScoreRing({ score }) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const pct = Math.min(100, Math.max(0, score || 0))
  const offset = circumference - (pct / 100) * circumference
  const colors = getScoreColor(pct)

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="-rotate-90 absolute" width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="6" />
        <circle
          cx="48" cy="48" r={radius}
          fill="none"
          stroke={colors.ring}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="relative z-10 text-center">
        <div className="text-2xl font-bold" style={{ color: colors.ring }}>{Math.round(pct)}</div>
        <div className="text-xs text-slate-400 -mt-0.5">/100</div>
      </div>
    </div>
  )
}

function MemoSection({ icon, label, content }) {
  const isRedFlags = label.includes('Red Flag')
  return (
    <div className={`rounded-xl p-4 border ${isRedFlags ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{icon}</span>
        <h4 className={`font-semibold text-sm ${isRedFlags ? 'text-amber-800' : 'text-slate-700'}`}>
          {label}
        </h4>
      </div>
      {content ? (
        <p className={`text-sm leading-relaxed ${isRedFlags ? 'text-amber-900' : 'text-slate-600'}`}>
          {content}
        </p>
      ) : (
        <div className="space-y-2">
          <div className="skeleton h-3 w-full rounded" />
          <div className="skeleton h-3 w-5/6 rounded" />
        </div>
      )}
    </div>
  )
}

export default function MemoModal({ startup: initialStartup, onClose, onUpdated }) {
  const [startup, setStartup] = useState(initialStartup)
  const [generating, setGenerating] = useState(false)
  const [rescoring, setRescoring] = useState(false)

  const hasMemo = MEMO_SECTIONS.some(s => startup[s.key])
  const score = startup.fit_score
  const colors = score != null ? getScoreColor(score) : null
  const flag = COUNTRY_FLAGS[startup.country] || '🌍'

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleGenerateMemo = async () => {
    setGenerating(true)
    try {
      const updated = await generateMemo(startup.id)
      setStartup(updated)
      onUpdated?.(updated)
    } catch (e) {
      console.error('Memo generation failed', e)
    } finally {
      setGenerating(false)
    }
  }

  const handleRescore = async () => {
    setRescoring(true)
    try {
      const updated = await scoreStartup(startup.id)
      setStartup(updated)
      onUpdated?.(updated)
    } catch (e) {
      console.error('Rescoring failed', e)
    } finally {
      setRescoring(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>

        {/* Modal Header */}
        <div className="bg-elaia-navy px-6 py-5 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-start gap-5">
            <ScoreRing score={startup.fit_score} />
            <div className="text-white pt-1">
              <h2 className="text-xl font-bold leading-tight">{startup.name}</h2>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-blue-200 text-sm">{startup.sector}</span>
                <span className="text-white/30">·</span>
                <span className="text-blue-200 text-sm">{startup.stage}</span>
                <span className="text-white/30">·</span>
                <span className="text-blue-200 text-sm">{flag} {startup.country}</span>
              </div>
              {colors && (
                <span className={`inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}>
                  {colors.label}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">

          {/* Founders */}
          {startup.founders && (
            <div className="flex items-center gap-2 mb-4 text-sm text-slate-600">
              <span className="font-medium text-slate-500">Founders:</span>
              <span>{startup.founders}</span>
            </div>
          )}

          {/* Description */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-5">
            <p className="text-sm text-slate-600 leading-relaxed">{startup.description}</p>
            {startup.website && (
              <a href={startup.website} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 text-xs mt-2 hover:underline">
                {startup.website} ↗
              </a>
            )}
          </div>

          {/* Rationale */}
          {startup.score_rationale && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5">
              <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
                AI Scoring Rationale
              </div>
              <p className="text-sm text-blue-900 leading-relaxed">{startup.score_rationale}</p>
              {startup.red_flag && (
                <div className="flex items-start gap-2 mt-3 pt-3 border-t border-blue-200">
                  <span className="text-amber-500 text-sm shrink-0">⚠</span>
                  <p className="text-sm text-amber-800">{startup.red_flag}</p>
                </div>
              )}
            </div>
          )}

          {/* Memo Sections */}
          {hasMemo ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">
                  Due Diligence Memo
                </h3>
                <button
                  onClick={handleGenerateMemo}
                  disabled={generating}
                  className="btn-ghost text-xs text-blue-600"
                >
                  {generating ? 'Regenerating…' : '↺ Regenerate'}
                </button>
              </div>
              {MEMO_SECTIONS.map(section => (
                <MemoSection
                  key={section.key}
                  icon={section.icon}
                  label={section.label}
                  content={startup[section.key]}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">📋</div>
              <h3 className="font-semibold text-slate-700 mb-1">No memo generated yet</h3>
              <p className="text-sm text-slate-500 mb-5">
                Generate a full due diligence memo powered by Claude AI.
              </p>
              <button
                onClick={handleGenerateMemo}
                disabled={generating}
                className="btn-primary disabled:opacity-60"
              >
                {generating ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating Memo…
                  </>
                ) : (
                  <>⚡ Generate DD Memo</>
                )}
              </button>
            </div>
          )}

          {generating && !hasMemo && (
            <div className="mt-4 space-y-3">
              {MEMO_SECTIONS.map(s => (
                <div key={s.key} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="flex items-center gap-2 mb-3">
                    <span>{s.icon}</span>
                    <div className="skeleton h-4 w-32 rounded" />
                  </div>
                  <div className="space-y-2">
                    <div className="skeleton h-3 w-full rounded" />
                    <div className="skeleton h-3 w-4/5 rounded" />
                    <div className="skeleton h-3 w-3/5 rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
          <div className="flex gap-2">
            {startup.website && (
              <a href={startup.website} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs">
                Visit Website ↗
              </a>
            )}
            {startup.hn_url && (
              <a href={startup.hn_url} target="_blank" rel="noopener noreferrer"
                className="btn-ghost text-xs text-orange-500 hover:text-orange-600 hover:bg-orange-50">
                View on HN
              </a>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRescore}
              disabled={rescoring}
              className="btn-secondary text-xs disabled:opacity-60"
            >
              {rescoring ? 'Rescoring…' : '↺ Rescore'}
            </button>
            <button onClick={onClose} className="btn-secondary text-xs">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
