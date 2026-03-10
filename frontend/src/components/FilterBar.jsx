import { useState, useEffect, useRef } from 'react'

const SECTORS = [
  'All', 'AI/ML', 'Biotech', 'Quantum', 'Cybersecurity',
  'Climate Tech', 'Semiconductors', 'Fintech', 'Industrial Robotics', 'Software',
]

const STAGES = ['All', 'Pre-Seed', 'Seed', 'Series A', 'Series B', 'Early Stage', 'Unknown']

const COUNTRIES = [
  'All', 'France', 'Germany', 'Spain', 'Israel',
  'United Kingdom', 'Sweden', 'Netherlands', 'Unknown',
]

const SOURCES = [
  { value: 'all', label: 'All Sources' },
  { value: 'seed', label: 'Curated' },
  { value: 'hn', label: 'HackerNews' },
  { value: 'github', label: 'GitHub' },
  { value: 'rss', label: 'News' },
  { value: 'manual', label: 'Added' },
]

const SearchIcon = () => (
  <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
)

const FilterSelect = ({ id, label, value, onChange, options }) => (
  <div className="flex flex-col gap-1">
    <label htmlFor={id} className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
      {label}
    </label>
    <select
      id={id}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer hover:border-slate-300 transition-colors min-w-[130px]"
    >
      {options.map(opt => (
        <option key={typeof opt === 'string' ? opt : opt.value} value={typeof opt === 'string' ? opt : opt.value}>
          {typeof opt === 'string' ? opt : opt.label}
        </option>
      ))}
    </select>
  </div>
)

export default function FilterBar({ filters, onChange, totalShown, totalAll }) {
  const [search, setSearch] = useState('')
  // Use a ref so the debounce callback always sees current filters
  // without re-running the effect on every filter change
  const filtersRef = useRef(filters)
  useEffect(() => { filtersRef.current = filters }, [filters])

  useEffect(() => {
    const timer = setTimeout(() => {
      onChange({ ...filtersRef.current, search })
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const activeFilterCount = [
    filters.sector !== 'All' && filters.sector,
    filters.stage !== 'All' && filters.stage,
    filters.country !== 'All' && filters.country,
    filters.source !== 'all' && filters.source,
    filters.min_score > 0 && `Score ≥${filters.min_score}`,
  ].filter(Boolean).length

  const handleReset = () => {
    setSearch('')
    onChange({ sector: 'All', stage: 'All', country: 'All', source: 'all', min_score: 0, search: '' })
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
      <div className="flex flex-wrap items-end gap-4">
        {/* Search */}
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label htmlFor="startup-search" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Search
          </label>
          <div className="relative">
            <SearchIcon />
            <input
              id="startup-search"
              type="text"
              placeholder="Search by name, description, or founder…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-700 text-sm rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-slate-300 transition-colors"
            />
          </div>
        </div>

        <FilterSelect
          id="sector-filter"
          label="Sector"
          value={filters.sector}
          onChange={v => onChange({ ...filters, sector: v })}
          options={SECTORS}
        />

        <FilterSelect
          id="stage-filter"
          label="Stage"
          value={filters.stage}
          onChange={v => onChange({ ...filters, stage: v })}
          options={STAGES}
        />

        <FilterSelect
          id="country-filter"
          label="Country"
          value={filters.country}
          onChange={v => onChange({ ...filters, country: v })}
          options={COUNTRIES}
        />

        <FilterSelect
          id="source-filter"
          label="Source"
          value={filters.source}
          onChange={v => onChange({ ...filters, source: v })}
          options={SOURCES}
        />

        {/* Min score slider */}
        <div className="flex flex-col gap-1">
          <label htmlFor="min-score-slider" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Min Score: <span className="text-blue-600">{filters.min_score || 0}</span>
          </label>
          <input
            id="min-score-slider"
            type="range"
            min="0"
            max="90"
            step="10"
            value={filters.min_score || 0}
            onChange={e => onChange({ ...filters, min_score: Number(e.target.value) })}
            className="w-32 accent-blue-600 cursor-pointer"
            aria-label={`Minimum fit score: ${filters.min_score || 0} out of 100`}
          />
        </div>

        {/* Results + Reset */}
        <div className="flex items-end gap-3 ml-auto">
          <span className="text-sm text-slate-500 pb-2">
            <span className="font-semibold text-slate-700">{totalShown}</span>
            {totalAll !== totalShown && <span> of {totalAll}</span>}
            <span> startups</span>
          </span>
          {activeFilterCount > 0 && (
            <button
              onClick={handleReset}
              className="btn-ghost text-sm pb-2 text-blue-600 hover:text-blue-700"
            >
              Clear filters ({activeFilterCount})
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
