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
  { value: 'all', label: 'All sources' },
  { value: 'seed', label: 'Curated' },
  { value: 'hn', label: 'HackerNews' },
  { value: 'github', label: 'GitHub' },
  { value: 'rss', label: 'News' },
  { value: 'manual', label: 'Added' },
]

const SearchIcon = () => (
  <svg className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
)

const selectClass = [
  'bg-white border border-slate-200 text-slate-700 text-[13px] rounded-lg',
  'px-3 py-[7px] focus:outline-none focus:ring-2 focus:ring-brand-accent/30 focus:border-brand-accent',
  'cursor-pointer hover:border-slate-300 transition-colors appearance-none',
  'bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2394a3b8\' stroke-width=\'2\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")] bg-no-repeat bg-right-2 bg-[length:14px_14px] pr-8',
].join(' ')

const FilterSelect = ({ id, label, value, onChange, options }) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={id} className="section-label">{label}</label>
    <select
      id={id}
      value={value}
      onChange={e => onChange(e.target.value)}
      className={selectClass}
    >
      {options.map(opt => (
        <option
          key={typeof opt === 'string' ? opt : opt.value}
          value={typeof opt === 'string' ? opt : opt.value}
        >
          {typeof opt === 'string' ? opt : opt.label}
        </option>
      ))}
    </select>
  </div>
)

export default function FilterBar({ filters, onChange, totalShown, totalAll }) {
  const [search, setSearch] = useState('')
  const filtersRef = useRef(filters)
  useEffect(() => { filtersRef.current = filters }, [filters])

  useEffect(() => {
    const timer = setTimeout(() => {
      onChange({ ...filtersRef.current, search })
    }, 280)
    return () => clearTimeout(timer)
  }, [search])

  const activeFilterCount = [
    filters.sector !== 'All',
    filters.stage !== 'All',
    filters.country !== 'All',
    filters.source !== 'all',
    filters.min_score > 0,
  ].filter(Boolean).length

  const handleReset = () => {
    setSearch('')
    onChange({ sector: 'All', stage: 'All', country: 'All', source: 'all', min_score: 0, search: '' })
  }

  return (
    <div className="bg-white border border-slate-200/70 rounded-xl mb-6 px-4 py-3.5"
         style={{ boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.03)' }}>
      <div className="flex flex-wrap items-end gap-3">

        {/* Search */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
          <label htmlFor="startup-search" className="section-label">Search</label>
          <div className="relative">
            <SearchIcon />
            <input
              id="startup-search"
              type="text"
              placeholder="Name, description, founder…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-700 text-[13px] rounded-lg pl-8 pr-3 py-[7px] focus:outline-none focus:ring-2 focus:ring-brand-accent/30 focus:border-brand-accent hover:border-slate-300 transition-colors"
            />
          </div>
        </div>

        <FilterSelect id="sector-filter" label="Sector"  value={filters.sector}  onChange={v => onChange({ ...filters, sector: v })}  options={SECTORS} />
        <FilterSelect id="stage-filter"  label="Stage"   value={filters.stage}   onChange={v => onChange({ ...filters, stage: v })}   options={STAGES} />
        <FilterSelect id="country-filter" label="Country" value={filters.country} onChange={v => onChange({ ...filters, country: v })} options={COUNTRIES} />
        <FilterSelect id="source-filter"  label="Source"  value={filters.source}  onChange={v => onChange({ ...filters, source: v })}  options={SOURCES} />

        {/* Score slider */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="min-score-slider" className="section-label">
            Min score
            {filters.min_score > 0 && (
              <span className="ml-1.5 font-semibold text-brand-accent normal-case tracking-normal numeral">
                {filters.min_score}+
              </span>
            )}
          </label>
          <input
            id="min-score-slider"
            type="range"
            min="0" max="90" step="10"
            value={filters.min_score || 0}
            onChange={e => onChange({ ...filters, min_score: Number(e.target.value) })}
            className="w-28 accent-brand-accent cursor-pointer h-[7px] mt-[5px]"
            aria-label={`Minimum fit score: ${filters.min_score || 0}`}
          />
        </div>

        {/* Count + reset */}
        <div className="flex items-end gap-3 ml-auto pb-px">
          <span className="text-[13px] text-slate-400">
            <span className="font-semibold text-slate-600 numeral">{totalShown}</span>
            {totalAll !== totalShown && <span className="numeral"> / {totalAll}</span>}
            <span> companies</span>
          </span>
          {activeFilterCount > 0 && (
            <button
              onClick={handleReset}
              className="text-[12.5px] font-medium text-brand-accent hover:text-brand-dark transition-colors"
            >
              Clear {activeFilterCount > 1 ? `${activeFilterCount} filters` : 'filter'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
