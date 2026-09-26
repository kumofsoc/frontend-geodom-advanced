import { isDemo } from './config'
import { request } from './http'
import { demoGeoRows } from '../data/demoGeoObjects'
import { normalizeGeoObjects,type GeoObject } from '../lib/dataSanitizers'
import type { FutureDevelopmentMapItem,GeoBounds } from '../types'

export type GeoViewportRequest=GeoBounds & {categories?:string[];limit?:number;signal?:AbortSignal}

function inside(item:GeoObject,bounds:GeoBounds) {
  return item.lat >= bounds.minLat && item.lat <= bounds.maxLat && item.lon >= bounds.minLon && item.lon <= bounds.maxLon
}

type RawDevelopment={
  id:number|string
  name?:string
  type?:string
  description?:string
  lat?:number
  lon?:number
  address?:string
  status?:FutureDevelopmentMapItem['status']
  planned_completion_year?:number|null
  source_url?:string
  source_name?:string
  updated_at?:string
}

export const geoApi={
  async viewport(input:GeoViewportRequest):Promise<GeoObject[]> {
    const limit=Math.min(2000,Math.max(1,input.limit ?? 1200))
    if (isDemo) {
      return normalizeGeoObjects(demoGeoRows).filter(item => inside(item,input)).slice(0,limit)
    }
    const search=new URLSearchParams({
      min_lat:String(input.minLat),max_lat:String(input.maxLat),
      min_lon:String(input.minLon),max_lon:String(input.maxLon),
      limit:String(limit)
    })
    if (input.categories?.length) search.set('categories',input.categories.join(','))
    const raw=await request<{items?:unknown}>(`/api/v1/geo/objects?${search}`,{signal:input.signal})
    return normalizeGeoObjects(raw)
  },

  async developments(signal?:AbortSignal):Promise<FutureDevelopmentMapItem[]> {
    if (isDemo) return []
    const raw=await request<{items?:RawDevelopment[]}>('/api/v1/developments?limit=100&offset=0',{signal})
    return (raw.items || []).flatMap(item => {
      const latitude=Number(item.lat)
      const longitude=Number(item.lon)
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return []
      return [{
        id:String(item.id),name:String(item.name || 'Будущий объект'),type:String(item.type || 'development'),
        description:String(item.description || ''),latitude,longitude,address:item.address || null,
        status:item.status || 'planned',plannedCompletionYear:item.planned_completion_year ?? null,
        sourceUrl:item.source_url || null,sourceName:item.source_name || 'GeoDom backend',updatedAt:item.updated_at || null
      }]
    })
  }
}
