import { describe,expect,it } from 'vitest'
import { calculateRentVsBuy } from './RentVsBuyCalculator'

describe('rent vs buy model',() => {
  it('returns finite net worth values for a normal scenario',() => {
    const result=calculateRentVsBuy({
      apartmentPrice:8_000_000,
      downPayment:2_000_000,
      annualRate:16,
      years:10,
      monthlyRent:40_000,
      rentGrowthPercent:5,
      homeGrowthPercent:4,
      maintenancePercent:1,
      investmentReturnPercent:8,
      purchaseCostsPercent:1,
      saleCostsPercent:2
    })
    expect(Number.isFinite(result.buyerNetWorth)).toBe(true)
    expect(Number.isFinite(result.renterNetWorth)).toBe(true)
    expect(result.futureHomeValue).toBeGreaterThan(8_000_000)
    expect(result.totalRentPaid).toBeGreaterThan(40_000*120)
  })

  it('keeps zero-growth scenarios deterministic',() => {
    const result=calculateRentVsBuy({
      apartmentPrice:6_000_000,
      downPayment:6_000_000,
      annualRate:0,
      years:5,
      monthlyRent:30_000,
      rentGrowthPercent:0,
      homeGrowthPercent:0,
      maintenancePercent:0,
      investmentReturnPercent:0,
      purchaseCostsPercent:0,
      saleCostsPercent:0
    })
    expect(result.buyerNetWorth).toBe(6_000_000)
    expect(result.totalRentPaid).toBe(1_800_000)
  })
})
