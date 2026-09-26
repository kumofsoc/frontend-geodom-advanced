import type { Apartment, CatalogFilters, ListingInput } from '../types'
export function filterApartments(items: Apartment[], filters: CatalogFilters) {
  const query = filters.query.trim().toLocaleLowerCase('ru')
  return items.filter(a => a.status === 'published'
    && (!filters.district || a.district.name === filters.district)
    && (!filters.maxPrice || a.price <= filters.maxPrice)
    && (!filters.rooms || a.rooms === filters.rooms)
    && (!query || `${a.title} ${a.address} ${a.district.name}`.toLocaleLowerCase('ru').includes(query)))
    .sort((a, b) => filters.sort === 'price_asc' ? a.price - b.price : filters.sort === 'price_desc' ? b.price - a.price : filters.sort === 'area_desc' ? b.area - a.area : (b.recommendation.score ?? -1) - (a.recommendation.score ?? -1))
}
export function validateApartment(input: ListingInput): string[] {
  const errors: string[] = []
  if (!input.title.trim()) errors.push('Укажите название объявления')
  if (!input.address.trim()) errors.push('Укажите адрес')
  if (!Number.isFinite(input.price) || input.price <= 0) errors.push('Цена должна быть больше нуля')
  if (!Number.isFinite(input.area) || input.area <= 0) errors.push('Площадь должна быть больше нуля')
  if (!Number.isInteger(input.rooms) || input.rooms < 0) errors.push('Укажите корректное число комнат')
  if (!Number.isInteger(input.total_floors) || input.total_floors < 1) errors.push('Укажите этажность дома')
  if (!Number.isInteger(input.floor) || input.floor < 1) errors.push('Укажите корректный этаж')
  if (input.floor > input.total_floors) errors.push('Этаж не может превышать этажность дома')
  return errors
}
export const price = (n: number) => new Intl.NumberFormat('ru-RU').format(n) + ' ₽'
export const area = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(n) + ' м²'
export const distance = (n: number) => n < 1000 ? `${n} м` : `${(n / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} км`
