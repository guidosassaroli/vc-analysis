export const PIPELINE_STATUSES = ['Sourced', 'In Review', 'Meeting Booked', 'Term Sheet', 'Pass']

const STATUS_COLORS = {
  'Sourced':        'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  'In Review':      'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
  'Meeting Booked': 'bg-violet-100 text-violet-700 ring-1 ring-violet-200',
  'Term Sheet':     'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
  'Pass':           'bg-red-100 text-red-600 ring-1 ring-red-200',
}

export function getStatusClass(status) {
  return STATUS_COLORS[status] ?? STATUS_COLORS['Sourced']
}
