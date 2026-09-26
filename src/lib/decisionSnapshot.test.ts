// @vitest-environment jsdom
import { beforeEach,describe,expect,it } from 'vitest'
import { loadRentVsBuyDecision,loadSelectedComplexIds,saveRentVsBuyDecision,saveSelectedComplexIds } from './decisionSnapshot'

beforeEach(() => localStorage.clear())

describe('decision snapshot',() => {
  it('keeps at most three selected complexes',() => {
    saveSelectedComplexIds(['1','2','3','4','2'])
    expect(loadSelectedComplexIds()).toEqual(['1','2','3'])
  })

  it('persists the last buy-vs-rent result for the report',() => {
    saveRentVsBuyDecision({
      apartmentPrice:8_000_000,
      request:{apartment_price:8_000_000,down_payment:2_000_000,annual_rate:18,mortgage_years:20,horizon_years:10,monthly_rent:40_000,rent_growth_percent:5,home_growth_percent:4,maintenance_percent:1,investment_return_percent:8,purchase_costs_percent:1,sale_costs_percent:2},
      result:{mortgage_monthly:92_000,rent_monthly:40_000,ownership_total:15_000_000,rent_total:6_000_000,break_even_year:null,horizon_years:10,assumptions:{horizon_years:10,monthly_rent:40_000,rent_growth_percent:5,home_growth_percent:4,maintenance_percent:1,investment_return_percent:8,purchase_costs_percent:1,sale_costs_percent:2},source_name:'backend',updated_at:'2026-09-26',warnings:[]},
      savedAt:'2026-09-26T00:00:00Z'
    })
    expect(loadRentVsBuyDecision()?.result.mortgage_monthly).toBe(92_000)
  })
})
