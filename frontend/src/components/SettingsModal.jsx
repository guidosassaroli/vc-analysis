import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getConfig, saveConfig } from '../api'

const XIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
)

export default function SettingsModal({ onClose }) {
  const { session } = useAuth()
  const [thesisNotes, setThesisNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const overlayRef = useRef(null)
  const firstFocusRef = useRef(null)

  // Focus trap
  useEffect(() => {
    firstFocusRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Load config on open
  useEffect(() => {
    getConfig().then(cfg => {
      if (cfg?.thesis_notes) setThesisNotes(cfg.thesis_notes)
    }).catch(() => {})
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveConfig({ thesis_notes: thesisNotes })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    await supabase?.auth.signOut()
    window.location.replace('/login')
  }

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose()
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Settings</h2>
          <button
            ref={firstFocusRef}
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close settings"
          >
            <XIcon />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6">
          {/* Account */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Account</h3>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {session?.user?.email ?? 'dev@local'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Signed in</p>
              </div>
              {supabase && (
                <button
                  onClick={handleSignOut}
                  className="text-xs font-medium text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Sign out
                </button>
              )}
            </div>
          </div>

          {/* Thesis notes */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Custom Thesis Notes
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              These notes are appended to every AI scoring prompt — use them to refine what the model prioritises for your portfolio.
            </p>
            <textarea
              value={thesisNotes}
              onChange={e => setThesisNotes(e.target.value)}
              rows={5}
              placeholder="e.g. We only invest in companies with at least one technical founder with a PhD. We are particularly interested in quantum hardware and defence-grade cybersecurity."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-elaia-navy/30 focus:border-elaia-navy transition-colors resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="btn bg-slate-100 hover:bg-slate-200 text-slate-700">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
