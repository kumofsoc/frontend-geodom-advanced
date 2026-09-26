import type { RecommendationRequest } from '../types'
const key = 'geodom-recommendation-preferences-v1'
export const defaultPreferences: RecommendationRequest = {
  budget_max: 12000000, down_payment: 2000000, family:{ adults:2, children:1 },
  work_location:null, max_commute_minutes:40,
  priorities:{ schools:4, parks:4, transport:4, ecology:3, safety:3 }, limit:20
}
export function validatePreferences(value: RecommendationRequest): string | null {
  if (!Number.isFinite(value.budget_max) || value.budget_max <= 0) return 'Укажите бюджет больше нуля'
  if (!Number.isFinite(value.down_payment) || value.down_payment < 0) return 'Укажите корректный первоначальный взнос'
  if (value.down_payment > value.budget_max) return 'Первоначальный взнос не может превышать бюджет'
  if (value.family.adults < 1) return 'Укажите хотя бы одного взрослого'
  return null
}
export function loadPreferences(): RecommendationRequest {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '') as RecommendationRequest
    return saved && !validatePreferences(saved) && saved.priorities ? saved : defaultPreferences
  } catch { return defaultPreferences }
}
export function savePreferences(value: RecommendationRequest) { localStorage.setItem(key, JSON.stringify(value)) }
