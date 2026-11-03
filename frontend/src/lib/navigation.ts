import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Compass,
  Building2,
  Send,
  Calendar,
  CalendarDays,
  Handshake,
  Sparkles,
  BarChart3,
} from 'lucide-react'

const BD = '/business-development'

export interface NavLinkDef {
  label: string
  path: string
  /** Extra URL prefixes that belong to this entry (detail pages, older URLs). */
  match?: string[]
  /** Only the exact path counts (used for section roots like the Dashboard). */
  exact?: boolean
  /** Short explanation shown under the tabs; a sub-tab's overrides its tab's. */
  description?: string
}

export interface NavTabDef extends NavLinkDef {
  subtabs?: NavLinkDef[]
}

export interface NavSectionDef {
  key: string
  label: string
  icon: LucideIcon
  path: string
  description?: string
  tabs: NavTabDef[]
  action?: NavLinkDef
}

export const NAV_SECTIONS: NavSectionDef[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: BD,
    // One page, no sub-tabs; the full task and follow-up lists open from its "View all" links.
    tabs: [{ label: 'Dashboard', path: BD, exact: true, match: [`${BD}/followups`] }],
  },
  {
    key: 'discover',
    label: 'Discover',
    icon: Compass,
    path: `${BD}/discover`,
    tabs: [
      { label: 'Find Organizations', path: `${BD}/discover` },
      { label: 'Find Investors', path: `${BD}/funding`, exact: true },
    ],
  },
  {
    key: 'crm',
    label: 'CRM',
    icon: Building2,
    path: `${BD}/organizations`,
    tabs: [
      // Opportunities live inside Organizations (column + organization detail).
      { label: 'Organizations', path: `${BD}/organizations`, match: [`${BD}/opportunities`] },
      { label: 'Contacts', path: `${BD}/contacts` },
      { label: 'Lead Tracker', path: `${BD}/leads/tracker` },
      { label: 'Map', path: `${BD}/map` },
    ],
    action: { label: 'Import', path: `${BD}/leads/import` },
  },
  {
    key: 'outreach',
    label: 'Outreach',
    icon: Send,
    path: `${BD}/outreach`,
    tabs: [
      {
        label: 'Individual',
        path: `${BD}/outreach`,
        exact: true,
        match: [`${BD}/outreach/drafts`, `${BD}/communications`, `${BD}/calls`],
        description: 'Write a personalised message to one contact. Drafts are reviewed before anything is sent.',
        subtabs: [
          { label: 'Compose', path: `${BD}/outreach`, exact: true },
          { label: 'Drafts', path: `${BD}/outreach/drafts` },
          // Kept from the removed Tracking tab so these records stay reachable.
          { label: 'Communication log', path: `${BD}/communications` },
          { label: 'Calls', path: `${BD}/calls` },
        ],
      },
      {
        label: 'Campaigns',
        path: `${BD}/campaigns`,
        description: 'Send one shared template to a selected group of contacts, step by step, with approval before each send.',
      },
    ],
  },
  {
    key: 'meetings',
    label: 'Meetings',
    icon: Calendar,
    path: `${BD}/meetings`,
    tabs: [
      { label: 'Meetings', path: `${BD}/meetings` },
      { label: 'Demos', path: `${BD}/demos` },
    ],
  },
  {
    key: 'calendar',
    label: 'Calendar',
    icon: CalendarDays,
    path: `${BD}/calendar`,
    tabs: [{ label: 'Calendar', path: `${BD}/calendar` }],
  },
  {
    key: 'deals',
    label: 'Deals',
    icon: Handshake,
    path: `${BD}/proposals`,
    description: 'After a meeting: Discussion → Proposal → Negotiation → Partnership. Update an organization’s status from its record in CRM.',
    tabs: [
      { label: 'Proposals', path: `${BD}/proposals` },
      { label: 'Negotiations', path: `${BD}/negotiations` },
      { label: 'Partnerships', path: `${BD}/partnerships` },
      { label: 'Customers', path: `${BD}/customers` },
    ],
  },
  {
    key: 'showcase',
    label: 'Showcase',
    icon: Sparkles,
    path: `${BD}/showcase`,
    tabs: [{ label: 'ELLY Showcase', path: `${BD}/showcase` }],
  },
  {
    key: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    path: `${BD}/analytics`,
    tabs: [
      { label: 'Overview', path: `${BD}/analytics`, exact: true },
      { label: 'Financials', path: `${BD}/analytics/financials` },
    ],
  },
]

/** Length of the matched prefix, or -1 when the link does not cover this path. */
export function matchLength(link: NavLinkDef, pathname: string): number {
  const paths = [link.path, ...(link.match || [])]
  let best = -1
  for (const p of paths) {
    if (pathname === p) best = Math.max(best, p.length + 1)
    else if (!link.exact || p !== link.path) {
      if (pathname.startsWith(p + '/')) best = Math.max(best, p.length)
    }
  }
  return best
}

export interface ResolvedNav {
  section?: NavSectionDef
  tab?: NavTabDef
  subtab?: NavLinkDef
  isAction: boolean
}

/** Find the section, tab and sub-tab that best match the current URL (longest prefix wins). */
export function resolveNav(pathname: string): ResolvedNav {
  let best: ResolvedNav & { score: number } = { score: -1, isAction: false }
  for (const section of NAV_SECTIONS) {
    for (const tab of section.tabs) {
      const score = matchLength(tab, pathname)
      if (score > best.score) best = { score, section, tab, isAction: false }
      for (const sub of tab.subtabs || []) {
        const s = matchLength(sub, pathname)
        if (s > best.score) best = { score: s, section, tab, subtab: sub, isAction: false }
      }
    }
    if (section.action) {
      const s = matchLength(section.action, pathname)
      if (s > best.score) best = { score: s, section, isAction: true }
    }
  }
  if (best.tab?.subtabs && !best.subtab) {
    best.subtab = best.tab.subtabs.reduce<NavLinkDef | undefined>((acc, sub) => {
      const s = matchLength(sub, pathname)
      return s >= 0 && (!acc || s > matchLength(acc, pathname)) ? sub : acc
    }, undefined)
  }
  return best
}

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  BUSINESS_DEVELOPMENT: 'Business Development',
  HEALTHCARE: 'Healthcare',
  USER: 'Standard user',
}

/** Roles the backend lets an admin assign (create user / change role). */
export const ASSIGNABLE_ROLES = ['BUSINESS_DEVELOPMENT', 'ADMIN'] as const

export const roleLabel = (role?: string | null) => (role ? ROLE_LABELS[role] || role : 'Unknown role')
