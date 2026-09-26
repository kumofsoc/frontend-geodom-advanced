import type { RentVsBuyBackendRequest,RentVsBuyBackendResponse } from '../types'

const complexKey='geodom-selected-complexes-v1'
const rentKey='geodom-last-rent-vs-buy-v1'

export type SavedRentVsBuyDecision={
  apartmentPrice:number
  request:RentVsBuyBackendRequest
  result:RentVsBuyBackendResponse
  savedAt:string
}

export function loadSelectedComplexIds():string[] {
  try {
    const value=JSON.parse(localStorage.getItem(complexKey) || '[]')
    return Array.isArray(value) ? [...new Set(value.map(String))].slice(0,3) : []
  } catch { return [] }
}

export function saveSelectedComplexIds(ids:string[]) {
  localStorage.setItem(complexKey,JSON.stringify([...new Set(ids)].slice(0,3)))
}

export function saveRentVsBuyDecision(value:SavedRentVsBuyDecision) {
  localStorage.setItem(rentKey,JSON.stringify(value))
}

export function loadRentVsBuyDecision():SavedRentVsBuyDecision|null {
  try {
    const value=JSON.parse(localStorage.getItem(rentKey) || '') as SavedRentVsBuyDecision
    if (!value || typeof value.apartmentPrice !== 'number' || !value.request || !value.result) return null
    return value
  } catch { return null }
}

export const decisionSnapshotKeys={complexKey,rentKey}
