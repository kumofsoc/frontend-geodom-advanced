import { useEffect,useMemo,useState } from 'react'
import { ArrowRightLeft, Home, Landmark, TrendingUp } from 'lucide-react'
import { price } from '../lib/catalog'
import { calculateMortgage } from './MortgageCalculator'
import { KRASNOYARSK_MORTGAGE_BANKS,mortgageOfferEligibility } from '../lib/mortgageBanks'
import { api,isDemo } from '../lib/api'
import { AssumptionsDrawer,DataFreshness,SourceBadge,WarningBanner } from './DataTrust'
import type { RentVsBuyBackendResponse } from '../types'
import { saveRentVsBuyDecision } from '../lib/decisionSnapshot'

export type RentVsBuyInput = {
  apartmentPrice:number
  downPayment:number
  annualRate:number
  years:number
  mortgageYears:number
  monthlyRent:number
  rentGrowthPercent:number
  homeGrowthPercent:number
  maintenancePercent:number
  investmentReturnPercent:number
  purchaseCostsPercent:number
  saleCostsPercent:number
}

export type RentVsBuyResult = {
  buyerNetWorth:number
  renterNetWorth:number
  difference:number
  futureHomeValue:number
  remainingMortgage:number
  renterPortfolio:number
  buyerPortfolio:number
  monthlyMortgage:number
  totalRentPaid:number
}

function monthlyRate(annualPercent:number) {
  return Math.pow(1+Math.max(-.99,annualPercent/100),1/12)-1
}

function mortgageBalance(principal:number,annualRate:number,totalMonths:number,paidMonths:number,payment:number) {
  if (paidMonths >= totalMonths) return 0
  const rate=Math.max(0,annualRate)/100/12
  if (rate === 0) return Math.max(0,principal-payment*paidMonths)
  const growth=Math.pow(1+rate,paidMonths)
  return Math.max(0,principal*growth-payment*(growth-1)/rate)
}

// Pure demo/reference model retained for tests and the explicit demo adapter.
// Live UI never calls this function directly.
export function calculateRentVsBuy(input:RentVsBuyInput):RentVsBuyResult {
  const horizonMonths=Math.max(1,Math.round(input.years*12))
  const mortgageYears=Math.max(1,input.mortgageYears)
  const mortgage=calculateMortgage(input.apartmentPrice,input.downPayment,input.annualRate,mortgageYears)
  const mortgageMonths=Math.round(mortgageYears*12)
  const homeGrowth=monthlyRate(input.homeGrowthPercent)
  const rentGrowth=monthlyRate(input.rentGrowthPercent)
  const investmentGrowth=monthlyRate(input.investmentReturnPercent)
  let homeValue=input.apartmentPrice
  let rent=input.monthlyRent
  let renterPortfolio=input.downPayment+input.apartmentPrice*(input.purchaseCostsPercent/100)
  let buyerPortfolio=0
  let totalRentPaid=0

  for (let month=1;month<=horizonMonths;month++) {
    homeValue*=1+homeGrowth
    rent*=1+rentGrowth
    renterPortfolio*=1+investmentGrowth
    buyerPortfolio*=1+investmentGrowth
    const maintenance=homeValue*(input.maintenancePercent/100)/12
    const buyerHousingCost=(month <= mortgageMonths ? mortgage.monthlyPayment : 0)+maintenance
    totalRentPaid+=rent
    const difference=buyerHousingCost-rent
    if (difference > 0) renterPortfolio+=difference
    else buyerPortfolio+=-difference
  }

  const remainingMortgage=mortgageBalance(mortgage.principal,input.annualRate,mortgageMonths,Math.min(horizonMonths,mortgageMonths),mortgage.monthlyPayment)
  const saleCosts=homeValue*(input.saleCostsPercent/100)
  const buyerNetWorth=Math.max(0,homeValue-remainingMortgage-saleCosts)+buyerPortfolio
  return {
    buyerNetWorth,
    renterNetWorth:renterPortfolio,
    difference:buyerNetWorth-renterPortfolio,
    futureHomeValue:homeValue,
    remainingMortgage,
    renterPortfolio,
    buyerPortfolio,
    monthlyMortgage:mortgage.monthlyPayment,
    totalRentPaid
  }
}

export function RentVsBuyCalculator({apartmentPrice,defaultDownPayment=0}:{apartmentPrice:number;defaultDownPayment?:number}) {
  const [bankId,setBankId]=useState('sber')
  const [downPayment,setDownPayment]=useState(Math.min(apartmentPrice,defaultDownPayment > 0 ? defaultDownPayment : Math.round(apartmentPrice*.2)))
  const [years,setYears]=useState(10)
  const [mortgageYears,setMortgageYears]=useState(20)
  const [monthlyRent,setMonthlyRent]=useState(40_000)
  const [rentGrowth,setRentGrowth]=useState(5)
  const [homeGrowth,setHomeGrowth]=useState(4)
  const [maintenance,setMaintenance]=useState(1)
  const [investmentReturn,setInvestmentReturn]=useState(8)
  const [mode,setMode]=useState<'monthly'|'total'>('monthly')
  const [result,setResult]=useState<RentVsBuyBackendResponse|null>(null)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')

  const bank=KRASNOYARSK_MORTGAGE_BANKS.find(item => item.id === bankId) ?? KRASNOYARSK_MORTGAGE_BANKS[0]
  const eligibility=mortgageOfferEligibility(bank,apartmentPrice,downPayment,mortgageYears)
  const annualRate=bank.rateFrom

  const requestBody=useMemo(() => annualRate === null ? null : ({
    apartment_price:apartmentPrice,
    down_payment:downPayment,
    annual_rate:annualRate,
    mortgage_years:mortgageYears,
    horizon_years:years,
    monthly_rent:monthlyRent,
    rent_growth_percent:rentGrowth,
    home_growth_percent:homeGrowth,
    maintenance_percent:maintenance,
    investment_return_percent:investmentReturn,
    purchase_costs_percent:1,
    sale_costs_percent:2
  }),[apartmentPrice,downPayment,annualRate,mortgageYears,years,monthlyRent,rentGrowth,homeGrowth,maintenance,investmentReturn])

  useEffect(() => {
    if (!requestBody) {
      setResult(null)
      setError('У выбранного банка нет ставки для расчёта.')
      return
    }
    const controller=new AbortController()
    const timer=window.setTimeout(() => {
      setLoading(true)
      setError('')
      api.rentVsBuy(requestBody,controller.signal)
        .then(value => {
          if (controller.signal.aborted) return
          setResult(value)
          saveRentVsBuyDecision({apartmentPrice,request:requestBody,result:value,savedAt:new Date().toISOString()})
        })
        .catch(err => {
          if (controller.signal.aborted) return
          setResult(null)
          setError(err instanceof Error ? err.message : 'Расчёт временно недоступен')
        })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    },220)
    return () => { window.clearTimeout(timer);controller.abort() }
  },[requestBody])

  const statement=result?.break_even_year == null
    ? 'При выбранных допущениях точка, где покупка становится дешевле аренды, на заданном горизонте не найдена.'
    : `При выбранных допущениях покупка становится дешевле аренды примерно после ${result.break_even_year} лет.`

  return <section className="rent-buy-calculator">
    <div className="rent-buy-head">
      <span><ArrowRightLeft size={17}/></span>
      <div><small>КУПИТЬ ИЛИ СНИМАТЬ</small><h3>Сценарий на {years} лет</h3></div>
    </div>

    <div className="rent-buy-tabs" role="tablist">
      <button type="button" className={mode === 'monthly' ? 'active' : ''} onClick={() => setMode('monthly')}>Ежемесячный платёж</button>
      <button type="button" className={mode === 'total' ? 'active' : ''} onClick={() => setMode('total')}>Общая стоимость</button>
    </div>

    <div className="rent-buy-core-fields">
      <label><span>Аренда сейчас, ₽/мес</span><input type="number" min="0" step="1000" value={monthlyRent || ''} onChange={event => setMonthlyRent(Math.max(0,Number(event.target.value)))}/></label>
      <label><span>Первоначальный взнос</span><input type="number" min="0" max={apartmentPrice} step="10000" value={downPayment || ''} onChange={event => setDownPayment(Math.min(apartmentPrice,Math.max(0,Number(event.target.value))))}/></label>
      <label><span>Банк</span><select value={bankId} onChange={event => setBankId(event.target.value)}>{KRASNOYARSK_MORTGAGE_BANKS.filter(item => item.rateFrom !== null).map(item => <option value={item.id} key={item.id}>{item.bank} · от {item.rateFrom}%</option>)}</select></label>
      <label><span>Горизонт сравнения</span><select value={years} onChange={event => setYears(Number(event.target.value))}>{[3,5,7,10,15,20].map(value => <option value={value} key={value}>{value} лет</option>)}</select></label>
      <label><span>Срок ипотеки</span><select value={mortgageYears} onChange={event => setMortgageYears(Number(event.target.value))}>{[5,10,15,20,25,30].map(value => <option value={value} key={value}>{value} лет</option>)}</select></label>
    </div>

    {!eligibility.eligible && <WarningBanner title="Условия выбранного банка" warnings={[...eligibility.reasons,'Расчёт сценария не означает одобрение кредита.']}/>}
    {error && <WarningBanner title={isDemo ? 'Демо-расчёт недоступен' : 'Backend buy-vs-rent не ответил'} warnings={[error,...(!isDemo ? ['GeoDom не подменяет live-ошибку локальным mock-расчётом.'] : [])]}/>}

    {loading && <div className="rent-buy-loading"><span className="spinner"/> Пересчитываем сценарий…</div>}

    {result && <div className="rent-buy-result">
      {mode === 'monthly' ? <>
        <div className="rent-buy-column buy"><span><Home size={14}/> ИПОТЕКА</span><strong>{price(result.mortgage_monthly)}/мес</strong><small>по выбранной ставке и сроку</small></div>
        <div className="rent-buy-column rent"><span><TrendingUp size={14}/> АРЕНДА</span><strong>{price(result.rent_monthly)}/мес</strong><small>стартовое значение аренды</small></div>
      </> : <>
        <div className="rent-buy-column buy"><span><Home size={14}/> ВЛАДЕНИЕ</span><strong>{price(result.ownership_total)}</strong><small>модельные расходы за {result.horizon_years} лет</small></div>
        <div className="rent-buy-column rent"><span><TrendingUp size={14}/> АРЕНДА</span><strong>{price(result.rent_total)}</strong><small>модельные расходы за {result.horizon_years} лет</small></div>
      </>}
      <div className="rent-buy-break-even"><b>{statement}</b></div>
    </div>}

    <AssumptionsDrawer>
      <div className="rent-buy-assumptions">
        <label><span>Рост аренды / год</span><input type="number" step=".5" value={rentGrowth} onChange={event => setRentGrowth(Number(event.target.value))}/><small>%</small></label>
        <label><span>Рост цены жилья / год</span><input type="number" step=".5" value={homeGrowth} onChange={event => setHomeGrowth(Number(event.target.value))}/><small>%</small></label>
        <label><span>Содержание жилья / год</span><input type="number" min="0" step=".25" value={maintenance} onChange={event => setMaintenance(Math.max(0,Number(event.target.value)))}/><small>% стоимости</small></label>
        <label><span>Доходность свободных денег</span><input type="number" step=".5" value={investmentReturn} onChange={event => setInvestmentReturn(Number(event.target.value))}/><small>% / год</small></label>
      </div>
    </AssumptionsDrawer>

    {result && <div className="rent-buy-provenance"><SourceBadge name={result.source_name}/><DataFreshness date={result.updated_at}/></div>}
    {result?.warnings.length ? <WarningBanner warnings={result.warnings}/> : null}

    <p className="rent-buy-note"><Landmark size={14}/> Это сценарный расчёт, а не совет «покупать» или «снимать». Результат зависит от указанных допущений.</p>
  </section>
}
