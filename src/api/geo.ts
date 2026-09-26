import { isDemo } from './config'
import { request } from './http'
import { demoGeoRows } from '../data/demoGeoObjects'
import { normalizeGeoObjects,type GeoObject } from '../lib/dataSanitizers'
import type { GeoBounds } from '../types'

export type GeoViewportRequest=GeoBounds & {categories?:string[];limit?:number;signal?:AbortSignal}

function inside(item:GeoObject,bounds:GeoBounds) {
  return item.lat >= bounds.minLat && item.lat <= bounds.maxLat && item.lon >= bounds.minLon && item.lon <= bounds.maxLon
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
  }
}
