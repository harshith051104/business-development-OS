import { useEffect, useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, Globe, Plus, Users, Check, Sparkles, ExternalLink, RefreshCw, Box, Map as MapIcon } from 'lucide-react'
import { geocodingService } from '../../services/geocoding'
import type { MapData } from '../../services/geocoding'
import { discoveryService } from '../../services/discovery'
import type { DiscoveredOrganization } from '../../types/discovery'
import { resolveCoordinates } from '../../utils/cityCoordinates'
import OrgGlobe from './OrgGlobe'

// Fix default marker icon asset paths with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

export interface MappedEntity {
  id: number
  name: string
  latitude: number
  longitude: number
  organization_type: string
  city: string
  country: string
  address?: string
  status: string
  priority: string
  fit_score: number
  website: string
  description: string
  contactsCount: number
  originalItem?: DiscoveredOrganization
  location_precision?: string | null
  isSuggested?: boolean
}

function getMarkerColor(score: number, priority: string): { bg: string; glow: string; border: string } {
  if (score >= 80 || priority === 'High') {
    return {
      bg: '#10b981',
      glow: 'rgba(16, 185, 129, 0.45)',
      border: '#34d399',
    }
  }
  if (score >= 60 || priority === 'Medium') {
    return {
      bg: '#f59e0b',
      glow: 'rgba(245, 158, 11, 0.45)',
      border: '#fbbf24',
    }
  }
  return {
    bg: '#8b5cf6',
    glow: 'rgba(139, 92, 246, 0.45)',
    border: '#a78bfa',
  }
}

function createGlowingMarker(org: MappedEntity) {
  const { bg, glow, border } = org.isSuggested
    ? { bg: '#eab308', glow: 'rgba(234, 179, 8, 0.45)', border: '#fde047' }
    : getMarkerColor(org.fit_score, org.priority)
  const label = org.isSuggested ? '+' : org.fit_score > 0 ? org.fit_score : org.name.charAt(0)
  const isApproximate = !org.isSuggested && org.location_precision === 'APPROXIMATE'
  const isDashed = org.isSuggested || isApproximate

  return L.divIcon({
    className: 'custom-map-marker',
    html: `
      <div style="
        position: relative;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      ">
        <div style="
          position: absolute;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: ${glow};
          animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
          pointer-events: none;
        "></div>
        <div style="
          position: relative;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: ${isApproximate ? 'transparent' : bg};
          border: 2px solid ${isApproximate ? '#6366f1' : border};
          ${isDashed ? 'border-style: dashed;' : ''}
          box-shadow: 0 4px 12px rgba(0,0,0,0.6);
          color: white;
          font-weight: 700;
          font-size: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: ui-monospace, monospace;
          pointer-events: none;
        ">
          ${isApproximate ? '\u2248' : label}
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  })
}

/** Invalidate size on tab activation and window resize so tiles never break */
function MapResizer() {
  const map = useMap()
  useEffect(() => {
    map.invalidateSize()
    const t1 = setTimeout(() => map.invalidateSize(), 150)
    const t2 = setTimeout(() => map.invalidateSize(), 500)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [map])
  return null
}

/** Automatically fit bounds around all visible organizations */
function FitBounds({ orgs }: { orgs: MappedEntity[] }) {
  const map = useMap()
  useEffect(() => {
    if (orgs.length === 0) return
    map.invalidateSize()
    if (orgs.length === 1) {
      map.setView([orgs[0].latitude, orgs[0].longitude], 8, { animate: true })
      return
    }
    const valid = orgs.filter(o => !isNaN(o.latitude) && !isNaN(o.longitude))
    if (valid.length === 0) return
    const bounds = L.latLngBounds(valid.map(o => [o.latitude, o.longitude]))
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 11, animate: true })
  }, [orgs, map])
  return null
}

interface OrgMapProps {
  showFilters?: boolean
  height?: string
  items?: DiscoveredOrganization[]
  onAdd?: (item: DiscoveredOrganization) => void
  onSave?: (id: number) => void
  onSkip?: (id: number) => void
}

export default function OrgMap({
  showFilters = true,
  height = '600px',
  items,
  onAdd,
  onSave,
}: OrgMapProps) {
  const [crmOrgs, setCrmOrgs] = useState<MappedEntity[]>([])
  const [suggestedTargets, setSuggestedTargets] = useState<MappedEntity[]>([])
  const [showSuggested, setShowSuggested] = useState(true)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<string>('All')
  const [search, setSearch] = useState('')

  const [mapTheme, setMapTheme] = useState<'dark' | 'standard'>('dark')
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d')

  // Map discovered items if provided; otherwise fetch CRM map data
  const mappedFromItems: MappedEntity[] = useMemo(() => {
    if (!items || items.length === 0) return []
    return items
      .map(item => {
        const coords = resolveCoordinates(item.address, item.city, item.country, item.id)
        if (!coords) return null
        const [lat, lng] = coords
        return {
          id: item.id,
          name: item.name,
          latitude: lat,
          longitude: lng,
          organization_type: item.organization_type || 'Company',
          city: item.city || '',
          country: item.country || '',
          address: item.address || [item.city, item.country].filter(Boolean).join(', '),
          status: item.status || 'discovered',
          priority: item.potential_fit || 'High',
          fit_score: item.potential_fit_score || 90,
          website: item.website || '',
          description: item.description || '',
          contactsCount: item.contacts?.length || 0,
          originalItem: item,
          location_precision: null,
        }
      })
      .filter(Boolean) as MappedEntity[]
  }, [items])

  useEffect(() => {
    // If external items are passed (e.g. from Discovery), don't fetch CRM
    if (items !== undefined) return

    setLoading(true)
    geocodingService
      .getMapData()
      .then((data: MapData[]) => {
        const mapped: MappedEntity[] = data.map(d => ({
          id: d.id,
          name: d.name,
          latitude: d.latitude,
          longitude: d.longitude,
          organization_type: d.organization_type || 'Company',
          city: d.city || '',
          country: d.country || '',
          address: d.address || [d.city, d.country].filter(Boolean).join(', '),
          status: d.status || 'Active',
          priority: d.priority || 'High',
          fit_score: d.priority === 'High' ? 90 : d.priority === 'Medium' ? 70 : 50,
          website: d.website || '',
          description: '',
          contactsCount: 0,
          location_precision: d.location_precision,
        }))
        setCrmOrgs(mapped)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [items])

  useEffect(() => {
    // Suggested targets layer only applies to standalone CRM map mode
    if (items !== undefined) return

    Promise.all([
      discoveryService.list({ status: 'discovered', page_size: 100 }),
      discoveryService.list({ status: 'saved', page_size: 100 }),
    ])
      .then(([discovered, saved]) => {
        const merged = [...discovered.items, ...saved.items]
          .filter(o => !o.is_existing_duplicate && !o.organization_id)
          .sort((a, b) => (b.potential_fit_score || 0) - (a.potential_fit_score || 0))
          .slice(0, 50)

        const mapped: MappedEntity[] = merged
          .map(item => {
            const coords = resolveCoordinates(item.address, item.city, item.country, item.id)
            if (!coords) return null
            const [lat, lng] = coords
            return {
              id: item.id,
              name: item.name,
              latitude: lat,
              longitude: lng,
              organization_type: item.organization_type || 'Company',
              city: item.city || '',
              country: item.country || '',
              address: item.address || [item.city, item.country].filter(Boolean).join(', '),
              status: item.status,
              priority: item.potential_fit || 'Medium',
              fit_score: item.potential_fit_score || 0,
              website: item.website || '',
              description: item.description || '',
              contactsCount: item.contacts?.length || 0,
              originalItem: item,
              location_precision: null,
              isSuggested: true,
            }
          })
          .filter(Boolean) as MappedEntity[]

        setSuggestedTargets(mapped)
      })
      .catch(() => setSuggestedTargets([]))
  }, [items])

  async function handleAddToCrm(item: DiscoveredOrganization) {
    if (onAdd) {
      onAdd(item)
      return
    }
    try {
      await discoveryService.addToOrganizations(item.id)
      setSuggestedTargets(prev => prev.filter(o => o.id !== item.id))
    } catch {
      // leave marker in place if the add failed; user can retry from the popup
    }
  }

  const allOrgs = items !== undefined
    ? mappedFromItems
    : showSuggested ? [...crmOrgs, ...suggestedTargets] : crmOrgs

  const filtered = useMemo(() => {
    return allOrgs.filter(o => {
      if (filter !== 'All' && o.priority !== filter) return false
      if (search) {
        const q = search.toLowerCase()
        const matchesName = o.name.toLowerCase().includes(q)
        const matchesCity = o.city.toLowerCase().includes(q)
        const matchesCountry = o.country.toLowerCase().includes(q)
        const matchesType = o.organization_type.toLowerCase().includes(q)
        const matchesAddress = o.address ? o.address.toLowerCase().includes(q) : false
        if (!matchesName && !matchesCity && !matchesCountry && !matchesType && !matchesAddress) return false
      }
      return true
    })
  }, [allOrgs, filter, search])

  const defaultCenter: [number, number] =
    filtered.length > 0 ? [filtered[0].latitude, filtered[0].longitude] : [1.3521, 103.8198]

  if (loading) {
    return (
      <div
        className="flex items-center justify-center bg-[#110B2E] rounded-2xl border border-violet-900/30"
        style={{ height }}
      >
        <div className="flex items-center space-x-2 text-violet-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">Rendering Global Intelligence Map...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-violet-900/40 bg-[#0B0520] shadow-2xl relative flex flex-col">
      {/* Top Map Control Bar */}
      <div className="bg-[#110B2E]/95 backdrop-blur-md px-4 py-3 flex flex-wrap gap-3 items-center justify-between border-b border-violet-900/40 z-10">
        <div className="flex items-center space-x-3 flex-1 min-w-[240px]">
          <div className="relative flex-1 max-w-xs">
            <input
              type="text"
              placeholder="Search mapped leads..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#1A1040] text-white placeholder-slate-400 text-xs px-3 py-2 rounded-xl border border-violet-800/40 focus:outline-none focus:border-violet-500"
            />
          </div>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="bg-[#1A1040] text-slate-200 text-xs px-3 py-2 rounded-xl border border-violet-800/40 focus:outline-none focus:border-violet-500"
          >
            <option value="All">All ICP Tiers</option>
            <option value="High">High Fit (80%+)</option>
            <option value="Medium">Medium Fit</option>
            <option value="Low">Low Fit</option>
          </select>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-xs">
            <span className="flex items-center space-x-1 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
              <span>High Fit</span>
            </span>
            <span className="flex items-center space-x-1 text-amber-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>
              <span>Medium</span>
            </span>
            <span className="flex items-center space-x-1 text-violet-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-violet-400 inline-block"></span>
              <span>Low</span>
            </span>
            <span className="flex items-center space-x-1 text-indigo-400 font-medium">
              <span className="w-2 h-2 rounded-full border border-dashed border-indigo-400 inline-block"></span>
              <span>Approx</span>
            </span>
            {items === undefined && (
              <span className="flex items-center space-x-1 text-yellow-400 font-medium">
                <span className="w-2 h-2 rounded-full border border-dashed border-yellow-400 inline-block"></span>
                <span>Suggested</span>
              </span>
            )}
          </div>

          {items === undefined && (
            <label className="flex items-center space-x-1.5 text-xs px-2.5 py-1 rounded-xl bg-[#1A1040] border border-violet-800/40 text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showSuggested}
                onChange={e => setShowSuggested(e.target.checked)}
                className="accent-violet-500"
              />
              <span>Suggested Targets ({suggestedTargets.length})</span>
            </label>
          )}

          <button
            onClick={() => setViewMode(v => (v === '2d' ? '3d' : '2d'))}
            className="flex items-center space-x-1.5 text-xs px-2.5 py-1 rounded-xl bg-[#1A1040] hover:bg-[#251755] text-slate-300 hover:text-white border border-violet-800/40 transition font-medium"
            title="Toggle between flat 2D map and 3D globe"
          >
            {viewMode === '2d' ? <Box className="w-3.5 h-3.5" /> : <MapIcon className="w-3.5 h-3.5" />}
            <span>{viewMode === '2d' ? '3D Globe' : '2D Map'}</span>
          </button>

          {viewMode === '2d' && (
            <button
              onClick={() => setMapTheme(t => (t === 'dark' ? 'standard' : 'dark'))}
              className="flex items-center space-x-1.5 text-xs px-2.5 py-1 rounded-xl bg-[#1A1040] hover:bg-[#251755] text-slate-300 hover:text-white border border-violet-800/40 transition font-medium"
              title="Toggle between dark mode filter and standard OpenStreetMap colors"
            >
              <span>{mapTheme === 'dark' ? '🌙 Dark Mode' : '🗺️ Standard OSM'}</span>
            </button>
          )}

          <span className="text-xs px-2.5 py-1 rounded-full bg-violet-950/80 border border-violet-800/50 text-violet-300 font-semibold font-mono">
            {filtered.length} leads mapped
          </span>
        </div>
      </div>

      {/* Map Container */}
      {viewMode === '3d' ? (
        <OrgGlobe orgs={filtered} height={height} onAdd={handleAddToCrm} />
      ) : (
      <div className={mapTheme === 'dark' ? 'osm-dark-tiles' : 'osm-standard-tiles'} style={{ height, width: '100%', position: 'relative' }}>
        <MapContainer
          center={defaultCenter}
          zoom={4}
          minZoom={2}
          maxBounds={[
            [-85, -180],
            [85, 180],
          ]}
          maxBoundsViscosity={1.0}
          style={{ height: '100%', width: '100%', backgroundColor: '#0B0520' }}
          scrollWheelZoom={true}
        >
          {/* 100% Free & Open Source OpenStreetMap (No API Key Required) */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            noWrap={true}
          />

          <MapResizer />
          <FitBounds orgs={filtered} />

          {filtered.map(org => (
            <Marker
              key={`${org.isSuggested ? 'sug' : 'crm'}-${org.id}`}
              position={[org.latitude, org.longitude]}
              icon={createGlowingMarker(org)}
            >
              <Popup className="dark-map-popup" minWidth={260} maxWidth={320}>
                <div className="p-3.5 space-y-2.5 text-[#F0ECFF]">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-white leading-snug">{org.name}</h3>
                      <p className="text-[11px] text-violet-300 font-medium">{org.organization_type}</p>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                        org.fit_score >= 80
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : org.fit_score >= 60
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                      }`}
                    >
                      {org.fit_score ? `${org.fit_score}/100` : org.priority}
                    </span>
                  </div>

                  {/* Physical Address */}
                  <div className="flex items-start space-x-1.5 text-xs text-slate-300 font-medium bg-[#1A1040]/80 px-2.5 py-1.5 rounded-lg border border-violet-800/30">
                    <MapPin className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                    <span className="leading-snug">
                      {org.address || [org.city, org.country].filter(Boolean).join(', ') || 'Global Headquarters'}
                    </span>
                  </div>

                  {/* Location Precision Badge */}
                  {org.location_precision === 'APPROXIMATE' && (
                    <div className="flex items-center space-x-1.5 text-[10px] text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded-lg border border-indigo-500/20">
                      <span className="font-mono">{'\u2248'}</span>
                      <span>City-level approximate location</span>
                    </div>
                  )}

                  {/* Description snippet */}
                  {org.description && (
                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed bg-[#1A1040]/60 p-2 rounded-lg border border-violet-900/30">
                      {org.description}
                    </p>
                  )}

                  {/* Website link */}
                  {org.website && (
                    <a
                      href={org.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-violet-400 hover:text-violet-300 flex items-center space-x-1 transition font-medium"
                    >
                      <Globe className="w-3 h-3" />
                      <span className="truncate">{org.website.replace(/^https?:\/\//, '')}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-2 border-t border-violet-900/40 flex items-center justify-between gap-2">
                    <Link
                      to={`/business-development/discover/${org.id}`}
                      className="text-xs py-1.5 px-2.5 rounded-lg bg-[#1A1040] hover:bg-[#251755] text-slate-200 hover:text-white font-semibold flex items-center space-x-1 transition border border-violet-800/40"
                    >
                      <Users className="w-3 h-3 text-violet-400" />
                      <span>{org.contactsCount ? `${org.contactsCount} Contacts` : 'View Lead'}</span>
                    </Link>

                    {org.originalItem && (onAdd || org.isSuggested) && (
                      <button
                        onClick={() => handleAddToCrm(org.originalItem!)}
                        className="text-xs py-1.5 px-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-bold transition flex items-center space-x-1 shadow-md shadow-violet-600/30"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add to CRM</span>
                      </button>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      )}

      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.4); opacity: 0.2; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }
      `}</style>
    </div>
  )
}
