import { Component, useEffect, useRef, useState } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Users, Target, Sun, Box, Map as MapIcon } from 'lucide-react'
import './OrgGlobe.css'
import type { MappedEntity } from './OrgMap'
import type { DiscoveredOrganization } from '../../types/discovery'

interface OrgGlobeProps {
  orgs: MappedEntity[]
  height: string
  onAdd?: (item: DiscoveredOrganization) => void
}

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'
const NIGHT_SOURCE = 'night-side'
const NIGHT_LAYER = 'night-side-fill'

// Night-side polygon from the real UTC time (low-precision solar position, ~1 degree —
// fine for a visual terminator). Pure computation, no external data. Ported from
// AI-Growth's GeoMap.tsx so the globe shows the same day/night cycle.
function nightPolygon(date: Date): Parameters<maplibregl.GeoJSONSource["setData"]>[0] {
  const rad = Math.PI / 180
  const norm = (d: number) => ((d % 360) + 360) % 360
  const n = date.getTime() / 86400000 + 2440587.5 - 2451545.0
  const L = norm(280.46 + 0.9856474 * n)
  const g = norm(357.528 + 0.9856003 * n) * rad
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad
  const eps = (23.439 - 0.0000004 * n) * rad
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda))
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) / rad
  const gmst = norm(280.46061837 + 360.98564736629 * n)
  let subLon = norm(ra - gmst)
  if (subLon > 180) subLon -= 360
  const tanDec = Math.abs(Math.tan(dec)) < 1e-6 ? 1e-6 : Math.tan(dec)
  const ring: [number, number][] = []
  for (let lon = -180; lon <= 180; lon += 2) {
    const lat = Math.atan(-Math.cos((lon - subLon) * rad) / tanDec) / rad
    ring.push([lon, lat])
  }
  const pole = dec > 0 ? -89.9 : 89.9
  ring.push([180, pole], [-180, pole], ring[0])
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }
}

function markerColor(org: MappedEntity): { bg: string; border: string } {
  if (org.isSuggested) return { bg: '#eab308', border: '#fde047' }
  if (org.fit_score >= 80 || org.priority === 'High') return { bg: '#10b981', border: '#34d399' }
  if (org.fit_score >= 60 || org.priority === 'Medium') return { bg: '#f59e0b', border: '#fbbf24' }
  return { bg: '#8b7cc7', border: '#8b7cc7' }
}

class GlobeErrorBoundary extends Component<{ height: string; children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false }

  static getDerivedStateFromError() {
    return { crashed: true }
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('3D globe crashed:', err, info)
  }

  render() {
    if (this.state.crashed) {
      return (
        <div style={{ height: this.props.height, width: '100%' }} className="flex items-center justify-center bg-[#0E0B1D] text-slate-400 text-sm text-center p-6">
          3D globe failed to render. Switch to 2D Map above.
        </div>
      )
    }
    return this.props.children
  }
}

function OrgGlobeInner({ orgs, height, onAdd }: OrgGlobeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1.5)
  const [projection, setProjection] = useState<'globe' | 'mercator'>('globe')
  const [zulu, setZulu] = useState(() => new Date())
  const [showNight, setShowNight] = useState(true)
  const [showOrgs, setShowOrgs] = useState(true)
  const [showSuggested, setShowSuggested] = useState(true)

  useEffect(() => {
    if (!containerRef.current) return
    let map: maplibregl.Map
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: [0, 20],
        zoom: 1.5,
      })
      map.addControl(new maplibregl.NavigationControl(), 'top-right')
      map.on('style.load', () => {
        map.setProjection({ type: 'globe' })
        map.setSky({
          'sky-color': '#0e0b1d',
          'horizon-color': '#8b7cc7',
          'fog-color': '#2a1e4d',
          'sky-horizon-blend': 0.6,
          'horizon-fog-blend': 0.5,
          'fog-ground-blend': 0.3,
          'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
        })
        map.addSource(NIGHT_SOURCE, { type: 'geojson', data: nightPolygon(new Date()) })
        map.addLayer({
          id: NIGHT_LAYER,
          type: 'fill',
          source: NIGHT_SOURCE,
          paint: { 'fill-color': '#0e0b1d', 'fill-opacity': 0.4 },
        })
      })
      map.on('zoom', () => setZoom(map.getZoom()))
      map.on('error', (e) => {
        console.error('Globe map error:', e?.error || e)
      })
    } catch (err) {
      console.error('Failed to initialize 3D globe:', err)
      setError('3D globe could not start (WebGL may be unavailable in this browser). Switch to 2D Map above.')
      return
    }
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (map && map.isStyleLoaded()) map.setProjection({ type: projection })
  }, [projection])

  useEffect(() => {
    if (error) return
    const tick = () => {
      const now = new Date()
      setZulu(now)
      const map = mapRef.current
      const src = map?.getSource(NIGHT_SOURCE) as maplibregl.GeoJSONSource | undefined
      src?.setData(nightPolygon(now))
    }
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [error])

  useEffect(() => {
    const map = mapRef.current
    if (map && map.getLayer(NIGHT_LAYER)) {
      map.setLayoutProperty(NIGHT_LAYER, 'visibility', showNight ? 'visible' : 'none')
    }
  }, [showNight])

  useEffect(() => {
    const map = mapRef.current
    if (!map || error) return

    try {
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    const valid = orgs.filter(o => Number.isFinite(o.latitude) && Number.isFinite(o.longitude))
    const visible = valid.filter(o => (o.isSuggested ? showSuggested : showOrgs))
    if (visible.length === 0) return

    const bounds = new maplibregl.LngLatBounds()

    visible.forEach(org => {
      const { bg, border } = markerColor(org)
      const el = document.createElement('div')
      el.className = 'geo-marker'
      el.style.width = '16px'
      el.style.height = '16px'
      el.style.background = bg
      el.style.border = `2px solid ${border}`
      el.style.setProperty('--geo-pulse-color', bg)
      if (org.isSuggested) {
        el.style.borderStyle = 'dashed'
      }
      el.addEventListener('click', () => {
        map.flyTo({ center: [org.longitude, org.latitude], zoom: Math.max(map.getZoom(), 4), speed: 0.9, curve: 1.4 })
      })

      const popupNode = document.createElement('div')
      popupNode.style.minWidth = '200px'
      popupNode.style.color = '#C9C2E3'

      const title = document.createElement('div')
      title.textContent = org.name
      title.style.fontWeight = 'bold'
      title.style.fontSize = '13px'
      title.style.marginBottom = '2px'
      popupNode.appendChild(title)

      const type = document.createElement('div')
      type.textContent = org.organization_type
      type.style.fontSize = '11px'
      type.style.color = '#c9c2e3'
      type.style.marginBottom = '4px'
      popupNode.appendChild(type)

      const addr = org.address || [org.city, org.country].filter(Boolean).join(', ')
      if (addr) {
        const addrEl = document.createElement('div')
        addrEl.textContent = addr
        addrEl.style.fontSize = '11px'
        addrEl.style.color = '#cbd5e1'
        addrEl.style.marginBottom = '4px'
        popupNode.appendChild(addrEl)
      }

      if (org.isSuggested && org.originalItem && onAdd) {
        const btn = document.createElement('button')
        btn.textContent = 'Add to CRM'
        btn.style.fontSize = '11px'
        btn.style.fontWeight = 'bold'
        btn.style.color = '#fff'
        btn.style.background = '#8b7cc7'
        btn.style.border = 'none'
        btn.style.borderRadius = '6px'
        btn.style.padding = '5px 10px'
        btn.style.cursor = 'pointer'
        btn.onclick = () => onAdd(org.originalItem!)
        popupNode.appendChild(btn)
      }

      const popup = new maplibregl.Popup({ offset: 12 }).setDOMContent(popupNode)
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([org.longitude, org.latitude])
        .setPopup(popup)
        .addTo(map)

      markersRef.current.push(marker)
      bounds.extend([org.longitude, org.latitude])
    })

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 5, duration: 0 })
    }
    } catch (err) {
      console.error('Failed to render globe markers:', err)
    }
  }, [orgs, onAdd, error, showOrgs, showSuggested])

  if (error) {
    return (
      <div style={{ height, width: '100%' }} className="flex items-center justify-center bg-[#0E0B1D] text-slate-400 text-sm text-center p-6">
        {error}
      </div>
    )
  }

  const orgCount = orgs.filter(o => !o.isSuggested).length
  const suggestedCount = orgs.filter(o => o.isSuggested).length

  return (
    <div className="geo-console relative" style={{ height, width: '100%' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      <div className="geo-hud geo-hud-top-left">
        <div className="geo-hud-title">ORG INTELLIGENCE</div>
        <div className="geo-hud-row"><span>ZOOM</span><b>{zoom.toFixed(1)}</b></div>
        <div className="geo-hud-row"><span>ZULU</span><b>{zulu.toISOString().slice(11, 19)}</b></div>
        <div className="geo-hud-row"><span>ENTITIES</span><b>{(showOrgs ? orgCount : 0) + (showSuggested ? suggestedCount : 0)}</b></div>
      </div>

      <div className="geo-hud geo-hud-top-right">
        <div className="geo-hud-title">VIEW</div>
        <div className="geo-seg">
          <button className={projection === 'globe' ? 'active' : ''} onClick={() => setProjection('globe')}>
            <Box size={11} /> 3D
          </button>
          <button className={projection === 'mercator' ? 'active' : ''} onClick={() => setProjection('mercator')}>
            <MapIcon size={11} /> 2D
          </button>
        </div>
      </div>

      <div className="geo-hud geo-hud-bottom-left">
        <div className="geo-hud-title">LAYERS</div>
        <button className={`geo-layer ${showOrgs ? 'on' : ''}`} onClick={() => setShowOrgs(v => !v)}>
          <span className="dot" style={{ background: '#8b7cc7' }} /> <Users size={11} /> Organizations
          <em>{orgCount}</em>
        </button>
        <button className={`geo-layer ${showSuggested ? 'on' : ''}`} onClick={() => setShowSuggested(v => !v)}>
          <span className="dot" style={{ background: '#eab308' }} /> <Target size={11} /> Suggested Targets
          <em>{suggestedCount}</em>
        </button>
        <button className={`geo-layer ${showNight ? 'on' : ''}`} onClick={() => setShowNight(v => !v)}>
          <span className="dot" style={{ background: '#94a3b8' }} /> <Sun size={11} /> Day / Night
        </button>
      </div>
    </div>
  )
}

export default function OrgGlobe(props: OrgGlobeProps) {
  return (
    <GlobeErrorBoundary height={props.height}>
      <OrgGlobeInner {...props} />
    </GlobeErrorBoundary>
  )
}
