import { describe, expect, it } from 'vitest'
import { filterApartments, validateApartment } from './catalog'
import type { Apartment } from '../types'

const home = (id: string, district: string, price: number, rooms: number, area: number): Apartment => ({
  id, title: 'Квартира', price, rooms, area, floor: 3, total_floors: 9,
  address: 'Красноярск, улица Ленина, 25', house_number: '25', latitude: 56, longitude: 92,
  district: { id: district, name: district, description: '' }, description: '', photos: [],
  source: 'seed', created_at: '', status: 'published', owner_id: null,
  features: { schools_1km: 2, parks_1km: 1, kindergartens_1km: 2, nearest_school_m: 400, nearest_park_m: 300, nearest_transport_m: 200 },
  development_projects: [], recommendation: { score: 82, reasons: [], model_version: 'demo', ml_available: true }
})

describe('catalog filters', () => {
  const homes = [home('1', 'Центральный', 8000000, 2, 54), home('2', 'Советский', 5300000, 1, 38), home('3', 'Центральный', 12000000, 3, 88)]
  it('combines district, budget, rooms, and search', () => {
    expect(filterApartments(homes, { district: 'Центральный', maxPrice: 9000000, rooms: 2, query: 'Ленина', sort: 'recommended' }).map(x => x.id)).toEqual(['1'])
  })
  it('orders prices ascending and leaves input unchanged', () => {
    expect(filterApartments(homes, { district: '', maxPrice: 0, rooms: 0, query: '', sort: 'price_asc' }).map(x => x.id)).toEqual(['2', '1', '3'])
    expect(homes[0].id).toBe('1')
  })
})

describe('listing validation', () => {
  it('rejects impossible area and floor', () => {
    expect(validateApartment({ title: 'Студия', address: 'Ленина, 25', price: 5000000, area: 0, rooms: 1, floor: 12, total_floors: 9, description: 'Описание' })).toContain('Площадь должна быть больше нуля')
    expect(validateApartment({ title: 'Студия', address: 'Ленина, 25', price: 5000000, area: 32, rooms: 1, floor: 12, total_floors: 9, description: 'Описание' })).toContain('Этаж не может превышать этажность дома')
  })
})
