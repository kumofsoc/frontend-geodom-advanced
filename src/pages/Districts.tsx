import { useEffect,useMemo,useState } from 'react'
import { ArrowLeft,ArrowRight,Building2,Calculator,ChevronDown,Home,Landmark } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { price } from '../lib/catalog'
import { calculateMortgage } from '../components/MortgageCalculator'
import { CoverageIndicator,DataFreshness,SourceBadge,WarningBanner } from '../components/DataTrust'
import { EmptyState,PageLoading } from '../components/Ui'
import { useGeoDomStore } from '../store/useGeoDomStore'
import type { DistrictAnalysis } from '../types'

type SortMode='score'|'price'|'count'|'coverage'

function value(value:number|null,suffix='') {
  return value === null ? 'Нет данных' : `${new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(value)}${suffix}`
}

export function Districts() {
  const [items,setItems]=useState<DistrictAnalysis[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [sort,setSort]=useState<SortMode>('score')
  const [annualRate,setAnnualRate]=useState<number|null>(null)
  const [years,setYears]=useState(20)
  const preferences=useGeoDomStore(state => state.preferences)

  useEffect(() => {
    const controller=new AbortController()
    api.districtAnalysis(controller.signal)
      .then(rows => { if (!controller.signal.aborted) setItems(rows) })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Не удалось загрузить районы') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  },[])

  const sorted=useMemo(() => [...items].sort((a,b) => {
    if (sort === 'count') return b.apartmentCount-a.apartmentCount
    if (sort === 'price') return (a.medianPrice ?? Infinity)-(b.medianPrice ?? Infinity)
    if (sort === 'coverage') return (b.coverage ?? -1)-(a.coverage ?? -1)
    return (b.overallScore ?? -1)-(a.overallScore ?? -1)
  }),[items,sort])

  const total=items.reduce((sum,item) => sum+item.apartmentCount,0)
  const withData=items.filter(item => item.apartmentCount > 0).length

  return <div className="district-explorer-page">
    <div className="shell">
      <div className="district-explorer-toolbar">
        <Link to="/" className="back-link"><ArrowLeft size={17}/> На главную</Link>
        <Link to="/#main-map" className="button light">Открыть карту <ArrowRight size={15}/></Link>
      </div>

      <header className="district-explorer-head">
        <div>
          <span>GEODOM / РАЙОНЫ КРАСНОЯРСКА</span>
          <h1>Сравнение районов без выдуманных score</h1>
          <p>Карточки используют DistrictAnalysis adapter поверх backend district stats. Если backend не передал итоговый score, экологию или безопасность, интерфейс показывает «Нет данных».</p>
        </div>
        <div className="district-explorer-summary">
          <div><small>Квартир в backend</small><b>{total}</b></div>
          <div><small>Районов с инвентарём</small><b>{withData} / {items.length || 7}</b></div>
          <div><small>Районов со score</small><b>{items.filter(item => item.overallScore !== null).length}</b></div>
        </div>
      </header>

      <section className="district-affordability">
        <div className="district-affordability-copy">
          <span><Calculator size={16}/> ФИНАНСОВЫЙ СЦЕНАРИЙ</span>
          <h2>Ориентировочный платёж по медианной цене района</h2>
          <p>Здесь нет банковского одобрения. Ставку вводит пользователь, а медианная стоимость приходит из backend.</p>
        </div>
        <div className="district-affordability-controls">
          <label><span>Ваш взнос</span><b>{price(preferences.down_payment)}</b></label>
          <label><span>Ставка, %</span><input type="number" min="0" max="100" step=".1" value={annualRate ?? ''} placeholder="Например, 18.5" onChange={event => setAnnualRate(event.target.value === '' ? null : Math.max(0,Number(event.target.value)))}/></label>
          <label><span>Срок</span><select value={years} onChange={event => setYears(Number(event.target.value))}>{[5,10,15,20,25,30].map(number => <option value={number} key={number}>{number} лет</option>)}</select></label>
        </div>
      </section>

      <div className="district-explorer-controls">
        <div><Building2 size={17}/><b>Районы</b><span>source-aware данные и coverage</span></div>
        <label>Сортировать<div className="select-wrap"><select value={sort} onChange={event => setSort(event.target.value as SortMode)}><option value="score">По backend score</option><option value="price">По медианной цене</option><option value="count">По числу квартир</option><option value="coverage">По покрытию данных</option></select><ChevronDown size={15}/></div></label>
      </div>

      {loading
        ? <PageLoading/>
        : error
          ? <EmptyState title="Не удалось загрузить районы" message={error}/>
          : <div className="district-explorer-grid">{sorted.map(item => <DistrictCard key={item.id} item={item} budget={preferences.budget_max} downPayment={preferences.down_payment} annualRate={annualRate} years={years}/>)}</div>}
    </div>
  </div>
}

function DistrictCard({item,budget,downPayment,annualRate,years}:{item:DistrictAnalysis;budget:number;downPayment:number;annualRate:number|null;years:number}) {
  const mortgage=item.medianPrice !== null && annualRate !== null
    ? calculateMortgage(item.medianPrice,Math.min(downPayment,item.medianPrice),annualRate,years)
    : null
  const withinBudget=item.medianPrice !== null && budget > 0 ? item.medianPrice <= budget : null
  const query=`/?district=${encodeURIComponent(item.name)}#catalog`

  return <article className={`district-explorer-card ${item.apartmentCount ? '' : 'empty'}`}>
    <div className="district-explorer-card-head">
      <div><span>{item.apartmentCount ? `${item.apartmentCount} квартир` : 'Инвентарь отсутствует'}</span><h2>{item.name}</h2></div>
      <div className="district-score"><b>{item.overallScore === null ? 'Нет данных' : item.overallScore.toFixed(1)}</b>{item.overallScore !== null && <small>/10</small>}</div>
    </div>

    <div className="district-metrics">
      <div><span>Транспорт</span><b>{value(item.scores.transport)}</b></div>
      <div><span>Экология</span><b>{value(item.scores.ecology)}</b></div>
      <div><span>Школы</span><b>{value(item.scores.schools)}</b></div>
      <div><span>Безопасность</span><b>{value(item.scores.safety)}</b></div>
      <div><span>Инфраструктура</span><b>{value(item.scores.infrastructure)}</b></div>
      <div><span>Медианная цена</span><b>{item.medianPrice === null ? 'Нет данных' : price(Math.round(item.medianPrice))}</b></div>
    </div>

    <CoverageIndicator value={item.coverage}/>
    <div className="district-budget-row"><span>Ваш бюджет</span><b className={withinBudget === true ? 'fit' : withinBudget === false ? 'over' : ''}>{withinBudget === null ? 'Нет данных' : withinBudget ? 'Медиана входит' : 'Медиана выше бюджета'}</b></div>
    <div className="district-mortgage-row"><Landmark size={14}/><span>Платёж по медиане</span><b>{mortgage ? `${price(Math.round(mortgage.monthlyPayment))}/мес` : item.medianPrice ? 'Введите ставку' : 'Нет данных'}</b></div>
    <div className="district-range"><Home size={14}/><span>Цена за м²</span><b>{item.medianPriceM2 === null ? 'Нет данных' : `${price(Math.round(item.medianPriceM2))}/м²`}</b></div>
    <div className="district-card-trust"><SourceBadge name={item.sourceName} url={item.sourceUrl}/><DataFreshness date={item.updatedAt}/></div>
    <WarningBanner warnings={item.warnings}/>

    <Link className={`district-open-link ${item.apartmentCount ? '' : 'disabled'}`} to={item.apartmentCount ? query : '/districts'} aria-disabled={!item.apartmentCount}>Смотреть квартиры района <ArrowRight size={15}/></Link>
  </article>
}
