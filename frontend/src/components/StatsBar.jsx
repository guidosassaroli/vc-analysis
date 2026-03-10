const statItems = [
  { key: 'total', label: 'Total Startups', icon: '🏢', color: 'text-slate-700' },
  { key: 'scored', label: 'Scored by AI', icon: '🤖', color: 'text-blue-600' },
  { key: 'high_fit', label: 'High Fit (≥70)', icon: '🎯', color: 'text-emerald-600' },
  { key: 'sectors', label: 'Sectors', icon: '📊', color: 'text-violet-600' },
  { key: 'countries', label: 'Countries', icon: '🌍', color: 'text-amber-600' },
  { key: 'avg_score', label: 'Avg Fit Score', icon: '📈', color: 'text-blue-600', suffix: '/100' },
]

export default function StatsBar({ stats }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
        {statItems.map(item => (
          <div key={item.key} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="skeleton h-6 w-12 rounded mb-2" />
            <div className="skeleton h-3 w-20 rounded" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
      {statItems.map(item => (
        <div
          key={item.key}
          className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow"
        >
          <div className={`text-2xl font-bold ${item.color} leading-none mb-1`}>
            {stats[item.key] ?? '—'}
            {item.suffix && (
              <span className="text-sm font-normal text-slate-400">{item.suffix}</span>
            )}
          </div>
          <div className="text-xs text-slate-500 font-medium flex items-center gap-1">
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
