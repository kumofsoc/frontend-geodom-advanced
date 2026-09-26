import { isDemo } from './config'
import { request } from './http'
import type { MortgageCalculationRequest,MortgageCalculationResponse } from '../types'

function localMortgage(input:MortgageCalculationRequest):MortgageCalculationResponse {
  const principal=Math.max(0,input.apartment_price-Math.min(input.apartment_price,input.down_payment))
  const months=Math.max(1,Math.round(input.term_years*12))
  const rate=Math.max(0,input.annual_rate)/100/12
  const monthly=principal === 0 ? 0 : rate === 0 ? principal/months : principal*(rate*Math.pow(1+rate,months))/(Math.pow(1+rate,months)-1)
  const total=monthly*months
  return {
    loan_amount:Math.round(principal),monthly_payment:Math.round(monthly),total_payment:Math.round(total),
    overpayment:Math.round(Math.max(0,total-principal)),annual_rate:input.annual_rate,term_years:input.term_years,term_months:months
  }
}

export const mortgageApi={
  async calculate(input:MortgageCalculationRequest,signal?:AbortSignal):Promise<MortgageCalculationResponse> {
    if (isDemo) return localMortgage(input)
    return request<MortgageCalculationResponse>('/api/v1/mortgage/calculate',{method:'POST',body:JSON.stringify(input),signal})
  }
}
