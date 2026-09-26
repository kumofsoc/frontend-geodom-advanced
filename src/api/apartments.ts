import { isDemo } from './config'
import { demoDelay,readLocal,writeLocal } from './common'
import { demoHomes,demoHomesKey,imageData } from './demoState'
import { getSession,request } from './http'
import { createId } from '../lib/id'
import { withLocalHousingMedia } from '../lib/media'
import type { Apartment,ApartmentPhoto,ListingInput,Paginated } from '../types'

type ApartmentPageParams={
  limit?:number
  offset?:number
  minPrice?:number
  maxPrice?:number
  rooms?:number
  districtId?:string|number
  signal?:AbortSignal
}

type RawApartment=Record<string,any>

function normalizePhoto(raw:Record<string,any>):ApartmentPhoto {
  return {
    id:String(raw.id ?? createId()),
    url:String(raw.url || ''),
    order:Number(raw.order ?? raw.position ?? 0),
    is_cover:Boolean(raw.is_cover),
    attribution:raw.attribution || undefined,
    rights_status:raw.rights_status || undefined,
    source_url:raw.source_url || undefined
  }
}

export function normalizeApartment(raw:RawApartment):Apartment {
  const photos=Array.isArray(raw.photos) ? raw.photos.map(normalizePhoto) : []
  const features=raw.features || {}
  const districtName=String(raw.district?.name || raw.district_name || 'Уточняется')
  return withLocalHousingMedia({
    id:String(raw.id),
    title:String(raw.title || 'Квартира'),
    price:Number(raw.price || 0),
    rooms:Number(raw.rooms || 0),
    area:Number(raw.area || 0),
    floor:Number(raw.floor || 0),
    total_floors:Number(raw.total_floors || 0),
    address:String(raw.address || ''),
    house_number:String(raw.house_number || ''),
    latitude:Number(raw.latitude ?? raw.lat ?? 0),
    longitude:Number(raw.longitude ?? raw.lon ?? 0),
    district:{
      id:String(raw.district?.id ?? raw.district_id ?? 'pending'),
      name:districtName,
      description:String(raw.district?.description || '')
    },
    description:String(raw.description || ''),
    photos,
    source:raw.source === 'user' ? 'user' : 'seed',
    created_at:String(raw.created_at || ''),
    status:raw.status || 'published',
    owner_id:raw.owner_id == null ? null : String(raw.owner_id),
    features:{
      schools_1km:Number(features.schools_1km || 0),
      parks_1km:Number(features.parks_1km || 0),
      kindergartens_1km:Number(features.kindergartens_1km || 0),
      nearest_school_m:Number(features.nearest_school_m || 0),
      nearest_park_m:Number(features.nearest_park_m || 0),
      nearest_transport_m:Number(features.nearest_transport_m || 0)
    },
    development_projects:Array.isArray(raw.development_projects) ? raw.development_projects.map((project:any) => ({
      id:String(project.id),
      name:String(project.name || ''),
      type:String(project.type || ''),
      description:String(project.description || ''),
      distance_m:Number(project.distance_m || 0),
      status:project.status,
      planned_completion_year:project.planned_completion_year ?? null,
      source_url:String(project.source_url || ''),
      source_name:String(project.source_name || ''),
      updated_at:String(project.updated_at || '')
    })) : [],
    recommendation:raw.recommendation ? {
      score:typeof raw.recommendation.score === 'number' ? raw.recommendation.score : null,
      reasons:Array.isArray(raw.recommendation.reasons) ? raw.recommendation.reasons : [],
      model_version:String(raw.recommendation.model_version || ''),
      ml_available:Boolean(raw.recommendation.ml_available),
      warning:raw.recommendation.warning || undefined
    } : {
      score:null,reasons:[],model_version:'',ml_available:false,warning:'Оценка появится после персонального подбора.'
    },
    kitchen_area:raw.kitchen_area ?? undefined,
    building_year:raw.building_year ?? undefined,
    balcony:raw.balcony ?? raw.has_balcony ?? undefined,
    renovation:raw.renovation ?? undefined,
    building_type:raw.building_type ?? undefined,
    external_id:raw.external_id ?? undefined,
    upstream_source:raw.upstream_source ?? undefined,
    upstream_source_id:raw.upstream_source_id ?? undefined,
    source_url:raw.source_url ?? undefined,
    source_updated_at:raw.source_updated_at ?? undefined,
    collected_at:raw.collected_at ?? undefined,
    price_m2:raw.price_m2 ?? undefined,
    complex_name:raw.complex_name ?? undefined,
    cover_storage_key:raw.cover_storage_key ?? undefined,
    photo_count:Number(raw.photo_count ?? photos.length)
  })
}

function matchesDemo(item:Apartment,params:ApartmentPageParams) {
  if (params.minPrice && item.price < params.minPrice) return false
  if (params.maxPrice && item.price > params.maxPrice) return false
  if (params.rooms != null && params.rooms > 0 && item.rooms !== params.rooms) return false
  return item.status === 'published'
}

export const apartmentsApi={
  async page(params:ApartmentPageParams={}):Promise<Paginated<Apartment>> {
    const limit=Math.min(100,Math.max(1,params.limit ?? 24))
    const offset=Math.max(0,params.offset ?? 0)
    if (isDemo) {
      await demoDelay()
      const filtered=demoHomes().filter(item => matchesDemo(item,params))
      const items=filtered.slice(offset,offset+limit).map(withLocalHousingMedia)
      return {items,limit,offset,hasMore:offset+items.length < filtered.length}
    }
    const search=new URLSearchParams({limit:String(limit),offset:String(offset)})
    if (params.minPrice) search.set('min_price',String(params.minPrice))
    if (params.maxPrice) search.set('max_price',String(params.maxPrice))
    if (params.rooms && params.rooms < 4) search.set('rooms',String(params.rooms))
    if (params.districtId) search.set('district_id',String(params.districtId))
    const raw=await request<{items:RawApartment[];limit?:number;offset?:number}>(`/api/v1/apartments?${search}`,{signal:params.signal})
    const items=(raw.items || []).map(normalizeApartment)
    return {items,limit:Number(raw.limit ?? limit),offset:Number(raw.offset ?? offset),hasMore:items.length === limit}
  },

  async list():Promise<Apartment[]> {
    if (isDemo) return (await this.page({limit:100,offset:0})).items
    const items:Apartment[]=[]
    let offset=0
    const limit=100
    for(let page=0;page<10;page++) {
      const response=await this.page({limit,offset})
      items.push(...response.items)
      if (!response.hasMore) break
      offset+=limit
    }
    return items
  },

  async detail(id:string):Promise<Apartment> {
    if (isDemo) {
      await demoDelay()
      const item=demoHomes().find(x => x.id === id && x.status !== 'deleted')
      if (!item) throw new Error('Объявление не найдено')
      return withLocalHousingMedia(item)
    }
    return normalizeApartment(await request<RawApartment>(`/api/apartments/${encodeURIComponent(id)}`))
  },

  async mine():Promise<Apartment[]> {
    if (isDemo) {
      await demoDelay()
      return demoHomes().filter(x => x.owner_id === getSession()?.user.id && x.status !== 'deleted')
    }
    return (await request<RawApartment[]>('/api/users/me/apartments')).map(normalizeApartment)
  },

  async create(input:ListingInput):Promise<Apartment> {
    if (!isDemo) return normalizeApartment(await request<RawApartment>('/api/apartments',{method:'POST',body:JSON.stringify(input)}))
    const owner=getSession()?.user
    if (!owner) throw new Error('Для публикации войдите в аккаунт')
    const districtName=input.district_name || 'Уточняется'
    const item:Apartment={
      id:createId(),...input,house_number:input.address.match(/\d+[а-яА-Я]?\s*$/)?.[0] || '',latitude:0,longitude:0,
      district:{id:districtName.toLocaleLowerCase('ru').replace(/\s+/g,'-'),name:districtName,description:'Район выбран пользователем.'},
      photos:[],source:'user',created_at:new Date().toISOString(),status:'published',owner_id:owner.id,
      features:{schools_1km:0,parks_1km:0,kindergartens_1km:0,nearest_school_m:0,nearest_park_m:0,nearest_transport_m:0},
      development_projects:[],recommendation:{score:null,reasons:[],model_version:'',ml_available:false,warning:'Оценка появится после персонального подбора.'}
    }
    writeLocal(demoHomesKey,[...readLocal<Apartment[]>(demoHomesKey,[]),item])
    return item
  },

  async update(id:string,input:ListingInput):Promise<Apartment> {
    if (!isDemo) return normalizeApartment(await request<RawApartment>(`/api/apartments/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(input)}))
    const items=readLocal<Apartment[]>(demoHomesKey,[])
    const index=items.findIndex(x => x.id === id && x.owner_id === getSession()?.user.id)
    if (index < 0) throw new Error('Объявление не найдено')
    items[index]={...items[index],...input,district:{...items[index].district,name:input.district_name || items[index].district.name}}
    writeLocal(demoHomesKey,items)
    return items[index]
  },

  async hide(id:string):Promise<void> {
    if (!isDemo) { await request<void>(`/api/apartments/${encodeURIComponent(id)}`,{method:'DELETE'});return }
    const items=readLocal<Apartment[]>(demoHomesKey,[])
    const item=items.find(x => x.id === id && x.owner_id === getSession()?.user.id)
    if (!item) throw new Error('Объявление не найдено')
    item.status='hidden'
    writeLocal(demoHomesKey,items)
  },

  async upload(id:string,file:File,signal?:AbortSignal):Promise<void> {
    if (!isDemo) {
      const data=new FormData()
      data.append('file',file)
      await request(`/api/apartments/${encodeURIComponent(id)}/photos`,{method:'POST',body:data,signal})
      return
    }
    const items=readLocal<Apartment[]>(demoHomesKey,[])
    const item=items.find(x => x.id === id && x.owner_id === getSession()?.user.id)
    if (!item) throw new Error('Объявление не найдено')
    if (item.photos.length >= 10) throw new Error('Не больше 10 фотографий')
    const order=item.photos.length
    item.photos.push({id:createId(),url:await imageData(file),order,is_cover:order === 0})
    writeLocal(demoHomesKey,items)
  }
}
