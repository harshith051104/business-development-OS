/**
 * One priority palette for badges, chart bars and legends (validated for the dark
 * surface; High and Medium sit close for deuteranopia, so a text label always
 * accompanies the colour).
 */
export const PRIORITY_ORDER = ['High', 'Medium', 'Low'] as const
export type PriorityName = (typeof PRIORITY_ORDER)[number]

export const PRIORITY_COLORS: Record<PriorityName, string> = {
  High: '#ef4f6a',
  Medium: '#c98316',
  Low: '#3b9ae0',
}

export const UNKNOWN_PRIORITY_COLOR = '#6b6787'

export function normalizePriority(p?: string | null): PriorityName | null {
  const v = (p || '').trim().toLowerCase()
  if (v === 'high') return 'High'
  if (v === 'medium') return 'Medium'
  if (v === 'low') return 'Low'
  return null
}

export const priorityColor = (p?: string | null) => {
  const n = normalizePriority(p)
  return n ? PRIORITY_COLORS[n] : UNKNOWN_PRIORITY_COLOR
}
