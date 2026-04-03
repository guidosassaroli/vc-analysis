export default function LoadingOverlay({ message = 'Loading…' }) {
  return (
    <div className="fixed inset-0 bg-brand-navy/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-4 max-w-sm mx-4">
        {/* Animated logo */}
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-[3px] border-slate-100" />
          <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-brand-accent animate-spin" />
          <div className="absolute inset-2.5 rounded-full bg-slate-50 flex items-center justify-center">
            <span className="text-brand-accent font-semibold text-sm tracking-tight">VC</span>
          </div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-slate-800">{message}</div>
        </div>
      </div>
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <div className="skeleton h-5 w-20 rounded-full" />
            <div className="skeleton h-5 w-16 rounded-full" />
          </div>
          <div className="skeleton h-5 w-40 rounded" />
          <div className="skeleton h-4 w-24 rounded" />
        </div>
        <div className="skeleton w-14 h-14 rounded-full shrink-0" />
      </div>
      <div className="space-y-2 mb-4">
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-5/6 rounded" />
        <div className="skeleton h-3 w-4/5 rounded" />
      </div>
      <div className="skeleton h-9 w-full rounded-lg" />
    </div>
  )
}
