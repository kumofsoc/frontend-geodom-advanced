// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { demoRecommend, getLastRecommendationItem, getSavedIds, logDemoEvent, normalizeRecommendation, readDemoEvents, rememberRecommendation, toggleSavedId } from './recommendations'
import type { RecommendationRequest } from '../types'

const request: RecommendationRequest = {
  budget_max: 15000000, down_payment: 2000000, family: { adults: 2, children: 1 },
  work_location: null, max_commute_minutes: 40,
  priorities: { schools: 5, parks: 1, transport: 1, ecology: 1, safety: 1 }, limit: 20
}
beforeEach(() => { localStorage.clear(); sessionStorage.clear() })

describe('demo recommendation gateway', () => {
  it('applies budget and preserves request context for events', () => {
    const response = demoRecommend({ ...request, budget_max: 7000000 })
    expect(response.request_id).toBeTruthy()
    expect(response.items.every(x => x.price <= 7000000)).toBe(true)
    expect(response.items.every(x => x.score >= 0 && x.score <= 10)).toBe(true)
    expect(response.ml_available).toBe(false)
  })
  it('changes ranking with selected priorities and does not invent missing measures', () => {
    const schools = demoRecommend(request)
    const parks = demoRecommend({ ...request, priorities: { ...request.priorities, schools: 1, parks: 5 } })
    const rank = (items: typeof schools.items, id: string) => items.findIndex(x => x.apartment_id === id)
    expect(rank(schools.items, 'a1')).toBeLessThan(rank(schools.items, 'a3'))
    expect(rank(parks.items, 'a3')).toBeLessThan(rank(parks.items, 'a1'))
    expect(parks.items[0].scores.ecology).toBeNull()
    expect(parks.items[0].predicted_price_m2).toBeNull()
    expect(parks.warnings.join(' ')).toMatch(/экологии|безопасности/)
  })
  it('reports missing route data when a workplace is provided', () => {
    const response = demoRecommend({ ...request, work_location: { lat: 56.01, lon: 92.87 } })
    expect(response.items[0].commute_minutes).toBeNull()
    expect(response.warnings.join(' ')).toMatch(/маршрут/)
  })
  it('retains the current score and request id for the apartment detail page', () => {
    const response = demoRecommend(request)
    rememberRecommendation(response)
    const match = getLastRecommendationItem('a1')
    expect(match?.response.request_id).toBe(response.request_id)
    expect(match?.item.score).toBe(response.items.find(x => x.apartment_id === 'a1')?.score)
    expect(getLastRecommendationItem('missing')).toBeNull()
  })
  it('accepts the minimal backend DTO and resolves relative photo URLs', () => {
    const raw = { request_id:'req-backend', model_version:'catboost-v1', scoring_version:'weighted-v1', items:[{ apartment_id:123,title:'Квартира',price:8900000,price_m2:159000,score:8.7,scores:{schools:8.9,parks:8.4,transport:9.1},reasons:['Школа рядом'],cover_image_url:'/media/cover.webp' }] }
    const result = normalizeRecommendation(raw,'https://api.example.test')
    expect(result.items[0].cover_image_url).toBe('https://api.example.test/media/cover.webp')
    expect(result.items[0].scores.ecology).toBeNull()
    expect(result.items[0].warnings).toEqual([])
    expect(result.warnings).toEqual([])
  })
})

describe('interaction record', () => {
  it('stores event context and toggles saved listings locally', () => {
    logDemoEvent({ request_id:'req-test', event:'impression', entity_type:'apartment', entity_id:'a1', position:1 })
    expect(readDemoEvents()).toMatchObject([{ request_id:'req-test', event:'impression', entity_id:'a1', position:1 }])
    expect(toggleSavedId('a1')).toBe(true)
    expect(getSavedIds()).toEqual(['a1'])
    expect(toggleSavedId('a1')).toBe(false)
    expect(getSavedIds()).toEqual([])
  })
})
