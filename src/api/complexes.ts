import { isDemo } from './config'
import { request } from './http'
import type { ResidentialComplex } from '../types'

type RawComplex={
  id:number|string
  name:string
  developer?:string
  address?:string
  latitude?:number|null
  longitude?:number|null
  planned_completion_year?:number|null
  source_name?:string
  source_id?:string
  source_url?:string
  apartment_count?:number
  min_price?:number|null
  median_price?:number|null
  updated_at?:string
}

function normalize(raw:RawComplex):ResidentialComplex {
  return {
    id:String(raw.id),name:String(raw.name || 'ЖК без названия'),developer:raw.developer || null,address:raw.address || null,
    latitude:raw.latitude ?? null,longitude:raw.longitude ?? null,plannedCompletionYear:raw.planned_completion_year ?? null,
    sourceName:raw.source_name || 'GeoDom backend',sourceId:raw.source_id || String(raw.id),sourceUrl:raw.source_url || null,
    apartmentCount:Number(raw.apartment_count || 0),minPrice:raw.min_price ?? null,medianPrice:raw.median_price ?? null,updatedAt:raw.updated_at || null
  }
}

export const complexesApi={
  async list(limit=30,signal?:AbortSignal):Promise<ResidentialComplex[]> {
    if (isDemo) return []
    const rows=await request<RawComplex[]>(`/api/complexes?limit=${Math.min(100,Math.max(1,limit))}`,{signal})
    return rows.map(normalize)
  }
}
