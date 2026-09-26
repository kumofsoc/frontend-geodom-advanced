import { isDemo } from './config'
import { request } from './http'
import type { RentVsBuyBackendRequest,RentVsBuyBackendResponse } from '../types'

function monthlyRate(annualPercent:number) {
  return Math.pow(1+Math.max(-.99,annualPercent/100),1/12)-1
}

function demoCalculate(input:RentVsBuyBackendRequest):RentVsBuyBackendResponse {
  const months=Math.max(1,Math.round(input.horizon_years*12))
  const mortgageMonths=Math.max(1,Math.round(input.mortgage_years*12))
  const principal=Math.max(0,input.apartment_price-input.down_payment)
  const mortgageRate=Math.max(0,input.annual_rate)/100/12
  const mortgageMonthly=principal === 0 ? 0 : mortgageRate === 0 ? principal/mortgageMonths : principal*(mortgageRate*Math.pow(1+mortgageRate,mortgageMonths))/(Math.pow(1+mortgageRate,mortgageMonths)-1)
  let rent=input.monthly_rent
  const rentGrowth=monthlyRate(input.rent_growth_percent)
  let rentTotal=0
  let ownershipTotal=input.down_payment+input.apartment_price*(input.purchase_costs_percent/100)
  let cumulativeRent=0
  let cumulativeOwn=ownershipTotal
  let breakEvenYear:number|null=null

  for(let month=1;month<=months;month++) {
    rent*=1+rentGrowth
    rentTotal+=rent
    const maintenance=input.apartment_price*(input.maintenance_percent/100)/12
    const own=(month <= mortgageMonths ? mortgageMonthly : 0)+maintenance
    ownershipTotal+=own
    cumulativeRent+=rent
    cumulativeOwn+=own
    if (breakEvenYear === null && cumulativeOwn <= cumulativeRent) breakEvenYear=Math.ceil(month/12)
  }

  return {
    mortgage_monthly:Math.round(mortgageMonthly),rent_monthly:Math.round(input.monthly_rent),
    ownership_total:Math.round(ownershipTotal),rent_total:Math.round(rentTotal),break_even_year:breakEvenYear,
    horizon_years:input.horizon_years,
    assumptions:{
      horizon_years:input.horizon_years,monthly_rent:input.monthly_rent,rent_growth_percent:input.rent_growth_percent,
      home_growth_percent:input.home_growth_percent,maintenance_percent:input.maintenance_percent,
      investment_return_percent:input.investment_return_percent,purchase_costs_percent:input.purchase_costs_percent,sale_costs_percent:input.sale_costs_percent
    },
    source_name:'GeoDom demo assumptions',updated_at:new Date().toISOString(),
    warnings:['Демо-режим: buy-vs-rent рассчитан локально. В live-режиме результат должен приходить с backend.']
  }
}

export const rentApi={
  async calculate(input:RentVsBuyBackendRequest,signal?:AbortSignal):Promise<RentVsBuyBackendResponse> {
    if (isDemo) return demoCalculate(input)
    return request<RentVsBuyBackendResponse>('/api/v1/rent-vs-buy/calculate',{method:'POST',body:JSON.stringify(input),signal})
  }
}
