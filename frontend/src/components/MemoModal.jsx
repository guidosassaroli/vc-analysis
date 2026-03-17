import { useState, useEffect, useRef, useCallback } from 'react'
import { generateMemo, scoreStartup, chatWithStartup, updateStatus } from '../api'
import { getScoreColor } from '../utils/scoreColors'
import { getStatusClass, PIPELINE_STATUSES } from '../utils/statusColors'

// ─── Icons ────────────────────────────────────────────────────────────────────

const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
)

// Section icons — match Heroicons outline style used throughout the app
const MagnifyingGlassIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
)

const LightBulbIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
  </svg>
)

const UserGroupIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
  </svg>
)

const TrendingUpIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
  </svg>
)

const CheckCircleIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const ExclamationTriangleIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
)

const BoltIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
)

const ChatIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
  </svg>
)

const SendIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
  </svg>
)

const SUGGESTED_QUESTIONS = [
  'Who are the main competitors?',
  'What is the exit potential?',
  'How does this fit Elaia\'s thesis?',
  'What questions should we ask the founders?',
]

// ─── Data ─────────────────────────────────────────────────────────────────────

const MEMO_SECTIONS = [
  { key: 'memo_problem',   label: 'Problem',           Icon: MagnifyingGlassIcon },
  { key: 'memo_solution',  label: 'Solution',          Icon: LightBulbIcon },
  { key: 'memo_team',      label: 'Team Assessment',   Icon: UserGroupIcon },
  { key: 'memo_traction',  label: 'Traction & Market', Icon: TrendingUpIcon },
  { key: 'memo_elaia_fit', label: 'Elaia Fit',         Icon: CheckCircleIcon },
  { key: 'memo_red_flags', label: 'Red Flags & Risks', Icon: ExclamationTriangleIcon, redFlags: true },
]

const COUNTRY_FLAGS = {
  'France': '🇫🇷', 'Germany': '🇩🇪', 'Spain': '🇪🇸', 'Israel': '🇮🇱',
  'United Kingdom': '🇬🇧', 'Sweden': '🇸🇪', 'Netherlands': '🇳🇱',
}

const SOURCE_LINK = {
  hn:     { label: 'View on HackerNews', className: 'text-orange-600 hover:text-orange-700 hover:bg-orange-50' },
  github: { label: 'View on GitHub', className: 'text-purple-600 hover:text-purple-700 hover:bg-purple-50' },
  rss:    { label: 'Read Article',   className: 'text-sky-600 hover:text-sky-700 hover:bg-sky-50' },
}

const FOCUSABLE_SELECTORS =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreRing({ score }) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const pct = Math.min(100, Math.max(0, score || 0))
  const offset = circumference - (pct / 100) * circumference
  const colors = getScoreColor(pct)

  return (
    <div
      className="relative w-24 h-24 flex items-center justify-center shrink-0"
      role="img"
      aria-label={`Fit score: ${Math.round(pct)} out of 100`}
    >
      <svg className="-rotate-90 absolute" width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="6" />
        <circle
          cx="48" cy="48" r={radius}
          fill="none"
          stroke={colors.hex}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="relative z-10 text-center" aria-hidden="true">
        <div className="text-2xl font-bold" style={{ color: colors.hex }}>{Math.round(pct)}</div>
        <div className="text-xs text-slate-400 -mt-0.5">/100</div>
      </div>
    </div>
  )
}

function MemoSection({ Icon, label, content, redFlags }) {
  const isRedFlags = !!redFlags
  return (
    <div className={`rounded-xl p-4 border ${isRedFlags ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={isRedFlags ? 'text-amber-600' : 'text-slate-500'}>
          <Icon />
        </span>
        <h4 className={`font-semibold text-sm ${isRedFlags ? 'text-amber-800' : 'text-slate-700'}`}>
          {label}
        </h4>
      </div>
      {content ? (
        <p className={`text-sm leading-relaxed break-words ${isRedFlags ? 'text-amber-900' : 'text-slate-600'}`}>
          {content}
        </p>
      ) : (
        <div className="space-y-2" aria-hidden="true">
          <div className="skeleton h-3 w-full rounded" />
          <div className="skeleton h-3 w-5/6 rounded" />
        </div>
      )}
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function MemoModal({ startup: initialStartup, onClose, onUpdated }) {
  const [startup, setStartup] = useState(initialStartup)
  const [generating, setGenerating] = useState(false)
  const [rescoring, setRescoring] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const modalRef = useRef(null)
  const prevFocusRef = useRef(null)
  const chatBottomRef = useRef(null)

  const hasMemo = MEMO_SECTIONS.some(s => startup[s.key])
  const score = startup.fit_score
  const colors = score != null ? getScoreColor(score) : null
  const flag = COUNTRY_FLAGS[startup.country] || '🌍'
  const extLink = startup.hn_url ? SOURCE_LINK[startup.source] : null

  // On open: save previously focused element, move focus into modal
  useEffect(() => {
    prevFocusRef.current = document.activeElement
    const focusable = modalRef.current?.querySelectorAll(FOCUSABLE_SELECTORS)
    focusable?.[0]?.focus()
    return () => { prevFocusRef.current?.focus() }
  }, [])

  // Focus trap + keyboard handling
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key !== 'Tab') return

    const focusable = Array.from(modalRef.current?.querySelectorAll(FOCUSABLE_SELECTORS) ?? [])
    if (!focusable.length) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus() }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus() }
    }
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

  const handleStatusChange = async (newStatus) => {
    setStatusUpdating(true)
    try {
      const updated = await updateStatus(startup.id, newStatus)
      setStartup(updated)
      onUpdated?.(updated)
    } catch (e) {
      console.error('Status update failed', e)
    } finally {
      setStatusUpdating(false)
    }
  }

  const handleChatSend = async (text) => {
    const msg = (text ?? chatInput).trim()
    if (!msg || chatSending) return
    const userMsg = { role: 'user', content: msg }
    setChatMessages(prev => [...prev, userMsg])
    setChatInput('')
    setChatSending(true)
    try {
      const { reply } = await chatWithStartup(startup.id, msg, chatMessages)
      setChatMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    } finally {
      setChatSending(false)
    }
  }

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, chatSending])

  return (
    <div
      className="modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={modalRef}
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-startup-name"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-elaia-navy px-6 py-5 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-start gap-5 min-w-0">
            <ScoreRing score={startup.fit_score} />
            <div className="text-white pt-1 min-w-0">
              <h2 id="modal-startup-name" className="text-xl font-bold leading-tight break-words">
                {startup.name}
              </h2>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-teal-100 text-sm">{startup.sector}</span>
                <span className="text-white/30" aria-hidden="true">·</span>
                <span className="text-teal-100 text-sm">{startup.stage}</span>
                <span className="text-white/30" aria-hidden="true">·</span>
                <span className="text-teal-100 text-sm">{flag} {startup.country}</span>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {colors && (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}>
                    {colors.label}
                  </span>
                )}
                <select
                  value={startup.status || 'Sourced'}
                  onChange={e => handleStatusChange(e.target.value)}
                  disabled={statusUpdating}
                  aria-label="Pipeline status"
                  className={`appearance-none text-xs font-medium rounded-full px-2.5 py-1 cursor-pointer
                    focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-60 border-0
                    ${getStatusClass(startup.status || 'Sourced')}`}
                >
                  {PIPELINE_STATUSES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">

          {startup.founders && (
            <div className="flex items-start gap-2 mb-4 text-sm text-slate-600">
              <span className="font-medium text-slate-500 shrink-0">Founders:</span>
              <span className="break-words">{startup.founders}</span>
            </div>
          )}

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-5">
            <p className="text-sm text-slate-600 leading-relaxed break-words">{startup.description}</p>
            {startup.website && (
              <a href={startup.website} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-elaia-navy text-xs mt-2 hover:underline break-all">
                {startup.website} ↗
              </a>
            )}
          </div>

          {startup.score_rationale && (
            <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 mb-5">
              <div className="text-xs font-semibold text-elaia-navy uppercase tracking-wide mb-2">
                AI Scoring Rationale
              </div>
              <p className="text-sm text-teal-900 leading-relaxed">{startup.score_rationale}</p>
              {startup.red_flag && (
                <div className="flex items-start gap-2 mt-3 pt-3 border-t border-teal-200">
                  <ExclamationTriangleIcon />
                  <p className="text-sm text-amber-800">{startup.red_flag}</p>
                </div>
              )}
            </div>
          )}

          {hasMemo ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">
                  Due Diligence Memo
                </h3>
                <button
                  onClick={handleGenerateMemo}
                  disabled={generating}
                  className="btn-ghost text-xs text-elaia-navy"
                >
                  {generating ? 'Regenerating…' : '↺ Regenerate'}
                </button>
              </div>
              {MEMO_SECTIONS.map(section => (
                <MemoSection
                  key={section.key}
                  Icon={section.Icon}
                  label={section.label}
                  content={startup[section.key]}
                  redFlags={section.redFlags}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-700 mb-1">No memo yet</h3>
              <p className="text-sm text-slate-500 mb-5">
                Generate a due diligence memo for this startup.
              </p>
              <button
                onClick={handleGenerateMemo}
                disabled={generating}
                className="btn-primary disabled:opacity-60"
              >
                {generating ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                    Generating Memo…
                  </>
                ) : (
                  <><BoltIcon /> Generate DD Memo</>
                )}
              </button>
            </div>
          )}

          {generating && !hasMemo && (
            <div className="mt-4 space-y-3" aria-busy="true" aria-label="Generating memo sections">
              {MEMO_SECTIONS.map(s => (
                <div key={s.key} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-slate-400"><s.Icon /></span>
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

          {/* ── Chat panel ── */}
          <div className="mt-6 border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-elaia-navy">
              <span className="text-white/80"><ChatIcon /></span>
              <span className="text-sm font-semibold text-white">Ask Claude about {startup.name}</span>
            </div>

            {/* Message list */}
            <div className="h-56 overflow-y-auto px-4 py-3 space-y-3 bg-white">
              {chatMessages.length === 0 && !chatSending && (
                <div>
                  <p className="text-xs text-slate-400 mb-2">Suggested questions:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTED_QUESTIONS.map(q => (
                      <button
                        key={q}
                        onClick={() => handleChatSend(q)}
                        className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-elaia-navy hover:text-white transition-colors ring-1 ring-slate-200"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-elaia-navy text-white rounded-tr-sm'
                      : 'bg-slate-100 text-slate-700 rounded-tl-sm'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {chatSending && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-2.5">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input row */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-t border-slate-100 bg-slate-50">
              <textarea
                rows={1}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend() }
                }}
                placeholder="Ask anything about this startup…"
                disabled={chatSending}
                className="flex-1 resize-none bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800
                  placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-elaia-accent focus:border-transparent
                  disabled:opacity-50"
              />
              <button
                onClick={() => handleChatSend()}
                disabled={!chatInput.trim() || chatSending}
                className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-elaia-navy text-white
                  hover:opacity-90 disabled:opacity-40 transition-opacity"
                aria-label="Send message"
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0 flex-wrap gap-2">
          <div className="flex gap-2 flex-wrap">
            {startup.website && (
              <a href={startup.website} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs">
                Visit Website ↗
              </a>
            )}
            {extLink && (
              <a
                href={startup.hn_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`btn-ghost text-xs ${extLink.className}`}
              >
                {extLink.label}
              </a>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={handleRescore} disabled={rescoring} className="btn-secondary text-xs disabled:opacity-60">
              {rescoring ? 'Rescoring…' : '↺ Rescore'}
            </button>
            <button onClick={onClose} className="btn-secondary text-xs">Close</button>
          </div>
        </div>
      </div>
    </div>
  )
}
