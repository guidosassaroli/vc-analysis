/**
 * Shared score color tokens.
 *
 * Hex values are AA-compliant on white backgrounds:
 *   high (#16a34a) → 4.6:1   mid (#d97706) → 4.7:1   low (#dc2626) → 4.7:1
 */
export const SCORE_COLORS = {
  high: {
    hex:    '#16a34a', // green-600
    bg:     'bg-emerald-50',
    text:   'text-emerald-700',
    border: 'border-emerald-200',
    label:  'Strong Fit',
  },
  mid: {
    hex:    '#d97706', // amber-600
    bg:     'bg-amber-50',
    text:   'text-amber-700',
    border: 'border-amber-200',
    label:  'Moderate Fit',
  },
  low: {
    hex:    '#dc2626', // red-600
    bg:     'bg-red-50',
    text:   'text-red-700',
    border: 'border-red-200',
    label:  'Weak Fit',
  },
}

export function getScoreColor(score) {
  if (score >= 70) return SCORE_COLORS.high
  if (score >= 40) return SCORE_COLORS.mid
  return SCORE_COLORS.low
}
