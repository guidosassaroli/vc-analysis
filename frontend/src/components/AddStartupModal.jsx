import { useState, useEffect, useRef } from 'react'
import { startupFromUrl } from '../api'

const LinkIcon = () => (
  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
  </svg>
)

export default function AddStartupModal({ onClose, onAdded }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const isValidUrl = /^https?:\/\/.+/.test(url.trim())

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValidUrl || loading) return
    setLoading(true)
    setError(null)
    try {
      const startup = await startupFromUrl(url.trim())
      onAdded(startup)
      onClose()
    } catch (err) {
      const msg = err.message || 'Could not fetch startup info. Check the URL and try again.'
      setError(msg)
      setLoading(false)
    }
  }

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-startup-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="modal-content max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <LinkIcon />
            <h2 id="add-startup-title" className="text-lg font-bold text-slate-900">
              Add startup from URL
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="startup-url" className="block text-sm font-medium text-slate-700 mb-1.5">
              Website URL
            </label>
            <input
              ref={inputRef}
              id="startup-url"
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(null) }}
              placeholder="https://…"
              className="w-full bg-white border border-slate-200 text-slate-800 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-elaia-accent focus:border-transparent hover:border-slate-300 transition-colors"
              disabled={loading}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 mb-4">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-2 px-4">
                <span className="w-4 h-4 border-2 border-slate-300 border-t-elaia-accent rounded-full animate-spin" aria-hidden="true" />
                Fetching…
              </div>
            ) : (
              <button
                type="submit"
                disabled={!isValidUrl}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Fetch &amp; Add
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
