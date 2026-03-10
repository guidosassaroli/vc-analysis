import { useState, useEffect, useCallback, useMemo } from 'react'
import Header from './components/Header'
import StatsBar from './components/StatsBar'
import FilterBar from './components/FilterBar'
import StartupCard from './components/StartupCard'
import MemoModal from './components/MemoModal'
import { SkeletonCard } from './components/LoadingOverlay'
import { getStartups, getStats } from './api'

const DEFAULT_FILTERS = {
  sector: 'All',
  stage: 'All',
  country: 'All',
  source: 'all',
  min_score: 0,
  search: '',
}

function EmptyState({ filters, onReset }) {
  const hasFilters = Object.entries(filters).some(([k, v]) =>
    k !== 'search' ? v !== 'All' && v !== 'all' && v !== 0 : v !== ''
  )
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
      <div className="text-6xl mb-4">🔭</div>
      <h3 className="text-lg font-semibold text-slate-700 mb-2">No startups found</h3>
      <p className="text-slate-500 text-sm mb-6 max-w-sm">
        {hasFilters
          ? 'Try adjusting your filters or clearing them to see more results.'
          : 'Click "Refresh Feed" to fetch startups from HackerNews, or "Score All" to score the seeded data.'}
      </p>
      {hasFilters && (
        <button onClick={onReset} className="btn-primary">
          Clear Filters
        </button>
      )}
    </div>
  )
}

export default function App() {
  const [allStartups, setAllStartups] = useState([])
  const [stats, setStats] = useState(null)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedStartup, setSelectedStartup] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [startupsData, statsData] = await Promise.all([
        getStartups(),
        getStats(),
      ])
      setAllStartups(startupsData)
      setStats(statsData)
    } catch (err) {
      console.error('Fetch failed:', err)
      setError('Failed to connect to the backend. Make sure the API server is running on port 8000.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Client-side filtering (search + server-side handled by API)
  const filteredStartups = useMemo(() => {
    let result = [...allStartups]

    if (filters.sector && filters.sector !== 'All') {
      result = result.filter(s => s.sector === filters.sector)
    }
    if (filters.stage && filters.stage !== 'All') {
      result = result.filter(s => s.stage === filters.stage)
    }
    if (filters.country && filters.country !== 'All') {
      result = result.filter(s => s.country === filters.country)
    }
    if (filters.source && filters.source !== 'all') {
      result = result.filter(s => s.source === filters.source)
    }
    if (filters.min_score > 0) {
      result = result.filter(s => s.fit_score != null && s.fit_score >= filters.min_score)
    }
    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        (s.founders || '').toLowerCase().includes(q) ||
        s.sector.toLowerCase().includes(q) ||
        s.country.toLowerCase().includes(q)
      )
    }

    return result
  }, [allStartups, filters])

  const handleStartupUpdated = (updated) => {
    setAllStartups(prev => prev.map(s => s.id === updated.id ? updated : s))
    if (selectedStartup?.id === updated.id) {
      setSelectedStartup(updated)
    }
    // Refresh stats
    getStats().then(setStats).catch(console.error)
  }

  const handleRefresh = () => fetchData()
  const handleScoreAll = () => fetchData()
  const handleCleared = () => fetchData()
  const handleReset = () => setFilters(DEFAULT_FILTERS)

  return (
    <div className="min-h-screen bg-slate-50">
      <Header onRefresh={handleRefresh} onScoreAll={handleScoreAll} onCleared={handleCleared} />

      <main className="max-w-screen-2xl mx-auto px-6 py-8">
        {/* Stats Bar */}
        <StatsBar stats={stats} />

        {/* Page Title */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Deal Flow Pipeline</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              AI-scored opportunities matched against Elaia's investment thesis
            </p>
          </div>
          {!loading && allStartups.length > 0 && (
            <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Strong fit ≥70
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Moderate 40–70
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" /> Weak fit &lt;40
              </span>
            </div>
          )}
        </div>

        {/* Filter Bar */}
        <FilterBar
          filters={filters}
          onChange={setFilters}
          totalShown={filteredStartups.length}
          totalAll={allStartups.length}
        />

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center mb-6">
            <div className="text-2xl mb-2">⚠️</div>
            <p className="text-red-700 font-medium">{error}</p>
            <button
              onClick={fetchData}
              className="btn-primary mt-4 bg-red-600 hover:bg-red-700 focus:ring-red-500"
            >
              Retry
            </button>
          </div>
        )}

        {/* Card Grid */}
        {!error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
            ) : filteredStartups.length === 0 ? (
              <EmptyState filters={filters} onReset={handleReset} />
            ) : (
              filteredStartups.map(startup => (
                <StartupCard
                  key={startup.id}
                  startup={startup}
                  onViewMemo={setSelectedStartup}
                  onScored={handleStartupUpdated}
                />
              ))
            )}
          </div>
        )}

        {/* Footer */}
        {!loading && !error && (
          <div className="mt-12 pb-6 text-center text-xs text-slate-400">
            <p>
              Elaia Partners Deal Flow Intelligence · Confidential internal tool
              · Scoring powered by Claude AI
            </p>
          </div>
        )}
      </main>

      {/* Memo Modal */}
      {selectedStartup && (
        <MemoModal
          startup={selectedStartup}
          onClose={() => setSelectedStartup(null)}
          onUpdated={handleStartupUpdated}
        />
      )}
    </div>
  )
}
