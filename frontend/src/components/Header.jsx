import { useState, useRef, useEffect } from 'react'
import { scoreAll, exportPdf, clearAll } from '../api'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const Logo = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    {/* Three ascending diagonal bars */}
    <polygon points="4,28 8,28 10,20 6,20" fill="white" />
    <polygon points="11,28 15,28 19,14 15,14" fill="white" />
    <polygon points="18,28 22,28 27,7 23,7" fill="white" />
    {/* Circle dot above rightmost bar */}
    <circle cx="26" cy="4" r="2.5" fill="white" />
  </svg>
)


const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
  </svg>
)

const BoltIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
)

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const AddLinkIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
  </svg>
)

const GearIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

export default function Header({ onScoreAll, onCleared, onAdd, onOpenSettings }) {
  const { session } = useAuth()
  const userEmail = session?.user?.email
  const [scoring, setScoring] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [toast, setToast] = useState(null)
  const confirmTimerRef = useRef(null)

  // Auto-cancel the two-step confirmation after 5 s
  useEffect(() => {
    return () => clearTimeout(confirmTimerRef.current)
  }, [])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const handleScoreAll = async () => {
    setScoring(true)
    try {
      const result = await scoreAll()
      showToast(`Scored ${result.scored} startups.`)
      onScoreAll?.()
    } catch (e) {
      showToast('Scoring failed — verify your Anthropic API key in the .env file.', 'error')
    } finally {
      setScoring(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportPdf()
      showToast('PDF downloaded successfully.')
    } catch (e) {
      showToast('PDF export failed — please try again.', 'error')
    } finally {
      setExporting(false)
    }
  }

  // Two-step confirmation: first click arms, second click fires
  const handleClearClick = () => {
    if (!confirmingClear) {
      setConfirmingClear(true)
      confirmTimerRef.current = setTimeout(() => setConfirmingClear(false), 5000)
      return
    }
    clearTimeout(confirmTimerRef.current)
    setConfirmingClear(false)
    executeClear()
  }

  const executeClear = async () => {
    setClearing(true)
    try {
      const result = await clearAll()
      showToast(result.message)
      onCleared?.()
    } catch (e) {
      showToast('Reset failed — please try again.', 'error')
    } finally {
      setClearing(false)
    }
  }

  return (
    <>
      <header className="bg-brand-navy border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <Logo />
            <div>
              <div className="text-white font-bold text-lg leading-none tracking-tight">
                Deal Flow Intelligence
              </div>
              <a
                href="https://www.linkedin.com/in/guido-sassaroli-778548169/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/50 hover:text-white/80 text-xs transition-colors"
              >
                by Guido Sassaroli ↗
              </a>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* User email + settings */}
            {userEmail && (
              <span className="hidden md:block text-white/40 text-xs mr-1 max-w-[160px] truncate" title={userEmail}>
                {userEmail}
              </span>
            )}

            <button
              onClick={onOpenSettings}
              className="btn bg-white/5 hover:bg-white/15 text-white/60 hover:text-white border border-white/10 hover:border-white/20"
              title="Settings"
              aria-label="Open settings"
            >
              <GearIcon />
            </button>

            <button
              onClick={onAdd}
              className="btn bg-white/15 hover:bg-white/25 text-white border border-white/20"
              title="Add a startup by pasting its website URL"
            >
              <AddLinkIcon />
              <span className="hidden sm:inline">Add Startup</span>
            </button>

            {/* Clear All — two-step inline confirmation */}
            <button
              onClick={handleClearClick}
              disabled={clearing}
              aria-label={confirmingClear ? 'Confirm: clear all startups' : 'Clear all startups and restore the curated seed list'}
              title={confirmingClear ? 'Click again to confirm' : 'Clear all startups and restore the curated seed list'}
              className={`btn text-white border disabled:opacity-50 transition-all duration-150 ${
                confirmingClear
                  ? 'bg-red-600 hover:bg-red-700 border-red-500'
                  : 'bg-white/5 hover:bg-red-600/80 text-white/60 hover:text-white border-white/10 hover:border-red-500'
              }`}
            >
              {clearing
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                : <TrashIcon />
              }
              <span className="hidden sm:inline">
                {clearing ? 'Clearing…' : confirmingClear ? 'Confirm?' : 'Clear All'}
              </span>
            </button>

            <button
              onClick={handleScoreAll}
              disabled={scoring}
              className="btn bg-white text-brand-navy hover:bg-white/90 disabled:opacity-50"
            >
              <BoltIcon />
              <span className="hidden sm:inline">
                {scoring ? 'Scoring…' : 'Score All'}
              </span>
            </button>

            <button
              onClick={handleExport}
              disabled={exporting}
              className="btn bg-white/10 hover:bg-white/20 text-white border border-white/20 disabled:opacity-50"
              title="Export top 10 scored startups as PDF"
            >
              {exporting
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                : <DownloadIcon />
              }
              <span className="hidden sm:inline">
                {exporting ? 'Exporting…' : 'Export PDF'}
              </span>
            </button>

          </div>
        </div>
      </header>

      {/* Toast notification — announced to screen readers */}
      {toast && (
        <div
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
          aria-atomic="true"
          className={`fixed bottom-6 right-6 z-50 animate-slide-up flex items-start gap-3 px-5 py-4 rounded-xl shadow-xl max-w-sm text-sm font-medium ${
            toast.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-brand-navy text-white'
          }`}
        >
          <span aria-hidden="true">{toast.type === 'error' ? '⚠️' : '✓'}</span>
          <span>{toast.msg}</span>
        </div>
      )}
    </>
  )
}
