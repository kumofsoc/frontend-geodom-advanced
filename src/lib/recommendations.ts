import { demoApartments } from '../data/demo'
import type { InteractionPayload, RecommendationItem, RecommendationRequest, RecommendationResponse } from '../types'

const savedKey = 'geodom-saved-apartments-v1'
const eventKey = 'geodom-demo-events-v1'
const lastKey = 'geodom-last-recommendation-v1'
const clamp = (value: number) => Math.max(0, Math.min(10, value))
const round = (value: number) => Math.round(value * 10) / 10
function read<T>(key: string, fallback: T): T { try { return JSON.parse(localStorage.getItem(key) || '') as T } catch { return fallback } }

type RawItem = Omit<Partial<RecommendationItem>, 'scores'> & Pick<RecommendationItem, 'apartment_id' | 'title' | 'price' | 'score'> & { scores?: Partial<RecommendationItem['scores']> }
export function normalizeRecommendation(raw: { request_id:string; model_version:string; scoring_version:string; ml_available?:boolean; warnings?:string[]; items:RawItem[] }, origin:string): RecommendationResponse {
  const keys: Array<keyof RecommendationItem['scores']> = ['schools','parks','transport','ecology','safety','commute','price']
  return {
    request_id:raw.request_id, model_version:raw.model_version, scoring_version:raw.scoring_version,
    ml_available:raw.ml_available ?? true, warnings:raw.warnings ?? [],
    items:raw.items.map(item => ({
      apartment_id:item.apartment_id, title:item.title, price:item.price, price_m2:item.price_m2 ?? 0,
      predicted_price_m2:item.predicted_price_m2 ?? null, score:item.score,
      scores:Object.fromEntries(keys.map(key => [key,item.scores?.[key] ?? null])) as RecommendationItem['scores'],
      commute_minutes:item.commute_minutes ?? null, reasons:item.reasons ?? [], warnings:item.warnings ?? [],
      cover_image_url:item.cover_image_url ? origin ? new URL(item.cover_image_url,origin).toString() : item.cover_image_url : null
    }))
  }
}

export function demoRecommend(input: RecommendationRequest): RecommendationResponse {
  const warnings = ['Демонстрационный расчёт: ML-модель и прогноз цены пока не подключены.', 'Нет данных об экологии и безопасности; эти приоритеты не участвуют в оценке.']
  if (input.work_location) warnings.push('В демо нет маршрутных данных: время до работы и ограничение по поездке не учитываются.')
  if (input.down_payment) warnings.push('Первоначальный взнос сохранён в запросе, но не влияет на оценку в демо.')
  const eligible = demoApartments.filter(home => !input.budget_max || home.price <= input.budget_max)
  const items: RecommendationItem[] = eligible.map(home => {
    const f = home.features
    const schools = round(clamp(f.schools_1km * 2 + (f.nearest_school_m < 500 ? 2 : 0)))
    const parks = round(clamp(f.parks_1km * 2.4 + (f.nearest_park_m < 500 ? 2 : 0)))
    const transport = round(clamp(10 - f.nearest_transport_m / 80))
    const affordability = round(clamp(input.budget_max ? 10 - 3 * home.price / input.budget_max : 8))
    const schoolWeight = input.priorities.schools + Math.min(2, input.family.children)
    const parkWeight = input.priorities.parks
    const transportWeight = input.priorities.transport
    const weightTotal = schoolWeight + parkWeight + transportWeight + 1
    const score = round((schools * schoolWeight + parks * parkWeight + transport * transportWeight + affordability) / weightTotal)
    return {
      apartment_id: home.id, title: home.title, price: home.price, price_m2: Math.round(home.price / home.area),
      predicted_price_m2: null, score,
      scores: { schools, parks, transport, ecology: null, safety: null, commute: null, price: affordability },
      commute_minutes: null,
      reasons: [`${f.schools_1km} школы рядом (до 1 км)`, `Парк в ${f.nearest_park_m} м`, `Транспорт в ${f.nearest_transport_m} м`],
      warnings: [], cover_image_url: home.photos[0]?.url || null
    }
  }).sort((a,b) => b.score - a.score)
  return { request_id: crypto.randomUUID(), model_version:'demo-no-model', scoring_version:'demo-weighted-v1', ml_available:false, warnings, items:items.slice(0,input.limit) }
}

export function logDemoEvent(payload: InteractionPayload): void {
  const events = read<Array<InteractionPayload & { timestamp: string }>>(eventKey, [])
  events.push({ ...payload, timestamp:new Date().toISOString() })
  localStorage.setItem(eventKey, JSON.stringify(events.slice(-500)))
}
export function readDemoEvents() { return read<Array<InteractionPayload & { timestamp: string }>>(eventKey, []) }
export function rememberRecommendation(response: RecommendationResponse): void { sessionStorage.setItem(lastKey, JSON.stringify(response)) }
export function getLastRecommendationItem(id: string): { response: RecommendationResponse; item: RecommendationItem } | null {
  try {
    const response = JSON.parse(sessionStorage.getItem(lastKey) || '') as RecommendationResponse
    const item = response.items.find(candidate => String(candidate.apartment_id) === id)
    return item ? { response, item } : null
  } catch { return null }
}
export function getSavedIds(): string[] { return read<string[]>(savedKey, []) }
export function toggleSavedId(id: string): boolean {
  const current = getSavedIds()
  const next = current.includes(id) ? current.filter(value => value !== id) : [...current,id]
  localStorage.setItem(savedKey, JSON.stringify(next))
  return next.includes(id)
}
