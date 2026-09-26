import { demoApartments } from '../data/demo'
import { demoGeoRows } from '../data/demoGeoObjects'
import { demoRecommend, logDemoEvent, normalizeRecommendation, rememberRecommendation } from './recommendations'
import { normalizeGeoObjects, type GeoObject } from './dataSanitizers'
import { createId, demoPasswordDigest, matchesDemoPassword } from './id'
import { withLocalHousingMedia } from './media'
import type { Apartment, InteractionPayload, ListingInput, RecommendationRequest, RecommendationResponse, User } from '../types'

const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
export const isDemo = !base
const homesKey = 'geodom-demo-apartments-v1'
const usersKey = 'geodom-demo-users-v1'
const sessionKey = 'geodom-session-v1'
const delay = () => new Promise(resolve => setTimeout(resolve, 180))
function read<T>(key: string, fallback: T): T { try { return JSON.parse(localStorage.getItem(key) || '') as T } catch { return fallback } }
function save(key: string, value: unknown) { localStorage.setItem(key, JSON.stringify(value)) }
function getSession(): { user: User; token: string } | null { try { return JSON.parse(sessionStorage.getItem(sessionKey) || '') } catch { return null } }
const storeSession = (session: { user: User; token: string } | null) => session ? sessionStorage.setItem(sessionKey, JSON.stringify(session)) : sessionStorage.removeItem(sessionKey)
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = getSession()
  let response: Response
  try { response = await fetch(`${base}${path}`, { ...options, headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}), ...options.headers } }) }
  catch { throw new Error('Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.') }
  if (!response.ok) {
    let message = 'Не удалось выполнить действие'
    try { const body = await response.json(); message = typeof body.detail === 'string' ? body.detail : body.message || message } catch { /* no JSON error */ }
    throw new Error(message)
  }
  if (response.status === 204 || response.headers.get('content-length') === '0') return undefined as T
  const raw = await response.text()
  return raw ? JSON.parse(raw) as T : undefined as T
}
const demoHomes = () => [...demoApartments, ...read<Apartment[]>(homesKey, [])]
function backendListingPayload(input:ListingInput) {
  const payload:Partial<ListingInput>={ ...input }
  delete payload.district_name
  return payload
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
  async currentUser(): Promise<User | null> { if (isDemo) return getSession()?.user ?? null; if (!getSession()) return null; try { return await request<User>('/api/auth/me') } catch { storeSession(null); return null } },
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
