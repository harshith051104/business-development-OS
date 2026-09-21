import { api } from './api'

export interface MapData {
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
  website: string
  location_precision?: string | null
  location_source?: string | null
}

export interface GeocodeResult {
  latitude: number
  longitude: number
  display_name: string
  country: string
  state: string
  city: string
}

export const geocodingService = {
  async getMapData(): Promise<MapData[]> {
    return api.get<MapData[]>('/api/geocoding/map-data')
  },

  async geocodeAddress(address: string): Promise<GeocodeResult> {
    return api.post<GeocodeResult>('/api/geocoding/geocode', { address })
  },

  async geocodeOrganization(orgId: number): Promise<any> {
    return api.post<any>(`/api/geocoding/geocode-organization/${orgId}`)
  },

  async geocodeAll(): Promise<{ geocoded: number; failed: number; total: number }> {
    return api.post<{ geocoded: number; failed: number; total: number }>('/api/geocoding/geocode-all')
  },
}
