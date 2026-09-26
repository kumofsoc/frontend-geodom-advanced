import { useEffect,useMemo,useState } from 'react'
import { ArrowLeft,FileText,MapPin,Printer,Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { price } from '../lib/catalog'
import { loadLastRecommendation } from '../lib/recommendations'
import { loadSavedMortgageCalculations } from '../lib/mortgageStorage'
import { loadRentVsBuyDecision,loadSelectedComplexIds } from '../lib/decisionSnapshot'
import { CoverageIndicator,DataFreshness,SourceBadge,WarningBanner } from '../components/DataTrust'
import { useGeoDomStore } from '../store/useGeoDomStore'
import type { Apartment,DistrictAnalysis,RecommendationItem,ResidentialComplex } from '../types'

const factorLabels:Record<keyof RecommendationItem['scores'],string>={
  schools:'Школы',parks:'Парки',transport:'Транспорт',ecology:'Экология',
  safety:'Безопасность',commute:'Дорога до работы',price:'Цена'
}

function familyLabel(adults:number,children:number) {
  const child=children === 0 ? 'без детей' : children === 1 ? '1 ребёнок' : children < 5 ? `${children} ребёнка` : `${children} детей`
  return `${adults} взр. · ${child}`
}

function score(value:number|null) {
  return value === null ? 'Нет данных' : value.toFixed(1)
}

export function Report() {
  const preferences=useGeoDomStore(state => state.preferences)
  const filters=useGeoDomStore(state => state.filters)
  const comparedIds=useGeoDomStore(state => state.comparedIds)
  const response=loadLastRecommendation()
  const top=response?.items.slice(0,3) ?? []
  const mortgage=loadSavedMortgageCalculations()[0] ?? null
  const rentDecision=loadRentVsBuyDecision()

  const [apartments,setApartments]=useState<Apartment[]>([])
  const [districts,setDistricts]=useState<DistrictAnalysis[]>([])
  const [complexes,setComplexes]=useState<ResidentialComplex[]>([])
  const [dataWarnings,setDataWarnings]=useState<string[]>([])

  useEffect(() => {
    if (!response) return
    const controller=new AbortController()
    void api.reportOpen(response,controller.signal).catch(() => {})
    return () => controller.abort()
  },[response?.request_id])

  useEffect(() => {
    if (!response) return
    const controller=new AbortController()
    const ids=[...new Set([...comparedIds,...top.map(item => String(item.apartment_id))])].slice(0,6)

    Promise.all(ids.map(async id => {
      try { return await api.detail(id) }
      catch { return null }
    })).then(rows => {
      if (!controller.signal.aborted) setApartments(rows.filter((item):item is Apartment => item !== null))
    })

    api.districtAnalysis(controller.signal)
      .then(rows => { if (!controller.signal.aborted) setDistricts(rows) })
      .catch(error => { if (!controller.signal.aborted) setDataWarnings(current => [...current,error instanceof Error ? error.message : 'Данные районов недоступны']) })

    const selectedComplexes=loadSelectedComplexIds()
    if (selectedComplexes.length) {
      api.complexes(30,controller.signal)
        .then(rows => { if (!controller.signal.aborted) setComplexes(rows.filter(item => selectedComplexes.includes(item.id))) })
        .catch(error => { if (!controller.signal.aborted) setDataWarnings(current => [...current,error instanceof Error ? error.message : 'Сравнение ЖК недоступно']) })
    }

    return () => controller.abort()
  },[response?.request_id,comparedIds.join('|')])

  const relevantDistricts=useMemo(() => {
    const names=new Set<string>()
    if (filters.district) names.add(filters.district)
    for(const apartment of apartments) names.add(apartment.district.name)
    const rows=districts.filter(item => names.has(item.name))
    return rows.length ? rows.slice(0,3) : districts.slice(0,3)
  },[districts,apartments,filters.district])

  function printReport() { window.print() }

  if (!response) return <div className="shell report-page">
    <Link to="/" className="back-link"><ArrowLeft size={17}/> К подбору</Link>
    <div className="report-empty"><FileText size={34}/><h1>Сначала соберите подбор</h1><p>Отчёт строится только из последнего успешного ответа backend recommendations и выбранных пользователем сценариев.</p><Link className="button dark" to="/#recommendations">Перейти к подбору</Link></div>
  </div>

  const allWarnings=[...response.warnings,...response.items.flatMap(item => item.warnings),...dataWarnings]
  const reportApartments=comparedIds.length
    ? comparedIds.map(id => apartments.find(item => item.id === id)).filter((item):item is Apartment => !!item)
    : apartments.filter(item => top.some(candidate => String(candidate.apartment_id) === item.id)).slice(0,3)

  return <div className="shell report-page decision-report">
    <div className="report-toolbar">
      <Link to="/#recommendations" className="back-link"><ArrowLeft size={17}/> Вернуться к подбору</Link>
      <button className="button dark" onClick={printReport}><Printer size={17}/> Печать / PDF</button>
    </div>

    <header className="report-header">
      <div><span>GEODOM / ИТОГ РЕШЕНИЯ</span><h1>Короткий список для решения</h1><p>Один отчёт объединяет параметры поиска, server-owned scoring, выбранные объекты, районы, ЖК и финансовые сценарии.</p></div>
      <div className="report-request"><small>REQUEST ID</small><b>{response.request_id.slice(0,12)}</b><span>{response.scoring_version}</span></div>
    </header>

    <section className="report-parameters">
      <div><small>Бюджет</small><b>{price(preferences.budget_max)}</b></div>
      <div><small>Первоначальный взнос</small><b>{price(preferences.down_payment)}</b></div>
      <div><small>Семья</small><b>{familyLabel(preferences.family.adults,preferences.family.children)}</b></div>
      <div><small>Работа</small><b>{preferences.work_location ? <><MapPin size={14}/> {preferences.work_location.lat.toFixed(4)}, {preferences.work_location.lon.toFixed(4)}</> : 'Не выбрана'}</b></div>
      <div><small>Макс. время в пути</small><b>{preferences.max_commute_minutes} мин</b></div>
    </section>

    <WarningBanner title="Ограничения и предупреждения" warnings={[...new Set(allWarnings)]}/>

    <section className="report-section">
      <div className="report-section-head"><div><span>01</span><h2>Персональный подбор</h2></div><small>{top.length} из {response.items.length} вариантов</small></div>
      <div className="report-candidates">{top.map((item,index) => <article key={String(item.apartment_id)}>
        <div className="report-rank">#{index+1}</div>
        <div className="report-candidate-main"><span>SERVER SCORE</span><h3>{item.title}</h3><strong>{price(item.price)}</strong><p>{item.reasons.slice(0,3).join(' · ') || 'Причины рекомендации не переданы'}</p>{item.predicted_price_m2 !== null && <small>Оценка модели: {price(Math.round(item.predicted_price_m2))}/м²</small>}</div>
        <div className="report-score"><Sparkles size={16}/><b>{score(item.score)}</b>{item.score !== null && <small>/ 10</small>}</div>
      </article>)}</div>
      <div className="report-factor-table">
        <div className="report-factor-row header"><span>Фактор</span>{top.map((item,index) => <b key={String(item.apartment_id)}>#{index+1}</b>)}</div>
        {(Object.keys(factorLabels) as Array<keyof RecommendationItem['scores']>).map(key => <div className="report-factor-row" key={key}><span>{factorLabels[key]}</span>{top.map(item => <b key={String(item.apartment_id)}>{item.scores[key]?.toFixed(1) ?? 'Нет данных'}</b>)}</div>)}
      </div>
    </section>

    <section className="report-section">
      <div className="report-section-head"><div><span>02</span><h2>Карта решения</h2></div><small>работа + выбранные объекты</small></div>
      <div className="report-map-context">
        <div><span>Работа</span><b>{preferences.work_location ? `${preferences.work_location.lat.toFixed(5)}, ${preferences.work_location.lon.toFixed(5)}` : 'Не выбрана'}</b></div>
        {reportApartments.map(item => <div key={item.id}><span>{item.district.name}</span><b>{item.address}</b>{item.latitude && item.longitude ? <a href={`https://yandex.ru/maps/?ll=${item.longitude}%2C${item.latitude}&z=14`} target="_blank" rel="noopener noreferrer">Открыть на карте</a> : <small>Координаты не переданы</small>}</div>)}
      </div>
    </section>

    <section className="report-section">
      <div className="report-section-head"><div><span>03</span><h2>Районы</h2></div><small>backend data coverage</small></div>
      <div className="report-district-grid">{relevantDistricts.map(item => <article key={item.id}>
        <div><h3>{item.name}</h3><b>{score(item.overallScore)}{item.overallScore !== null ? ' / 10' : ''}</b></div>
        <CoverageIndicator value={item.coverage}/>
        <SourceBadge name={item.sourceName} url={item.sourceUrl}/>
        <DataFreshness date={item.updatedAt}/>
        <WarningBanner warnings={item.warnings}/>
      </article>)}</div>
    </section>

    <section className="report-section">
      <div className="report-section-head"><div><span>04</span><h2>Выбранные квартиры</h2></div><small>{reportApartments.length} объектов</small></div>
      {reportApartments.length ? <div className="report-object-grid">{reportApartments.map(item => <article key={item.id}><h3>{item.title}</h3><b>{price(item.price)}</b><p>{item.district.name} · {item.address}</p><div><SourceBadge name={item.upstream_source || item.source}/><DataFreshness date={item.source_updated_at || item.collected_at || item.created_at}/></div></article>)}</div> : <p className="report-missing-state">Квартиры из подбора не удалось загрузить. Recommendation score выше сохранён без подмены detail-данными.</p>}
    </section>

    <section className="report-section">
      <div className="report-section-head"><div><span>05</span><h2>Сравнение ЖК</h2></div><small>до 3 выбранных</small></div>
      {complexes.length ? <div className="report-complex-grid">{complexes.map(item => <article key={item.id}><h3>{item.name}</h3><p>{item.developer || 'Застройщик не указан'} · {item.address || 'Адрес не указан'}</p><b>{item.minPrice === null ? 'Цена не передана' : `от ${price(item.minPrice)}`}</b><div><SourceBadge name={item.sourceName} url={item.sourceUrl}/><DataFreshness date={item.updatedAt}/></div></article>)}</div> : <p className="report-missing-state">ЖК не выбраны или backend не вернул выбранные объекты. Отчёт не подставляет случайные комплексы.</p>}
    </section>

    <section className="report-section">
      <div className="report-section-head"><div><span>06</span><h2>Финансы</h2></div><small>последние сохранённые сценарии</small></div>
      <div className="report-finance-grid">
        <article><span>ИПОТЕКА</span>{mortgage ? <><h3>{mortgage.bank}</h3><strong>{price(Math.round(mortgage.monthlyPayment))}/мес</strong><p>{mortgage.rate ?? '—'}% · {mortgage.years} лет · кредит {price(Math.round(mortgage.apartmentPrice-mortgage.downPayment))}</p><DataFreshness date={mortgage.createdAt} label="Расчёт сохранён"/></> : <p>Сохранённого ипотечного расчёта нет.</p>}</article>
        <article><span>КУПИТЬ ИЛИ СНИМАТЬ</span>{rentDecision ? <><h3>{rentDecision.result.break_even_year === null ? 'Break-even не найден' : `Около ${rentDecision.result.break_even_year} лет до break-even`}</h3><strong>{price(rentDecision.result.mortgage_monthly)} vs {price(rentDecision.result.rent_monthly)}/мес</strong><p>Владение: {price(rentDecision.result.ownership_total)} · аренда: {price(rentDecision.result.rent_total)} за {rentDecision.result.horizon_years} лет.</p><SourceBadge name={rentDecision.result.source_name}/><DataFreshness date={rentDecision.result.updated_at}/><WarningBanner warnings={rentDecision.result.warnings}/></> : <p>Сценарий buy-vs-rent ещё не рассчитан или backend расчёта недоступен.</p>}</article>
      </div>
    </section>

    <footer className="report-footer">
      <div><b>Модель</b><span>{response.model_version}</span></div>
      <div><b>Скоринг</b><span>{response.scoring_version}</span></div>
      <div><b>ML</b><span>{response.ml_available ? 'доступен' : 'недоступен / demo adapter'}</span></div>
      <p>Отчёт — итог выбранного сценария, а не гарантия цены, доступности кредита, сроков строительства или качества среды. Проверяйте предупреждения, даты и первоисточники.</p>
    </footer>
  </div>
}
