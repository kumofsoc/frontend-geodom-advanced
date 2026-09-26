import { describe,expect,it } from 'vitest'
import { calculateMortgage } from './MortgageCalculator'

describe('mortgage calculator',() => {
  it('calculates a standard annuity payment',() => {
    const result=calculateMortgage(10_000_000,2_000_000,12,20)
    expect(result.principal).toBe(8_000_000)
    expect(Math.round(result.monthlyPayment)).toBe(88087)
    expect(result.totalPayment).toBeGreaterThan(result.principal)
    expect(result.overpayment).toBeGreaterThan(0)
  })

  it('handles zero interest and clamps the down payment',() => {
    expect(calculateMortgage(6_000_000,1_000_000,0,10).monthlyPayment).toBeCloseTo(41666.666,2)
    expect(calculateMortgage(6_000_000,9_000_000,20,20)).toEqual({
      principal:0,monthlyPayment:0,totalPayment:0,overpayment:0
    })
  })
})
