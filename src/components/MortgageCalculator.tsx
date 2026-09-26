import { useMemo,useState } from 'react'
import { Calculator, Landmark } from 'lucide-react'
import { price as formatPrice } from '../lib/catalog'

export type MortgageCalculation = {
  principal:number
  monthlyPayment:number
  totalPayment:number
  overpayment:number
}

export function calculateMortgage(price:number,downPayment:number,annualRate:number,years:number):MortgageCalculation {
  const safePrice=Math.max(0,Number.isFinite(price) ? price : 0)
  const safeDown=Math.min(safePrice,Math.max(0,Number.isFinite(downPayment) ? downPayment : 0))
  const principal=Math.max(0,safePrice-safeDown)
  const months=Math.max(1,Math.round((Number.isFinite(years) ? years : 1)*12))
  const monthlyRate=Math.max(0,Number.isFinite(annualRate) ? annualRate : 0)/100/12

  if (!principal) return { principal:0,monthlyPayment:0,totalPayment:0,overpayment:0 }

  const monthlyPayment=monthlyRate === 0
    ? principal/months
    : principal*(monthlyRate*Math.pow(1+monthlyRate,months))/(Math.pow(1+monthlyRate,months)-1)
  const totalPayment=monthlyPayment*months
  return {
    principal,
    monthlyPayment,
    totalPayment,
    overpayment:Math.max(0,totalPayment-principal)
  }
}

export function MortgageCalculator({
  apartmentPrice,
  defaultDownPayment=0
}:{
  apartmentPrice:number
  defaultDownPayment?:number
}) {
  const initialDown=Math.min(apartmentPrice,defaultDownPayment > 0 ? defaultDownPayment : Math.round(apartmentPrice*.2))
  const [downPayment,setDownPayment]=useState(initialDown)
  const [annualRate,setAnnualRate]=useState<number|null>(null)
  const [years,setYears]=useState(20)
  const result=useMemo(
    () => annualRate === null ? null : calculateMortgage(apartmentPrice,downPayment,annualRate,years),
    [apartmentPrice,downPayment,annualRate,years]
  )
  const principal=Math.max(0,apartmentPrice-Math.min(apartmentPrice,downPayment))
  const downPercent=apartmentPrice > 0 ? Math.round((Math.min(downPayment,apartmentPrice)/apartmentPrice)*100) : 0

  return <section className="mortgage-calculator" aria-labelledby="mortgage-title">
    <div className="mortgage-head">
      <span><Calculator size={17}/></span>
      <div><small>ФИНАНСОВЫЙ СЦЕНАРИЙ</small><h3 id="mortgage-title">Ипотечный калькулятор</h3></div>
    </div>

    <div className="mortgage-fields">
      <label>
        <span>Первоначальный взнос</span>
        <input type="number" min="0" max={apartmentPrice} step="10000" value={downPayment || ''} onChange={event => setDownPayment(Math.min(apartmentPrice,Math.max(0,Number(event.target.value))))}/>
        <small>{downPercent}% стоимости</small>
      </label>
      <label>
        <span>Ставка, % годовых</span>
        <input type="number" min="0" max="100" step="0.1" value={annualRate ?? ''} onChange={event => setAnnualRate(event.target.value === '' ? null : Math.max(0,Number(event.target.value)))} placeholder="Например, 18.5"/>
        <small>GeoDom не подставляет «рыночную» ставку: введите условия вашего банка или программы</small>
      </label>
      <label>
        <span>Срок</span>
        <select value={years} onChange={event => setYears(Number(event.target.value))}>
          {[5,10,15,20,25,30].map(value => <option value={value} key={value}>{value} лет</option>)}
        </select>
      </label>
    </div>

    <div className="mortgage-result">
      <div><span>Сумма кредита</span><b>{formatPrice(Math.round(principal))}</b></div>
      <div className="primary"><span>Платёж в месяц</span><b>{result ? formatPrice(Math.round(result.monthlyPayment)) : 'Введите ставку'}</b></div>
      <div><span>Переплата</span><b>{result ? formatPrice(Math.round(result.overpayment)) : '—'}</b></div>
      <div><span>Всего выплат</span><b>{result ? formatPrice(Math.round(result.totalPayment)) : '—'}</b></div>
    </div>

    <p className="mortgage-note"><Landmark size={14}/> Расчёт аннуитетный и ориентировочный. Это не оферта банка: ставка, страховка, льготная программа и дополнительные расходы могут изменить итоговый платёж.</p>
  </section>
}
