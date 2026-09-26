import { isDemo } from './config'
import { request } from './http'
import { buildDistrictStats,type DistrictStats } from '../lib/districtStats'
import { demoHomes } from './demoState'
import { KRASNOYARSK_DISTRICTS } from '../lib/krasnoyarsk'
import type { DistrictAnalysis } from '../types'

type BackendDistrictStats={
  id:number|string
  name:string
  apartment_count:number
  median_price?:number|null
  median_price_m2?:number|null
  median_area?:number|null
  photo_coverage?:number|null
  min_price?:number|null
  max_price?:number|null
  avg_schools_1km?:number|null
  avg_kindergartens_1km?:number|null
  avg_parks_1km?:number|null
  avg_transport_stops_1km?:number|null
  updated_at?:string|null
}

function statsToAnalysis(row:BackendDistrictStats):DistrictAnalysis {
  const available=[
    row.avg_schools_1km,row.avg_kindergartens_1km,row.avg_parks_1km,row.avg_transport_stops_1km,
    row.median_price,row.median_price_m2,row.photo_coverage
  ].filter(value => value !== null && value !== undefined).length
  const warnings:string[]=[]
  if (available < 7) warnings.push('Часть показателей района отсутствует в backend.')
  warnings.push('Backend пока не публикует итоговый районный score, экологию и безопасность как отдельный DistrictAnalysis score.')
  return {
    id:String(row.id),name:row.name,overallScore:null,
    scores:{transport:null,ecology:null,schools:null,safety:null,infrastructure:null},
    apartmentCount:Number(row.apartment_count || 0),
    medianPrice:row.median_price ?? null,
    medianPriceM2:row.median_price_m2 ?? null,
    coverage:row.photo_coverage ?? (available/7),
    updatedAt:row.updated_at ?? null,
    sourceName:'GeoDom backend · district stats',
    sourceUrl:null,
    warnings
  }
}

export const districtsApi={
  async stats(signal?:AbortSignal):Promise<DistrictStats[]> {
    if (isDemo) return buildDistrictStats(demoHomes().filter(x => x.status === 'published'))
    const rows=await request<BackendDistrictStats[]>('/api/district-stats',{signal})
    return rows.map(row => ({
      id:String(row.id),name:row.name as DistrictStats['name'],count:Number(row.apartment_count || 0),
      medianPrice:row.median_price ?? null,medianPriceM2:row.median_price_m2 ?? null,medianArea:row.median_area ?? null,
      averageScore:null,photoCoverage:row.photo_coverage ?? null,minPrice:row.min_price ?? null,maxPrice:row.max_price ?? null
    }))
  },

  async analysis(signal?:AbortSignal):Promise<DistrictAnalysis[]> {
    if (isDemo) {
      const stats=buildDistrictStats(demoHomes().filter(x => x.status === 'published'))
      return KRASNOYARSK_DISTRICTS.map(district => {
        const row=stats.find(item => item.name === district.name)
        return {
          id:district.id,name:district.name,overallScore:null,
          scores:{transport:null,ecology:null,schools:null,safety:null,infrastructure:null},
          apartmentCount:row?.count ?? 0,medianPrice:row?.medianPrice ?? null,medianPriceM2:row?.medianPriceM2 ?? null,
          coverage:row?.photoCoverage ?? null,updatedAt:null,sourceName:'GeoDom demo dataset',sourceUrl:null,
          warnings:['Демо-режим: районный итоговый score не вычисляется на frontend.']
        }
      })
    }
    const rows=await request<BackendDistrictStats[]>('/api/district-stats',{signal})
    return rows.map(statsToAnalysis)
  }
}
