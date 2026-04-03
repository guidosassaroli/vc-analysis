import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getConfig, saveConfig } from '../api'

const XIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const ALL_GEOGRAPHIES = [
  'France', 'Germany', 'Spain', 'Israel',
  'United Kingdom', 'Sweden', 'Netherlands', 'Switzerland', 'Finland', 'Denmark',
]

const ALL_SECTORS = [
  'AI/ML', 'Biotech', 'Quantum', 'Cybersecurity',
  'Climate Tech', 'Semiconductors', 'Fintech', 'Industrial Robotics', 'Software',
]

const ALL_STAGES = ['Pre-Seed', 'Seed', 'Series A', 'Series B']

const DEFAULT_THESIS = {
  geographies: ['France', 'Germany', 'Spain', 'Israel'],
  sectors: ['AI/ML', 'Biotech', 'Quantum', 'Cybersecurity', 'Climate Tech', 'Semiconductors', 'Fintech', 'Industrial Robotics'],
  stages: ['Pre-Seed', 'Seed', 'Series A'],
  team_signal: 'Academic/PhD founders, university spinoffs, CNRS/INRIA/Pasteur/Fraunhofer/Weizmann/Unit 8200 backgrounds, prior exits',
  tech_signal: 'Proprietary research, patents, novel algorithms, hardware IP, deep tech defensibility',
  exclusions: 'Pure SaaS with no deep tech differentiation, US-only focused companies, B2C consumer apps, commodity tech with no IP protection',
}

function parseThesis(raw) {
  if (!raw) return { ...DEFAULT_THESIS }
  try {
    const parsed = JSON.parse(raw)
    // Merge with defaults so missing keys are filled in
    return { ...DEFAULT_THESIS, ...parsed }
  } catch {
    return { ...DEFAULT_THESIS }
  }
}

function CheckboxGroup({ label, options, selected, onChange }) {
  const toggle = (item) => {
    const next = selected.includes(item)
      ? selected.filter(x => x !== item)
      : [...selected, item]
    onChange(next)
  }

  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const active = selected.includes(opt)
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors ${
                active
                  ? 'bg-brand-accent/10 border-brand-accent/30 text-brand-accent'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function SettingsModal({ onClose }) {
  const { session } = useAuth()
  const [thesis, setThesis] = useState(DEFAULT_THESIS)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const overlayRef = useRef(null)
  const firstFocusRef = useRef(null)

  useEffect(() => {
    firstFocusRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    getConfig().then(cfg => {
      setThesis(parseThesis(cfg?.thesis_notes))
    }).catch(() => {})
  }, [])

  const set = (key, value) => setThesis(prev => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveConfig({ thesis_notes: JSON.stringify(thesis) })
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="font-semibold text-slate-900">Investment Thesis</h2>
            <p className="text-xs text-slate-400 mt-0.5">These settings shape every AI score and memo.</p>
          </div>
          <button
            ref={firstFocusRef}
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close settings"
          >
            <XIcon />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="px-6 py-5 space-y-6 overflow-y-auto">

          {/* Account */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Account</p>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{session?.user?.email ?? 'dev@local'}</p>
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

          {/* Geographies */}
          <CheckboxGroup
            label="Focus Geographies"
            options={ALL_GEOGRAPHIES}
            selected={thesis.geographies}
            onChange={v => set('geographies', v)}
          />

          {/* Sectors */}
          <CheckboxGroup
            label="Target Sectors"
            options={ALL_SECTORS}
            selected={thesis.sectors}
            onChange={v => set('sectors', v)}
          />

          {/* Stages */}
          <CheckboxGroup
            label="Investment Stages"
            options={ALL_STAGES}
            selected={thesis.stages}
            onChange={v => set('stages', v)}
          />

          {/* Team signal */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Team Signal</p>
            <p className="text-xs text-slate-400 mb-2">What makes a strong founding team for your fund?</p>
            <textarea
              value={thesis.team_signal}
              onChange={e => set('team_signal', e.target.value)}
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30 focus:border-brand-accent transition-colors resize-none"
            />
          </div>

          {/* Tech signal */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Technology Signal</p>
            <p className="text-xs text-slate-400 mb-2">What counts as a strong technical moat?</p>
            <textarea
              value={thesis.tech_signal}
              onChange={e => set('tech_signal', e.target.value)}
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30 focus:border-brand-accent transition-colors resize-none"
            />
          </div>

          {/* Exclusions */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Exclusions / Weak Fit</p>
            <p className="text-xs text-slate-400 mb-2">What should the AI penalise or avoid?</p>
            <textarea
              value={thesis.exclusions}
              onChange={e => set('exclusions', e.target.value)}
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30 focus:border-brand-accent transition-colors resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center shrink-0">
          <button
            type="button"
            onClick={() => setThesis({ ...DEFAULT_THESIS })}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Reset to defaults
          </button>
          <div className="flex gap-2">
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
    </div>
  )
}
