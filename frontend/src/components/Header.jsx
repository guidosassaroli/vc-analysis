import { useState, useRef, useEffect } from 'react'
import { refreshFeed, scoreAll, exportPdf, clearAll } from '../api'

const ElaiaLogo = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="32" height="32" rx="7" fill="#2563eb" />
    <path d="M8 10h16M8 16h12M8 22h16" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
)

const RefreshIcon = ({ spinning }) => (
  <svg
    className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`}
    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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

export default function Header({ onRefresh, onScoreAll, onCleared, onAdd }) {
  const [refreshing, setRefreshing] = useState(false)
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

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const result = await refreshFeed()
      showToast(`${result.message}`)
      onRefresh?.()
    } catch (e) {
      showToast('Could not fetch new startups — check your connection.', 'error')
    } finally {
      setRefreshing(false)
    }
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
      <header className="bg-elaia-navy border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <ElaiaLogo />
            <div>
              <div className="text-white font-bold text-lg leading-none tracking-tight">
                Elaia
              </div>
              <div className="text-blue-300 text-xs font-medium mt-0.5 tracking-wide uppercase">
                Deal Flow Intelligence
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onAdd}
              className="btn bg-teal-600 hover:bg-teal-500 text-white"
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
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn bg-white/10 hover:bg-white/20 text-white border border-white/20 disabled:opacity-50"
              title="Fetch new startups from HackerNews, GitHub, and EU startup news"
            >
              <RefreshIcon spinning={refreshing} />
              <span className="hidden sm:inline">
                {refreshing ? 'Fetching…' : 'Fetch Sources'}
              </span>
            </button>

            <button
              onClick={handleScoreAll}
              disabled={scoring}
              className="btn bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
            >
              <BoltIcon />
              <span className="hidden sm:inline">
                {scoring ? 'Scoring…' : 'Score All'}
              </span>
            </button>

            <button
              onClick={handleExport}
              disabled={exporting}
              className="btn bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
            >
              <DownloadIcon />
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
              : 'bg-elaia-navy text-white'
          }`}
        >
          <span aria-hidden="true">{toast.type === 'error' ? '⚠️' : '✓'}</span>
          <span>{toast.msg}</span>
        </div>
      )}
    </>
  )
}
