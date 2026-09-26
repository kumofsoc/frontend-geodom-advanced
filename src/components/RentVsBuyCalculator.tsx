import { useMemo,useState } from 'react'
import { ArrowRightLeft, Home, Landmark, TrendingUp } from 'lucide-react'
import { price } from '../lib/catalog'
import { calculateMortgage } from './MortgageCalculator'
import { KRASNOYARSK_MORTGAGE_BANKS,mortgageOfferEligibility } from '../lib/mortgageBanks'

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
    const renterHousingCost=rent
    totalRentPaid+=rent

    const difference=buyerHousingCost-renterHousingCost
    if (difference > 0) renterPortfolio+=difference
    else buyerPortfolio+=-difference
  }

  const remainingMortgage=mortgageBalance(mortgage.principal,input.annualRate,mortgageMonths,Math.min(horizonMonths,mortgageMonths),mortgage.monthlyPayment)
  const saleCosts=homeValue*(input.saleCostsPercent/100)
  const buyerNetWorth=Math.max(0,homeValue-remainingMortgage-saleCosts)+buyerPortfolio
  const renterNetWorth=renterPortfolio

  return {
    buyerNetWorth,
    renterNetWorth,
    difference:buyerNetWorth-renterNetWorth,
    futureHomeValue:homeValue,
    remainingMortgage,
    renterPortfolio,
    buyerPortfolio,
    monthlyMortgage:mortgage.monthlyPayment,
    totalRentPaid
  }
}

export function RentVsBuyCalculator({
  apartmentPrice,
  defaultDownPayment=0
}:{
  apartmentPrice:number
  defaultDownPayment?:number
}) {
  const [bankId,setBankId]=useState('sber')
  const [downPayment,setDownPayment]=useState(Math.min(apartmentPrice,defaultDownPayment > 0 ? defaultDownPayment : Math.round(apartmentPrice*.2)))
  const [years,setYears]=useState(10)
  const [mortgageYears,setMortgageYears]=useState(20)
  const [monthlyRent,setMonthlyRent]=useState(40_000)
  const [rentGrowth,setRentGrowth]=useState(5)
  const [homeGrowth,setHomeGrowth]=useState(4)
  const [maintenance,setMaintenance]=useState(1)
  const [investmentReturn,setInvestmentReturn]=useState(8)
  const [advanced,setAdvanced]=useState(false)

  const bank=KRASNOYARSK_MORTGAGE_BANKS.find(item => item.id === bankId) ?? KRASNOYARSK_MORTGAGE_BANKS[0]
  const eligibility=mortgageOfferEligibility(bank,apartmentPrice,downPayment,mortgageYears)
  const annualRate=bank.rateFrom
  const result=useMemo(() => annualRate === null ? null : calculateRentVsBuy({
    apartmentPrice,
    downPayment,
    annualRate,
    years,
    mortgageYears,
    monthlyRent,
    rentGrowthPercent:rentGrowth,
    homeGrowthPercent:homeGrowth,
    maintenancePercent:maintenance,
    investmentReturnPercent:investmentReturn,
    purchaseCostsPercent:1,
    saleCostsPercent:2
  }),[apartmentPrice,downPayment,annualRate,years,mortgageYears,monthlyRent,rentGrowth,homeGrowth,maintenance,investmentReturn])

  return <section className="rent-buy-calculator">
    <div className="rent-buy-head">
      <span><ArrowRightLeft size={17}/></span>
      <div><small>КУПИТЬ ИЛИ СНИМАТЬ</small><h3>Сценарий на {years} лет</h3></div>
    </div>

    <div className="rent-buy-core-fields">
      <label><span>Аренда сейчас, ₽/мес</span><input type="number" min="0" step="1000" value={monthlyRent || ''} onChange={event => setMonthlyRent(Math.max(0,Number(event.target.value)))}/></label>
      <label><span>Первоначальный взнос</span><input type="number" min="0" max={apartmentPrice} step="10000" value={downPayment || ''} onChange={event => setDownPayment(Math.min(apartmentPrice,Math.max(0,Number(event.target.value))))}/></label>
      <label><span>Банк</span><select value={bankId} onChange={event => setBankId(event.target.value)}>{KRASNOYARSK_MORTGAGE_BANKS.filter(item => item.rateFrom !== null).map(item => <option value={item.id} key={item.id}>{item.bank} · от {item.rateFrom}%</option>)}</select></label>
      <label><span>Горизонт сравнения</span><select value={years} onChange={event => setYears(Number(event.target.value))}>{[3,5,7,10,15,20].map(value => <option value={value} key={value}>{value} лет</option>)}</select></label>
      <label><span>Срок ипотеки</span><select value={mortgageYears} onChange={event => setMortgageYears(Number(event.target.value))}>{[5,10,15,20,25,30].map(value => <option value={value} key={value}>{value} лет</option>)}</select></label>
    </div>

    <button type="button" className="rent-buy-advanced-toggle" onClick={() => setAdvanced(value => !value)}>{advanced ? 'Скрыть допущения' : 'Настроить допущения'}</button>
    {advanced && <div className="rent-buy-assumptions">
      <label><span>Рост аренды / год</span><input type="number" step=".5" value={rentGrowth} onChange={event => setRentGrowth(Number(event.target.value))}/><small>%</small></label>
      <label><span>Рост цены жилья / год</span><input type="number" step=".5" value={homeGrowth} onChange={event => setHomeGrowth(Number(event.target.value))}/><small>%</small></label>
      <label><span>Содержание жилья / год</span><input type="number" min="0" step=".25" value={maintenance} onChange={event => setMaintenance(Math.max(0,Number(event.target.value)))}/><small>% стоимости</small></label>
      <label><span>Доходность свободных денег</span><input type="number" step=".5" value={investmentReturn} onChange={event => setInvestmentReturn(Number(event.target.value))}/><small>% / год</small></label>
    </div>}

    {!eligibility.eligible && <div className="rent-buy-warning">{bank.bank}: {eligibility.reasons.join(' · ')}. Сценарий ниже математический и не означает, что банк одобрит эти параметры.</div>}

    {result && <div className="rent-buy-result">
      <div className="rent-buy-column buy">
        <span><Home size={14}/> ПОКУПКА</span>
        <strong>{price(Math.round(result.buyerNetWorth))}</strong>
        <small>модельный капитал через {years} лет</small>
        <p>Жильё: {price(Math.round(result.futureHomeValue))}<br/>Остаток кредита: {price(Math.round(result.remainingMortgage))}<br/>Платёж: {price(Math.round(result.monthlyMortgage))}/мес</p>
      </div>
      <div className="rent-buy-column rent">
        <span><TrendingUp size={14}/> АРЕНДА + КАПИТАЛ</span>
        <strong>{price(Math.round(result.renterNetWorth))}</strong>
        <small>модельный инвестиционный капитал</small>
        <p>Аренда за период: {price(Math.round(result.totalRentPaid))}<br/>Начальный капитал: взнос + 1% расходов покупки</p>
      </div>
      <div className={`rent-buy-difference ${result.difference >= 0 ? 'buy-ahead' : 'rent-ahead'}`}>
        <span>Разница модели</span>
        <b>{result.difference >= 0 ? 'Покупка +' : 'Аренда +'}{price(Math.abs(Math.round(result.difference)))}</b>
      </div>
    </div>}

    <p className="rent-buy-note"><Landmark size={14}/> Это сценарная модель, а не совет «покупать» или «снимать». Она чувствительна к росту цен, аренды, доходности свободных денег, страховке, налогам, ремонту и реальной ставке. Начальные допущения можно изменить выше.</p>
  </section>
}
