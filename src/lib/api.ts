import { demoApartments } from '../data/demo'
import { demoGeoRows } from '../data/demoGeoObjects'
import { demoRecommend, logDemoEvent, normalizeRecommendation, rememberRecommendation } from './recommendations'
import { normalizeGeoObjects, type GeoObject } from './dataSanitizers'
import { buildDistrictStats, type DistrictStats } from './districtStats'
import type { SharedDemandProfile } from './demandProfile'
import type { LeadStage, ProLead } from './pro'
import { createId, demoPasswordDigest, matchesDemoPassword } from './id'
import { withLocalHousingMedia } from './media'
import type { Apartment, InteractionPayload, ListingInput, RecommendationRequest, RecommendationResponse, User } from '../types'

const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const configuredTimeout=Number(import.meta.env.VITE_API_REQUEST_TIMEOUT_MS || 15000)
const requestTimeoutMs=Number.isFinite(configuredTimeout) && configuredTimeout >= 1000 ? configuredTimeout : 15000
export const isDemo = !base

export class ApiError extends Error {
  status:number|null
  constructor(message:string,status:number|null=null) {
    super(message)
    this.name='ApiError'
    this.status=status
  }
}
const homesKey = 'geodom-demo-apartments-v1'
const usersKey = 'geodom-demo-users-v1'
const sessionKey = 'geodom-session-v1'
const delay = () => new Promise(resolve => setTimeout(resolve, 180))

type BackendDemandProfile = {
  user_id:number
  name?:string
  intent:'buy'|'rent'
  budget_max:number
  monthly_rent_max?:number|null
  district_names:string[]
  rooms_min:number
  rooms_max:number
  max_commute_minutes:number
  priorities:string[]
  work_label:string
  work_location?:{lat:number;lon:number}|null
  contact?:string
  consent_to_contact:boolean
  active:boolean
  created_at:string
  updated_at:string
}

type BackendProLead = {
  user_id:number
  name:string
  intent:'buy'|'rent'
  budget_max:number
  monthly_rent_max?:number|null
  district_names:string[]
  rooms_min:number
  rooms_max:number
  max_commute_minutes:number
  priorities:string[]
  work_label:string
  consent_to_contact:boolean
  contact?:string
  match_score:number
  reasons:string[]
  stage:LeadStage
  created_at:string
}

type ProAccountStatus = {
  user_id:number|string
  status:'none'|'trial'|'active'|'expired'|'disabled'
  trial_until?:string|null
}
function read<T>(key: string, fallback: T): T { try { return JSON.parse(localStorage.getItem(key) || '') as T } catch { return fallback } }
function loadDemandProfileForDemo():SharedDemandProfile|null {
  const value=read<SharedDemandProfile|null>('geodom-shared-demand-profile-v1',null)
  return value && typeof value.id==='string' ? value : null
}
function save(key: string, value: unknown) { localStorage.setItem(key, JSON.stringify(value)) }
function getSession(): { user: User; token: string } | null { try { return JSON.parse(sessionStorage.getItem(sessionKey) || '') } catch { return null } }
const storeSession = (session: { user: User; token: string } | null) => session ? sessionStorage.setItem(sessionKey, JSON.stringify(session)) : sessionStorage.removeItem(sessionKey)
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = getSession()
  const controller=new AbortController()
  const timeout=globalThis.setTimeout(() => controller.abort(),requestTimeoutMs)
  let response:Response

  try {
    response=await fetch(`${base}${path}`,{
      ...options,
      signal:options.signal ?? controller.signal,
      headers:{
        ...(options.body instanceof FormData ? {} : {'Content-Type':'application/json'}),
        ...(session?.token ? {Authorization:`Bearer ${session.token}`} : {}),
        ...options.headers
      }
    })
  } catch(error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('Сервер отвечает слишком долго. Попробуйте ещё раз.',null)
    }
    throw new ApiError('Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.',null)
  } finally {
    globalThis.clearTimeout(timeout)
  }

  if (!response.ok) {
    let message='Не удалось выполнить действие'
    try {
      const body=await response.json()
      message=typeof body.detail === 'string' ? body.detail : body.message || message
    } catch { /* no JSON error */ }
    throw new ApiError(message,response.status)
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') return undefined as T
  const raw=await response.text()
  if (!raw) return undefined as T
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new ApiError('Сервер вернул ответ в неожиданном формате.',response.status)
  }
}
const demoHomes = () => [...demoApartments, ...read<Apartment[]>(homesKey, [])]
function backendListingPayload(input:ListingInput) {
  return { ...input }
}

function fromBackendDemandProfile(raw:BackendDemandProfile,user:User):SharedDemandProfile {
  return {
    id:`backend:${raw.user_id}`,
    userId:String(raw.user_id),
    name:raw.name || user.login,
    contact:raw.contact || '',
    consentToContact:Boolean(raw.consent_to_contact),
    budgetMax:Number(raw.budget_max || 0),
    districts:Array.isArray(raw.district_names) ? raw.district_names : [],
    roomsMin:Number(raw.rooms_min || 0),
    roomsMax:Number(raw.rooms_max || 0),
    maxCommuteMinutes:Number(raw.max_commute_minutes || 0),
    priorities:Array.isArray(raw.priorities) ? raw.priorities : [],
    workLocation:raw.work_location ?? null,
    createdAt:raw.created_at,
    updatedAt:raw.updated_at
  }
}

function toBackendDemandProfile(profile:SharedDemandProfile) {
  return {
    intent:'buy',
    budget_max:profile.budgetMax,
    monthly_rent_max:null,
    district_names:profile.districts,
    rooms_min:profile.roomsMin,
    rooms_max:profile.roomsMax,
    max_commute_minutes:profile.maxCommuteMinutes,
    priorities:profile.priorities,
    work_label:profile.workLocation ? `${profile.workLocation.lat.toFixed(5)}, ${profile.workLocation.lon.toFixed(5)}` : '',
    work_location:profile.workLocation,
    contact:profile.contact,
    consent_to_contact:profile.consentToContact,
    active:true
  }
}

function fromBackendProLead(raw:BackendProLead):ProLead {
  return {
    id:`user:${raw.user_id}`,
    name:raw.name || `Пользователь ${raw.user_id}`,
    intent:raw.intent,
    budgetMax:Number(raw.budget_max || 0),
    monthlyRentMax:raw.monthly_rent_max ?? undefined,
    districts:Array.isArray(raw.district_names) ? raw.district_names : [],
    roomsMin:Number(raw.rooms_min || 0),
    roomsMax:Number(raw.rooms_max || 0),
    maxCommuteMinutes:Number(raw.max_commute_minutes || 0),
    priorities:Array.isArray(raw.priorities) ? raw.priorities : [],
    workLabel:raw.work_label || 'Место работы не задано',
    createdAt:raw.created_at,
    consentToContact:Boolean(raw.consent_to_contact),
    contact:raw.contact || '',
    source:'backend'
  }
}

async function imageData(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.72)
}
export const api = {
  session: getSession,
  async recommend(input: RecommendationRequest): Promise<RecommendationResponse> {
    const response = isDemo ? (await delay(), demoRecommend(input)) : normalizeRecommendation(await request<RecommendationResponse>('/api/v1/recommendations', { method:'POST', body:JSON.stringify(input) }),base)
    rememberRecommendation(response)
    return response
  },
  async event(payload: InteractionPayload): Promise<void> {
    if (isDemo) { logDemoEvent(payload); return }
    await request<void>('/api/v1/events', { method:'POST', body:JSON.stringify(payload) })
  },
  async list(): Promise<Apartment[]> {
    if (isDemo) {
      await delay()
      return demoHomes().filter(x => x.status === 'published').map(withLocalHousingMedia)
    }
    return (await request<Apartment[]>('/api/apartments')).map(withLocalHousingMedia)
  },
  async geoObjects(): Promise<GeoObject[]> { if (isDemo) { await delay(); return normalizeGeoObjects(demoGeoRows) } return normalizeGeoObjects(await request<unknown>('/api/geo-objects')) },
  async districtStats(): Promise<DistrictStats[]> {
    if (isDemo) {
      await delay()
      return buildDistrictStats(demoHomes().filter(x => x.status === 'published').map(withLocalHousingMedia))
    }
    const rows = await request<Array<{
      id:number|string
      name:string
      apartment_count:number
      median_price?:number|null
      median_price_m2?:number|null
      median_area?:number|null
      photo_coverage?:number|null
      min_price?:number|null
      max_price?:number|null
    }>>('/api/district-stats')
    return rows.map(row => ({
      id:String(row.id),
      name:row.name as DistrictStats['name'],
      count:Number(row.apartment_count || 0),
      medianPrice:row.median_price ?? null,
      medianPriceM2:row.median_price_m2 ?? null,
      medianArea:row.median_area ?? null,
      averageScore:null,
      photoCoverage:row.photo_coverage ?? null,
      minPrice:row.min_price ?? null,
      maxPrice:row.max_price ?? null
    }))
  },
  async demandProfile(): Promise<SharedDemandProfile|null> {
    if (isDemo) return loadDemandProfileForDemo()
    const user=getSession()?.user
    if (!user) return null
    const raw=await request<BackendDemandProfile|null>('/api/demand-profile')
    return raw ? fromBackendDemandProfile(raw,user) : null
  },
  async saveDemandProfile(profile:SharedDemandProfile): Promise<SharedDemandProfile> {
    if (isDemo) return profile
    const user=getSession()?.user
    if (!user) throw new Error('Для публикации профиля поиска войдите в аккаунт')
    const raw=await request<BackendDemandProfile>('/api/demand-profile',{method:'PUT',body:JSON.stringify(toBackendDemandProfile(profile))})
    return fromBackendDemandProfile(raw,user)
  },
  async deleteDemandProfile(): Promise<void> {
    if (isDemo) return
    await request<void>('/api/demand-profile',{method:'DELETE'})
  },
  async proStatus(): Promise<ProAccountStatus> {
    if (isDemo) return {user_id:getSession()?.user.id || 'demo',status:'active'}
    return request<ProAccountStatus>('/api/pro/status')
  },
  async startProTrial(): Promise<ProAccountStatus> {
    if (isDemo) return {user_id:getSession()?.user.id || 'demo',status:'trial'}
    return request<ProAccountStatus>('/api/pro/trial',{method:'POST',body:'{}'})
  },
  async proLeads(apartmentId:string): Promise<Array<{lead:ProLead;score:number;reasons:string[];stage:LeadStage}>> {
    if (isDemo) return []
    const rows=await request<BackendProLead[]>(`/api/pro/leads?apartment_id=${encodeURIComponent(apartmentId)}`)
    return rows.map(row=>({lead:fromBackendProLead(row),score:Number(row.match_score || 0),reasons:row.reasons || [],stage:row.stage || 'new'}))
  },
  async setProLeadStage(apartmentId:string,leadId:string,stage:LeadStage): Promise<void> {
    if (isDemo) return
    const leadUserId=leadId.replace(/^user:/,'')
    await request<void>(`/api/pro/leads/${encodeURIComponent(leadUserId)}/stage`,{method:'PUT',body:JSON.stringify({apartment_id:Number(apartmentId),stage})})
  },
  async promotion(apartmentId:string): Promise<{apartment_id:number;status:string;starts_at:string;ends_at:string}|null> {
    if (isDemo) return null
    return request<{apartment_id:number;status:string;starts_at:string;ends_at:string}|null>(`/api/pro/promotions/${encodeURIComponent(apartmentId)}`)
  },
  async promote(apartmentId:string,days=7): Promise<void> {
    if (isDemo) return
    await request(`/api/pro/promotions/${encodeURIComponent(apartmentId)}`,{method:'POST',body:JSON.stringify({days})})
  },
  async cancelPromotion(apartmentId:string): Promise<void> {
    if (isDemo) return
    await request<void>(`/api/pro/promotions/${encodeURIComponent(apartmentId)}`,{method:'DELETE'})
  },
  async detail(id: string): Promise<Apartment> {
    if (isDemo) {
      await delay()
      const item=demoHomes().find(x => x.id === id && x.status !== 'deleted')
      if (!item) throw new Error('Объявление не найдено')
      return withLocalHousingMedia(item)
    }
    return withLocalHousingMedia(await request<Apartment>(`/api/apartments/${encodeURIComponent(id)}`))
  },
  async mine(): Promise<Apartment[]> { if (isDemo) { await delay(); return demoHomes().filter(x => x.owner_id === getSession()?.user.id && x.status !== 'deleted') } return request<Apartment[]>('/api/users/me/apartments') },
  async register(login: string, password: string): Promise<User> {
    if (!isDemo) return request<User>('/api/auth/register', { method: 'POST', body: JSON.stringify({ login, password }) })
    await delay(); const users = read<{ user: User; digest: string }[]>(usersKey, [])
    if (users.some(x => x.user.login.toLowerCase() === login.toLowerCase())) throw new Error('Этот логин уже занят')
    const user = { id: createId(), login }; users.push({ user, digest: demoPasswordDigest(password) }); save(usersKey, users); return user
  },
  async login(login: string, password: string): Promise<User> {
    if (!isDemo) { const result = await request<{ access_token: string; user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) }); storeSession({ user: result.user, token: result.access_token }); return result.user }
    await delay(); const account = read<{ user: User; digest: string }[]>(usersKey, []).find(x => x.user.login.toLowerCase() === login.toLowerCase())
    if (!account || !await matchesDemoPassword(password,account.digest)) throw new Error('Неверный логин или пароль')
    storeSession({ user: account.user, token: 'demo-only' }); return account.user
  },
  async currentUser(): Promise<User | null> {
    if (isDemo) return getSession()?.user ?? null
    if (!getSession()) return null
    try {
      return await request<User>('/api/auth/me')
    } catch(error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        storeSession(null)
        return null
      }
      return getSession()?.user ?? null
    }
  },
  logout() { storeSession(null) },
  async create(input: ListingInput): Promise<Apartment> {
    if (!isDemo) {
      return request<Apartment>('/api/apartments', { method:'POST',body:JSON.stringify(backendListingPayload(input)) })
    }
    const owner = getSession()?.user; if (!owner) throw new Error('Для публикации войдите в аккаунт')
    const districtName=input.district_name || 'Уточняется'
    const item: Apartment = { id: createId(), ...input, house_number: input.address.match(/\d+[а-яА-Я]?\s*$/)?.[0] || '', latitude: 0, longitude: 0, district: { id:districtName === 'Уточняется' ? 'pending' : districtName.toLocaleLowerCase('ru').replace(/\s+/g,'-'), name:districtName, description:districtName === 'Уточняется' ? 'Район не указан.' : 'Район выбран пользователем; сервер сможет перепроверить его по адресу.' }, photos: [], source:'user', created_at: new Date().toISOString(), status:'published', owner_id:owner.id, features: { schools_1km:0, parks_1km:0, kindergartens_1km:0, nearest_school_m:0, nearest_park_m:0, nearest_transport_m:0 }, development_projects:[], recommendation:{ score:null, reasons:[], model_version:'', ml_available:false, warning:'Оценка появится после подключения сервера.' } }
    save(homesKey, [...read<Apartment[]>(homesKey, []), item]); return item
  },
  async update(id: string, input: ListingInput): Promise<Apartment> {
    if (!isDemo) {
      return request<Apartment>(`/api/apartments/${encodeURIComponent(id)}`, { method:'PATCH',body:JSON.stringify(backendListingPayload(input)) })
    }
    const items = read<Apartment[]>(homesKey, []); const index = items.findIndex(x => x.id === id && x.owner_id === getSession()?.user.id)
    if (index < 0) throw new Error('Объявление не найдено')
    items[index] = {
      ...items[index],
      ...input,
      district:input.district_name
        ? { ...items[index].district,name:input.district_name,description:'Район выбран пользователем; сервер сможет перепроверить его по адресу.' }
        : items[index].district
    }
    save(homesKey, items); return items[index]
  },
  async hide(id: string): Promise<void> {
    if (!isDemo) { await request(`/api/apartments/${encodeURIComponent(id)}`, { method:'DELETE' }); return }
    const items = read<Apartment[]>(homesKey, []); const item = items.find(x => x.id === id && x.owner_id === getSession()?.user.id)
    if (!item) throw new Error('Объявление не найдено'); item.status = 'hidden'; save(homesKey, items)
  },
  async upload(id: string, file: File): Promise<void> {
    if (!isDemo) { const data = new FormData(); data.append('file', file); await request(`/api/apartments/${encodeURIComponent(id)}/photos`, { method:'POST', body:data }); return }
    const items = read<Apartment[]>(homesKey, []); const item = items.find(x => x.id === id && x.owner_id === getSession()?.user.id)
    if (!item) throw new Error('Объявление не найдено'); if (item.photos.length >= 10) throw new Error('Не больше 10 фотографий')
    const order = item.photos.length; item.photos.push({ id:createId(), url:await imageData(file), order, is_cover:order === 0 })
    try { save(homesKey, items) } catch { item.photos.pop(); throw new Error('В браузере закончилось место для фото. Подключите серверное хранилище.') }
  }
}
