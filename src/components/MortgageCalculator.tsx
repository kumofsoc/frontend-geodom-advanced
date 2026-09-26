import { useMemo,useState } from 'react'
import { ArrowUpRight, Calculator, ChevronDown, Landmark } from 'lucide-react'
import { price as formatPrice } from '../lib/catalog'
import {
  KRASNOYARSK_MORTGAGE_BANKS,
  KRASNOYARSK_MORTGAGE_SNAPSHOT_DATE,
  mortgageOfferEligibility,
  type MortgageBankOffer
} from '../lib/mortgageBanks'

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

type Mode='banks'|'custom'

function offerCalculation(offer:MortgageBankOffer,price:number,downPayment:number,years:number) {
  const eligibility=mortgageOfferEligibility(offer,price,downPayment,years)
  if (!eligibility.eligible || offer.rateFrom === null) return { eligibility,result:null }
  return {
    eligibility,
    result:calculateMortgage(price,downPayment,offer.rateFrom,years)
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
  const [customRate,setCustomRate]=useState<number|null>(null)
  const [years,setYears]=useState(20)
  const [mode,setMode]=useState<Mode>('banks')
  const [bankId,setBankId]=useState('sber')

  const bankRows=useMemo(() => KRASNOYARSK_MORTGAGE_BANKS.map(offer => {
    const calculated=offerCalculation(offer,apartmentPrice,downPayment,years)
    return { offer,...calculated }
  }).sort((a,b) => {
    if (a.result && b.result) return a.result.monthlyPayment-b.result.monthlyPayment
    if (a.result) return -1
    if (b.result) return 1
    return a.offer.bank.localeCompare(b.offer.bank,'ru')
  }),[apartmentPrice,downPayment,years])

  const selected=KRASNOYARSK_MORTGAGE_BANKS.find(offer => offer.id === bankId) ?? KRASNOYARSK_MORTGAGE_BANKS[0]
  const selectedBank=offerCalculation(selected,apartmentPrice,downPayment,years)
  const annualRate=mode === 'banks' ? selected.rateFrom : customRate
  const result=annualRate === null ? null : calculateMortgage(apartmentPrice,downPayment,annualRate,years)
  const principal=Math.max(0,apartmentPrice-Math.min(apartmentPrice,downPayment))
  const downPercent=apartmentPrice > 0 ? Math.round((Math.min(downPayment,apartmentPrice)/apartmentPrice)*1000)/10 : 0
  const eligibleBanks=bankRows.filter(row => row.result).length

  return <section className="mortgage-calculator" aria-labelledby="mortgage-title">
    <div className="mortgage-head">
      <span><Calculator size={17}/></span>
      <div>
        <small>ФИНАНСОВЫЙ СЦЕНАРИЙ · КРАСНОЯРСК</small>
        <h3 id="mortgage-title">Ипотечный калькулятор</h3>
      </div>
    </div>

    <div className="mortgage-mode" role="tablist" aria-label="Источник ипотечной ставки">
      <button type="button" className={mode === 'banks' ? 'active' : ''} onClick={() => setMode('banks')}>Банки Красноярска</button>
      <button type="button" className={mode === 'custom' ? 'active' : ''} onClick={() => setMode('custom')}>Своя ставка</button>
    </div>

    <div className="mortgage-fields">
      <label>
        <span>Первоначальный взнос</span>
        <input type="number" min="0" max={apartmentPrice} step="10000" value={downPayment || ''} onChange={event => setDownPayment(Math.min(apartmentPrice,Math.max(0,Number(event.target.value))))}/>
        <small>{downPercent}% стоимости · {formatPrice(Math.round(downPayment))}</small>
      </label>

      {mode === 'banks' ? <label>
        <span>Банк / программа</span>
        <div className="mortgage-select-wrap">
          <select value={bankId} onChange={event => setBankId(event.target.value)}>
            {KRASNOYARSK_MORTGAGE_BANKS.map(offer => <option value={offer.id} key={offer.id}>{offer.bank} · {offer.rateFrom === null ? 'уточнить ставку' : `от ${offer.rateFrom}%`}</option>)}
          </select>
          <ChevronDown size={14}/>
        </div>
        <small>{selected.program}</small>
      </label> : <label>
        <span>Ставка, % годовых</span>
        <input type="number" min="0" max="100" step="0.1" value={customRate ?? ''} onChange={event => setCustomRate(event.target.value === '' ? null : Math.max(0,Number(event.target.value)))} placeholder="Например, 18.5"/>
        <small>Введите индивидуальные условия банка</small>
      </label>}

      <label>
        <span>Срок</span>
        <select value={years} onChange={event => setYears(Number(event.target.value))}>
          {[5,10,15,20,25,30].map(value => <option value={value} key={value}>{value} лет</option>)}
        </select>
      </label>
    </div>

    {mode === 'banks' && <div className={`mortgage-bank-status ${selectedBank.eligibility.eligible ? 'eligible' : 'ineligible'}`}>
      <div>
        <span>{selected.bank}</span>
        <b>{selected.rateFrom === null ? 'Ставка требует проверки' : `от ${selected.rateFrom}%`}</b>
      </div>
      <div>
        <span>Минимальный взнос</span>
        <b>{selected.minDownPaymentPercent === null ? 'уточнить' : `от ${selected.minDownPaymentPercent}%`}</b>
      </div>
      {!selectedBank.eligibility.eligible && <p>{selectedBank.eligibility.reasons.join(' · ')}</p>}
      {selected.notes && <p>{selected.notes}</p>}
      <a href={selected.sourceUrl} target="_blank" rel="noopener noreferrer">Проверить источник <ArrowUpRight size={13}/></a>
    </div>}

    <div className="mortgage-result">
      <div><span>Сумма кредита</span><b>{formatPrice(Math.round(principal))}</b></div>
      <div className="primary"><span>Платёж в месяц</span><b>{result && (mode === 'custom' || selectedBank.eligibility.eligible) ? formatPrice(Math.round(result.monthlyPayment)) : '—'}</b></div>
      <div><span>Переплата</span><b>{result && (mode === 'custom' || selectedBank.eligibility.eligible) ? formatPrice(Math.round(result.overpayment)) : '—'}</b></div>
      <div><span>Всего выплат</span><b>{result && (mode === 'custom' || selectedBank.eligibility.eligible) ? formatPrice(Math.round(result.totalPayment)) : '—'}</b></div>
    </div>

    {mode === 'banks' && <details className="mortgage-bank-directory">
      <summary>Сравнить все {KRASNOYARSK_MORTGAGE_BANKS.length} банков <span>{eligibleBanks} проходят по текущим параметрам</span></summary>
      <div className="mortgage-bank-list">
        {bankRows.map(({offer,eligibility,result}) => <button type="button" key={offer.id} className={bankId === offer.id ? 'selected' : ''} onClick={() => setBankId(offer.id)}>
          <span className="mortgage-bank-logo">{offer.bank.slice(0,2).toUpperCase()}</span>
          <span className="mortgage-bank-copy"><b>{offer.bank}</b><small>{offer.program}</small></span>
          <span className="mortgage-bank-rate">{offer.rateFrom === null ? '—' : `${offer.rateFrom}%`}<small>{offer.minDownPaymentPercent === null ? 'взнос уточнить' : `взнос от ${offer.minDownPaymentPercent}%`}</small></span>
          <span className={result ? 'mortgage-bank-payment' : 'mortgage-bank-payment unavailable'}>{result ? `${formatPrice(Math.round(result.monthlyPayment))}/мес` : eligibility.reasons[0] || 'Уточнить'}</span>
        </button>)}
      </div>
      <div className="mortgage-snapshot-note">Snapshot на {new Date(KRASNOYARSK_MORTGAGE_SNAPSHOT_DATE).toLocaleDateString('ru-RU')}. Ставки меняются; перед сделкой откройте источник выбранного банка.</div>
    </details>}

    <p className="mortgage-note"><Landmark size={14}/> Расчёт аннуитетный и предварительный. Минимальная ставка не гарантирует одобрение и может требовать страховку, зарплатный статус, определённый взнос или другую программу. GeoDom не отправляет заявку в банк.</p>
  </section>
}
