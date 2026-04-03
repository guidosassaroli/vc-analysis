import { useState, useRef, useEffect } from 'react'
import { scoreAll, exportPdf, clearAll } from '../api'
import { useAuth } from '../context/AuthContext'

const Logo = () => (
  <svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <polygon points="4,28 8,28 10,20 6,20" fill="white" opacity="0.5" />
    <polygon points="11,28 15,28 19,14 15,14" fill="white" opacity="0.75" />
    <polygon points="18,28 22,28 27,7 23,7" fill="white" />
    <circle cx="26" cy="4" r="2.5" fill="white" />
  </svg>
)

const Divider = () => (
  <div className="w-px h-4 bg-white/10 mx-0.5" aria-hidden="true" />
)

const GearIcon = () => (
  <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const AddIcon = () => (
  <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
)

const TrashIcon = () => (
  <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const BoltIcon = () => (
  <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
)

const DownloadIcon = () => (
  <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
)

// Shared button style for header (on dark bg)
const headerBtn = 'inline-flex items-center justify-center gap-1.5 px-3 py-[6px] rounded-md text-[12.5px] font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-1 focus:ring-offset-[#0f172a] whitespace-nowrap'
const headerBtnGhost = `${headerBtn} text-white/50 hover:text-white hover:bg-white/8`
const headerBtnSecondary = `${headerBtn} text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20`
const headerBtnPrimary = `${headerBtn} bg-brand-accent text-white hover:bg-brand-accent/90 shadow-sm`

export default function Header({ onScoreAll, onCleared, onAdd, onOpenSettings }) {
  const { session } = useAuth()
  const userEmail = session?.user?.email
  const [scoring, setScoring] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [toast, setToast] = useState(null)
  const confirmTimerRef = useRef(null)

  useEffect(() => () => clearTimeout(confirmTimerRef.current), [])

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
    } catch {
      showToast('Scoring failed — verify your Anthropic API key.', 'error')
    } finally {
      setScoring(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportPdf()
      showToast('PDF downloaded.')
    } catch {
      showToast('PDF export failed.', 'error')
    } finally {
      setExporting(false)
    }
  }

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
    } catch {
      showToast('Reset failed.', 'error')
    } finally {
      setClearing(false)
    }
  }

  return (
    <>
      <header className="bg-brand-navy border-b border-white/[0.06] sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-5 h-[52px] flex items-center justify-between gap-4">

          {/* Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Logo />
            <div className="flex items-baseline gap-2">
              <span className="text-white font-semibold tracking-tight text-[14px] leading-none">
                Deal Flow Intelligence
              </span>
              {/* <a
                href="https://www.linkedin.com/in/guido-sassaroli-778548169/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/25 hover:text-white/50 text-[11px] hidden md:block transition-colors"
              >
                by Guido Sassaroli
              </a> */}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">

            {/* User + settings */}
            {userEmail && (
              <span className="text-white/25 text-[11px] mr-1 hidden lg:block max-w-[150px] truncate" title={userEmail}>
                {userEmail}
              </span>
            )}
            <button
              onClick={onOpenSettings}
              className={headerBtnGhost}
              aria-label="Settings"
              title="Settings"
            >
              <GearIcon />
            </button>

            <Divider />

            {/* Add startup */}
            <button onClick={onAdd} className={headerBtnSecondary} title="Add a startup by URL">
              <AddIcon />
              <span className="hidden sm:inline">Add</span>
            </button>

            <Divider />

            {/* Destructive */}
            <button
              onClick={handleClearClick}
              disabled={clearing}
              title={confirmingClear ? 'Click again to confirm' : 'Clear all and restore seed list'}
              aria-label={confirmingClear ? 'Confirm clear all' : 'Clear all startups'}
              className={`${confirmingClear
                ? `${headerBtn} bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30`
                : `${headerBtnGhost}`
              } disabled:opacity-40`}
            >
              {clearing
                ? <span className="w-3.5 h-3.5 border-[1.5px] border-white/20 border-t-white rounded-full animate-spin" />
                : <TrashIcon />
              }
              <span className="hidden sm:inline">
                {clearing ? 'Clearing…' : confirmingClear ? 'Confirm?' : 'Clear'}
              </span>
            </button>

            {/* Score all */}
            <button
              onClick={handleScoreAll}
              disabled={scoring}
              className={`${headerBtnPrimary} disabled:opacity-50 ml-0.5`}
            >
              {scoring
                ? <span className="w-3.5 h-3.5 border-[1.5px] border-white/30 border-t-white rounded-full animate-spin" />
                : <BoltIcon />
              }
              <span className="hidden sm:inline">{scoring ? 'Scoring…' : 'Score All'}</span>
            </button>

            {/* Export */}
            <button
              onClick={handleExport}
              disabled={exporting}
              className={`${headerBtnGhost} disabled:opacity-40`}
              title="Export top 10 as PDF"
            >
              {exporting
                ? <span className="w-3.5 h-3.5 border-[1.5px] border-white/20 border-t-white rounded-full animate-spin" />
                : <DownloadIcon />
              }
              <span className="hidden md:inline">{exporting ? 'Exporting…' : 'Export'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
          aria-atomic="true"
          className={`fixed bottom-5 right-5 z-50 animate-slide-up flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-[13px] font-medium max-w-xs ${
            toast.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-brand-navy text-white'
          }`}
        >
          <span aria-hidden="true" className="shrink-0">{toast.type === 'error' ? '⚠' : '✓'}</span>
          <span>{toast.msg}</span>
        </div>
      )}
    </>
  )
}
