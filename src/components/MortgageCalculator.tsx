import { useMemo,useState } from 'react'
import { ArrowUpRight, Baby, BadgePercent, BriefcaseBusiness, Calculator, ChevronDown, Globe2, Info, Landmark, SlidersHorizontal } from 'lucide-react'
import { price as formatPrice } from '../lib/catalog'
import { KRASNOYARSK_MORTGAGE_BANKS,KRASNOYARSK_MORTGAGE_SNAPSHOT_DATE,mortgageOfferEligibility,type MortgageBankOffer } from '../lib/mortgageBanks'
import { MORTGAGE_PROGRAM_ORDER,mortgageProgramEligibility,resolveMortgageProgram,type MortgageProgramId } from '../lib/mortgagePrograms'

export type MortgageCalculation={ principal:number; monthlyPayment:number; totalPayment:number; overpayment:number }

export function calculateMortgage(price:number,downPayment:number,annualRate:number,years:number):MortgageCalculation {
  const safePrice=Math.max(0,Number.isFinite(price) ? price : 0)
  const safeDown=Math.min(safePrice,Math.max(0,Number.isFinite(downPayment) ? downPayment : 0))
  const principal=Math.max(0,safePrice-safeDown)
  const months=Math.max(1,Math.round((Number.isFinite(years) ? years : 1)*12))
  const monthlyRate=Math.max(0,Number.isFinite(annualRate) ? annualRate : 0)/100/12
  if (!principal) return { principal:0,monthlyPayment:0,totalPayment:0,overpayment:0 }
  const monthlyPayment=monthlyRate === 0 ? principal/months : principal*(monthlyRate*Math.pow(1+monthlyRate,months))/(Math.pow(1+monthlyRate,months)-1)
  const totalPayment=monthlyPayment*months
  return { principal,monthlyPayment,totalPayment,overpayment:Math.max(0,totalPayment-principal) }
}

function offerCalculation(offer:MortgageBankOffer,price:number,downPayment:number,years:number) {
  const eligibility=mortgageOfferEligibility(offer,price,downPayment,years)
  if (!eligibility.eligible || offer.rateFrom === null) return { eligibility,result:null }
  return { eligibility,result:calculateMortgage(price,downPayment,offer.rateFrom,years) }
}

function programIcon(id:MortgageProgramId) {
  if (id === 'family') return <Baby size={17}/>
  if (id === 'it') return <BriefcaseBusiness size={17}/>
  if (id === 'far-east') return <Globe2 size={17}/>
  if (id === 'custom') return <SlidersHorizontal size={17}/>
  return <Landmark size={17}/>
}

function clamp(value:number,min:number,max:number) {
  return Math.min(max,Math.max(min,Number.isFinite(value) ? value : min))
}

export function MortgageCalculator({ apartmentPrice,apartmentArea,defaultDownPayment=0 }:{
  apartmentPrice:number
  apartmentArea?:number
  defaultDownPayment?:number
}) {
  const initialPrice=Math.max(300_000,Math.round(apartmentPrice))
  const initialDown=Math.min(initialPrice,defaultDownPayment > 0 ? defaultDownPayment : Math.round(initialPrice*.2))
  const [propertyPrice,setPropertyPrice]=useState(initialPrice)
  const [downPayment,setDownPayment]=useState(initialDown)
  const [customRate,setCustomRate]=useState<number|null>(null)
  const [years,setYears]=useState(20)
  const [programId,setProgramId]=useState<MortgageProgramId>('market')
  const [bankId,setBankId]=useState('sber')
  const [childrenCount,setChildrenCount]=useState(1)
  const [youngestChildAge,setYoungestChildAge]=useState<number|null>(3)

  const programContext=useMemo(() => ({ childrenCount,youngestChildAge,apartmentArea }),[childrenCount,youngestChildAge,apartmentArea])
  const programs=useMemo(() => MORTGAGE_PROGRAM_ORDER.map(id => resolveMortgageProgram(id,programContext)),[programContext])
  const selectedProgram=programs.find(program => program.id === programId) ?? programs[0]

  const bankRows=useMemo(() => KRASNOYARSK_MORTGAGE_BANKS.map(offer => {
    const calculated=offerCalculation(offer,propertyPrice,downPayment,years)
    return { offer,...calculated }
  }).sort((a,b) => {
    if (a.result && b.result) return a.result.monthlyPayment-b.result.monthlyPayment
    if (a.result) return -1
    if (b.result) return 1
    return a.offer.bank.localeCompare(b.offer.bank,'ru')
  }),[propertyPrice,downPayment,years])

  const selectedBankOffer=KRASNOYARSK_MORTGAGE_BANKS.find(offer => offer.id === bankId) ?? KRASNOYARSK_MORTGAGE_BANKS[0]
  const selectedBank=offerCalculation(selectedBankOffer,propertyPrice,downPayment,years)
  const programEligibility=mortgageProgramEligibility(selectedProgram,propertyPrice,downPayment,years)
  const annualRate=programId === 'market' ? selectedBankOffer.rateFrom : programId === 'custom' ? customRate : selectedProgram.rate
  const result=annualRate === null ? null : calculateMortgage(propertyPrice,downPayment,annualRate,years)
  const calculationAvailable=Boolean(result && (programId !== 'market' || selectedBank.eligibility.eligible) && (programId === 'market' || programId === 'custom' || programEligibility.eligible))
  const principal=Math.max(0,propertyPrice-Math.min(propertyPrice,downPayment))
  const downPercent=propertyPrice > 0 ? Math.round(Math.min(downPayment,propertyPrice)/propertyPrice*1000)/10 : 0
  const eligibleBanks=bankRows.filter(row => row.result).length
  const priceMax=Math.max(30_000_000,Math.ceil(propertyPrice*1.4/1_000_000)*1_000_000)
  const requiredProgramDown=Math.max(
    selectedProgram.minDownPaymentPercent === null ? 0 : propertyPrice*selectedProgram.minDownPaymentPercent/100,
    selectedProgram.maxAmount === null ? 0 : propertyPrice-selectedProgram.maxAmount
  )
  const suggestedDown=Math.ceil(Math.max(0,requiredProgramDown)/10_000)*10_000
  const marketRequiredDown=Math.max(
    selectedBankOffer.minDownPaymentPercent === null ? 0 : propertyPrice*selectedBankOffer.minDownPaymentPercent/100,
    selectedBankOffer.maxAmount === null ? 0 : propertyPrice-selectedBankOffer.maxAmount
  )
  const marketSuggestedDown=Math.ceil(Math.max(0,marketRequiredDown)/10_000)*10_000
  const programReasons=programId === 'market' ? selectedBank.eligibility.reasons : programId === 'custom' ? [] : programEligibility.reasons

  function changeProgram(id:MortgageProgramId) {
    setProgramId(id)
    const next=resolveMortgageProgram(id,programContext)
    if (next.maxYears !== null && years > next.maxYears) setYears(next.maxYears)
  }

  function fitProgram() {
    if (programId === 'market') {
      setDownPayment(clamp(marketSuggestedDown,0,propertyPrice))
      if (selectedBankOffer.maxYears !== null && years > selectedBankOffer.maxYears) setYears(selectedBankOffer.maxYears)
      return
    }
    setDownPayment(clamp(suggestedDown,0,propertyPrice))
    if (selectedProgram.maxYears !== null && years > selectedProgram.maxYears) setYears(selectedProgram.maxYears)
  }

  return <section className="mortgage-calculator mortgage-calculator-v2" aria-labelledby="mortgage-title">
    <div className="mortgage-v2-head">
      <div><span className="mortgage-v2-kicker"><Calculator size={15}/> GEODOM · РАСЧЁТ ПО ЭТОЙ КВАРТИРЕ</span><h3 id="mortgage-title">Ипотечный калькулятор</h3><p>Выберите программу, настройте стоимость, взнос и срок — платёж пересчитается сразу.</p></div>
      <span className="mortgage-v2-snapshot">Красноярск · {new Date(KRASNOYARSK_MORTGAGE_SNAPSHOT_DATE).toLocaleDateString('ru-RU')}</span>
    </div>

    <div className="mortgage-program-grid" role="tablist" aria-label="Ипотечная программа">
      {programs.map(program => <button type="button" role="tab" aria-selected={programId === program.id} className={'mortgage-program-card '+(programId === program.id ? 'active ' : '')+(!program.available ? 'unavailable' : '')} key={program.id} onClick={() => changeProgram(program.id)}>
        <span className="mortgage-program-icon">{programIcon(program.id)}</span>
        <span className="mortgage-program-copy"><b>{program.shortTitle}</b><small>{program.badge}</small></span>
      </button>)}
    </div>

    <div className="mortgage-v2-layout">
      <div className="mortgage-v2-controls">
        <div className="mortgage-control-card">
          <div className="mortgage-control-title"><span>Стоимость недвижимости</span><b>{formatPrice(Math.round(propertyPrice))}</b></div>
          <input className="mortgage-range" aria-label="Стоимость недвижимости" type="range" min="300000" max={priceMax} step="50000" value={propertyPrice} onChange={event => { const next=Number(event.target.value); setPropertyPrice(next); setDownPayment(current => Math.min(current,next)) }}/>
          <div className="mortgage-control-input"><input type="number" min="300000" step="50000" value={propertyPrice} onChange={event => { const next=Math.max(300_000,Number(event.target.value) || 300_000); setPropertyPrice(next); setDownPayment(current => Math.min(current,next)) }}/><span>₽</span></div>
        </div>

        <div className="mortgage-control-card">
          <div className="mortgage-control-title"><span>Первоначальный взнос</span><b>{downPercent}%</b></div>
          <input className="mortgage-range" aria-label="Первоначальный взнос" type="range" min="0" max={propertyPrice} step="10000" value={Math.min(downPayment,propertyPrice)} onChange={event => setDownPayment(Number(event.target.value))}/>
          <div className="mortgage-control-input split"><input type="number" min="0" max={propertyPrice} step="10000" value={downPayment} onChange={event => setDownPayment(clamp(Number(event.target.value),0,propertyPrice))}/><span>₽</span><em>{downPercent}%</em></div>
        </div>

        <div className="mortgage-control-card">
          <div className="mortgage-control-title"><span>Срок кредита</span><b>{years} {years === 1 ? 'год' : years < 5 ? 'года' : 'лет'}</b></div>
          <input className="mortgage-range" aria-label="Срок кредита" type="range" min="1" max={selectedProgram.maxYears ?? 30} step="1" value={Math.min(years,selectedProgram.maxYears ?? 30)} onChange={event => setYears(Number(event.target.value))}/>
          <div className="mortgage-years-scale"><span>1 год</span><span>{selectedProgram.maxYears ?? 30} лет</span></div>
        </div>

        {programId === 'market' && <div className="mortgage-control-card">
          <div className="mortgage-control-title"><span>Банк</span><b>{selectedBankOffer.rateFrom === null ? 'ставка уточняется' : 'от '+selectedBankOffer.rateFrom+'%'}</b></div>
          <div className="mortgage-select-wrap mortgage-v2-select"><select value={bankId} onChange={event => setBankId(event.target.value)}>{KRASNOYARSK_MORTGAGE_BANKS.map(offer => <option value={offer.id} key={offer.id}>{offer.bank} · {offer.rateFrom === null ? 'уточнить' : 'от '+offer.rateFrom+'%'}</option>)}</select><ChevronDown size={15}/></div>
          <small className="mortgage-control-help">{selectedBankOffer.program}</small>
        </div>}

        {programId === 'custom' && <div className="mortgage-control-card">
          <div className="mortgage-control-title"><span>Ставка по предложению банка</span><b>{customRate === null ? '—' : customRate+'%'}</b></div>
          <input className="mortgage-range" aria-label="Своя ставка" type="range" min="0" max="40" step="0.1" value={customRate ?? 0} onChange={event => setCustomRate(Number(event.target.value))}/>
          <div className="mortgage-control-input"><input type="number" min="0" max="100" step="0.1" value={customRate ?? ''} onChange={event => setCustomRate(event.target.value === '' ? null : Math.max(0,Number(event.target.value)))}/><span>%</span></div>
        </div>}

        {programId === 'family' && <div className="mortgage-family-settings">
          <div className="mortgage-family-head"><Baby size={17}/><div><b>Параметры семьи</b><small>Нужны для программных условий, особенно после 01.10.2026.</small></div></div>
          <label><span>Количество детей</span><select value={childrenCount} onChange={event => setChildrenCount(Number(event.target.value))}>{[1,2,3,4,5,6].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span>Возраст младшего</span><select value={youngestChildAge ?? ''} onChange={event => setYoungestChildAge(event.target.value === '' ? null : Number(event.target.value))}><option value="">Не указан</option>{Array.from({length:18},(_,index) => <option value={index} key={index}>{index} {index === 1 ? 'год' : index > 1 && index < 5 ? 'года' : 'лет'}</option>)}</select></label>
        </div>}

        {programId !== 'market' && programId !== 'custom' && <div className={'mortgage-program-note '+(selectedProgram.available ? '' : 'warning')}><Info size={16}/><div><b>{selectedProgram.title}</b><p>{selectedProgram.description}</p>{selectedProgram.warning && <small>{selectedProgram.warning}</small>}{selectedProgram.sourceUrl && <a href={selectedProgram.sourceUrl} target="_blank" rel="noopener noreferrer">Условия программы <ArrowUpRight size={12}/></a>}</div></div>}

        {programReasons.length > 0 && <div className="mortgage-fit-warning"><div><BadgePercent size={16}/><span><b>Текущие параметры не проходят</b>{programReasons.join(' · ')}</span></div>{programId !== 'far-east' && <button type="button" onClick={fitProgram}>{programId === 'market' ? 'Подогнать к банку' : 'Подогнать взнос и срок'}</button>}</div>}
      </div>

      <aside className="mortgage-summary-card">
        <span className="mortgage-summary-label">Ежемесячный платёж</span>
        <strong>{calculationAvailable ? formatPrice(Math.round(result!.monthlyPayment)) : '—'}</strong>
        <small>{annualRate === null ? 'Укажите ставку' : annualRate+'% годовых · аннуитет'}</small>
        <div className="mortgage-summary-grid">
          <div><span>Сумма кредита</span><b>{formatPrice(Math.round(principal))}</b></div>
          <div><span>Первый взнос</span><b>{formatPrice(Math.round(downPayment))}</b></div>
          <div><span>Переплата</span><b>{calculationAvailable ? formatPrice(Math.round(result!.overpayment)) : '—'}</b></div>
          <div><span>Всего выплат</span><b>{calculationAvailable ? formatPrice(Math.round(result!.totalPayment)) : '—'}</b></div>
        </div>
        <div className="mortgage-summary-program"><span>{programIcon(programId)}</span><div><small>Программа</small><b>{programId === 'market' ? selectedBankOffer.bank : selectedProgram.title}</b></div></div>
        {calculationAvailable ? <div className="mortgage-summary-ok">Расчёт готов. Это ориентир, а не одобрение банка.</div> : <div className="mortgage-summary-error">{programReasons[0] || 'Для расчёта заполните ставку.'}</div>}
      </aside>
    </div>

    {programId === 'market' && <details className="mortgage-bank-directory mortgage-v2-bank-directory">
      <summary><span>Сравнить банки Красноярска</span><b>{eligibleBanks} подходят под текущие параметры</b></summary>
      <div className="mortgage-bank-list">{bankRows.map(({offer,eligibility,result:bankResult}) => <button type="button" key={offer.id} className={bankId === offer.id ? 'selected' : ''} onClick={() => setBankId(offer.id)}>
        <span className="mortgage-bank-logo">{offer.bank.slice(0,2).toUpperCase()}</span><span className="mortgage-bank-copy"><b>{offer.bank}</b><small>{offer.program}</small></span><span className="mortgage-bank-rate">{offer.rateFrom === null ? '—' : offer.rateFrom+'%'}<small>{offer.minDownPaymentPercent === null ? 'взнос уточнить' : 'взнос от '+offer.minDownPaymentPercent+'%'}</small></span><span className={bankResult ? 'mortgage-bank-payment' : 'mortgage-bank-payment unavailable'}>{bankResult ? formatPrice(Math.round(bankResult.monthlyPayment))+'/мес' : eligibility.reasons[0] || 'Уточнить'}</span>
      </button>)}</div>
      <div className="mortgage-snapshot-note">Snapshot на {new Date(KRASNOYARSK_MORTGAGE_SNAPSHOT_DATE).toLocaleDateString('ru-RU')}. Рыночные ставки меняются; перед сделкой проверьте источник выбранного банка.</div>
    </details>}

    {programId === 'market' && <div className={'mortgage-bank-status compact '+(selectedBank.eligibility.eligible ? 'eligible' : 'ineligible')}>
      <div><span>{selectedBankOffer.bank}</span><b>{selectedBankOffer.rateFrom === null ? 'Ставка требует проверки' : 'от '+selectedBankOffer.rateFrom+'%'}</b></div>
      <div><span>Минимальный взнос</span><b>{selectedBankOffer.minDownPaymentPercent === null ? 'уточнить' : 'от '+selectedBankOffer.minDownPaymentPercent+'%'}</b></div>
      {selectedBankOffer.notes && <p>{selectedBankOffer.notes}</p>}<a href={selectedBankOffer.sourceUrl} target="_blank" rel="noopener noreferrer">Источник банка <ArrowUpRight size={13}/></a>
    </div>}

    <p className="mortgage-note mortgage-v2-note"><Landmark size={14}/> Расчёт предварительный. Льготная программа не означает автоматическое право на неё: банк отдельно проверяет заёмщика, объект и документы. GeoDom не отправляет заявку и не обещает одобрение.</p>
  </section>
}
