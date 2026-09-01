import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { geocodingService } from '../../services/geocoding'
import type { MapData } from '../../services/geocoding'

// Fix default marker icon issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const PRIORITY_COLORS: Record<string, string> = {
  High: '#ef4444',
  Medium: '#f59e0b',
  Low: '#22c55e',
}

function createIcon(priority: string) {
  const color = PRIORITY_COLORS[priority] || '#6366f1'
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 24px; height: 24px; border-radius: 50%;
      background: ${color}; border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  })
}

function FitBounds({ orgs }: { orgs: MapData[] }) {
  const map = useMap()
  useEffect(() => {
    if (orgs.length === 0) return
    if (orgs.length === 1) {
      map.setView([orgs[0].latitude, orgs[0].longitude], 12)
      return
    }
    const bounds = L.latLngBounds(orgs.map(o => [o.latitude, o.longitude]))
    map.fitBounds(bounds, { padding: [40, 40] })
  }, [orgs, map])
  return null
}

interface OrgMapProps {
  showFilters?: boolean
  height?: string
}

export default function OrgMap({ showFilters = true, height = '600px' }: OrgMapProps) {
  const [orgs, setOrgs] = useState<MapData[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('All')
  const [search, setSearch] = useState('')

  useEffect(() => {
    geocodingService.getMapData().then((data: MapData[]) => {
      setOrgs(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const filtered = orgs.filter(o => {
    if (filter !== 'All' && o.priority !== filter) return false
    if (search && !o.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const defaultCenter: [number, number] = orgs.length > 0
    ? [orgs[0].latitude, orgs[0].longitude]
    : [20, 0]

  const defaultZoom = orgs.length > 0 ? 4 : 2

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-slate-800 rounded-xl" style={{ height }}>
        <div className="text-slate-400">Loading map...</div>
      </div>
    )
  }

  return (
    <div className="rounded-xl overflow-hidden border border-slate-700">
      {showFilters && (
        <div className="bg-slate-800 p-3 flex gap-3 items-center border-b border-slate-700">
          <input
            type="text"
            placeholder="Search organizations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-slate-700 text-white px-3 py-1.5 rounded text-sm flex-1 max-w-xs"
          />
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="bg-slate-700 text-white px-3 py-1.5 rounded text-sm"
          >
            <option value="All">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <span className="text-slate-400 text-sm">{filtered.length} orgs</span>
        </div>
      )}
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height, width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds orgs={filtered} />
        {filtered.map(org => (
          <Marker
            key={org.id}
            position={[org.latitude, org.longitude]}
            icon={createIcon(org.priority)}
          >
            <Popup>
              <div className="min-w-[200px]">
                <h3 className="font-bold text-slate-900">{org.name}</h3>
                <p className="text-sm text-slate-600">{org.organization_type}</p>
                <p className="text-sm text-slate-500">{[org.city, org.country].filter(Boolean).join(', ')}</p>
                <div className="flex gap-2 mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    org.priority === 'High' ? 'bg-red-100 text-red-700' :
                    org.priority === 'Medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-green-100 text-green-700'
                  }`}>{org.priority}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{org.status}</span>
                </div>
                {org.website && (
                  <a href={org.website} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-indigo-600 hover:underline mt-2 block">
                    Visit Website
                  </a>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
