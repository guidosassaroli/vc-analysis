import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Handles the magic-link / OAuth redirect from Supabase.
 * Supabase processes the URL fragment automatically via onAuthStateChange.
 * We just wait for the session and redirect home.
 */
export default function AuthCallback() {
  useEffect(() => {
    if (!supabase) { window.location.replace('/'); return }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        subscription.unsubscribe()
        window.location.replace('/')
      }
    })

    // Fallback: if already signed in (page reload), redirect immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.replace('/')
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-elaia-navy/20 border-t-elaia-navy rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500 text-sm">Signing you in…</p>
      </div>
    </div>
  )
}
