import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ArrowUpRight, Building2, ChevronDown, CircleHelp, MapPin, Search, SlidersHorizontal, Sparkles } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApartmentCard, EmptyState, PageLoading } from '../components/Ui'
import { MapPanel } from '../components/MapPanel'
import { PreferencePanel } from '../components/PreferencePanel'
import { RecommendationResults } from '../components/RecommendationResults'
import { api, isDemo } from '../lib/api'
import { filterApartments } from '../lib/catalog'
import { defaultPreferences, loadPreferences, savePreferences, validatePreferences } from '../lib/preferences'
import type { Apartment, CatalogFilters, CatalogSort, RecommendationRequest, RecommendationResponse } from '../types'

const initial: CatalogFilters = { district:'', maxPrice:0, rooms:0, query:'', sort:'recommended' }
export function Catalog() {
  const [items,setItems] = useState<Apartment[]>([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')
  const [params,setParams] = useSearchParams()
  const [filtersOpen,setFiltersOpen] = useState(false)
  const [filters,setFilters] = useState<CatalogFilters>(() => ({ ...initial,district:params.get('district') || '',query:params.get('q') || '' }))
  const [preferences,setPreferences] = useState<RecommendationRequest>(loadPreferences)
  const [response,setResponse] = useState<RecommendationResponse|null>(null)
  const [recommendationLoading,setRecommendationLoading] = useState(true)
  const [recommendationError,setRecommendationError] = useState('')
  const [validationError,setValidationError] = useState('')
  useEffect(() => { api.list().then(setItems).catch(e => setError(e.message)).finally(() => setLoading(false)) },[])
  useEffect(() => { api.recommend(loadPreferences()).then(setResponse).catch(e => setRecommendationError(e.message)).finally(() => setRecommendationLoading(false)) },[])
  const districts = useMemo(() => [...new Set(items.map(x => x.district.name))].filter(x => x !== 'Уточняется').sort(),[items])
  const visible = useMemo(() => filterApartments(items,filters),[items,filters])
  const districtCards = useMemo(() => districts.map(name => {
    const group = items.filter(x => x.district.name === name)
    return { name, count:group.length, score:Math.round(group.reduce((sum,x) => sum+(x.recommendation.score || 0),0)/group.length), photo:group[0]?.photos[0]?.url, description:group[0]?.district.description }
  }).sort((a,b) => b.score-a.score).slice(0,3),[items,districts])
  function change<K extends keyof CatalogFilters>(key:K,value:CatalogFilters[K]) { setFilters(prev => ({ ...prev,[key]:value })) }
  function reset() { setFilters(initial); setParams({}) }
  function search(e:React.FormEvent) { e.preventDefault(); setParams(filters.query ? { q:filters.query } : {}) }
  function pickDistrict(name:string) { change('district',filters.district === name ? '' : name); document.getElementById('catalog')?.scrollIntoView({behavior:'smooth',block:'start'}) }
  async function recommend(value:RecommendationRequest) {
    setRecommendationLoading(true); setRecommendationError('')
    try { const result = await api.recommend(value); setResponse(result) }
    catch(e) { setRecommendationError(e instanceof Error ? e.message : 'Сервер рекомендаций недоступен'); setResponse(null) }
    finally { setRecommendationLoading(false) }
  }
  async function apply() {
    const invalid = validatePreferences(preferences)
    if (invalid) { setValidationError(invalid); return false }
    setValidationError(''); savePreferences(preferences); change('maxPrice',preferences.budget_max)
    await recommend(preferences)
    document.getElementById('recommendations')?.scrollIntoView({behavior:'smooth',block:'start'})
    return true
  }
  function resetPreferences() {
    reset(); setPreferences(defaultPreferences); setValidationError(''); savePreferences(defaultPreferences)
    void recommend(defaultPreferences)
  }
  const activeCount = Number(!!filters.district)+Number(!!filters.maxPrice)+Number(!!filters.rooms)
  return <div className="dashboard-page"><div className="shell dashboard-grid">
    <PreferencePanel value={preferences} onChange={setPreferences} onApply={apply} busy={recommendationLoading} error={validationError} filters={filters} districts={districts} onFilter={change} onReset={resetPreferences} open={filtersOpen} onClose={() => setFiltersOpen(false)}/>
    <div className="dashboard-main"><div className="dashboard-intro"><div><span className="dashboard-kicker">GEODOM · АНАЛИЗ ГОРОДСКОЙ СРЕДЫ</span><h1>Выберите квартиру <em>с пониманием района</em></h1><p>Укажите бюджет, семью и важные для вас факторы. Изучите персональный подбор, инфраструктуру и планы развития.</p></div><div className="intro-badge"><span className="intro-badge-icon"><Building2 size={22}/></span><div><b>{districts.length || '—'} районов</b><small>для осознанного выбора</small></div><ArrowUpRight size={16}/></div></div>
      <form className="dashboard-search" onSubmit={search}><Search size={19}/><input aria-label="Поиск по району или адресу" value={filters.query} onChange={e => change('query',e.target.value)} placeholder="Поиск по району, улице или адресу…"/><button type="submit">Найти <ArrowRight size={16}/></button></form>
      <div className="map-panel"><div className="map-topbar"><div><span className="map-tab active"><MapPin size={16}/> Карта квартир</span><span className="map-tab secondary">Красноярск и районы</span></div><div className="map-topbar-note"><span className="pulse-dot"/> {visible.length} предложений на карте</div></div>{loading ? <PageLoading/> : error ? <EmptyState title="Карта недоступна" message={error}/> : <MapPanel items={visible} selectedDistrict={filters.district} onDistrict={pickDistrict}/>}<div className="map-caption"><CircleHelp size={15}/> Нажмите на цену квартиры или оценку района, чтобы изучить подробнее. <span>Картография © OpenStreetMap</span></div></div>
      <RecommendationResults response={response} loading={recommendationLoading} error={recommendationError} onRetry={() => { void recommend(preferences) }}/>
      <div className="dashboard-section-title"><div><h2>Районы <span>Красноярска</span></h2><p>Обзор квартир и инфраструктуры по районам</p></div><span className="mini-label">{isDemo ? 'ДЕМОНСТРАЦИОННЫЕ ОЦЕНКИ' : 'ОБЗОР РАЙОНОВ'}</span></div><div className="district-cards">{districtCards.map((d,i) => <button className={`district-card ${filters.district === d.name ? 'chosen' : ''}`} key={d.name} onClick={() => pickDistrict(d.name)}><div className="district-image">{d.photo && <img src={d.photo} alt=""/>}<span>{i === 0 ? '✦ Высокая оценка' : `${d.count} предложений`}</span></div><div className="district-card-head"><h3>{d.name}</h3><b><Sparkles size={16}/>{(d.score/10).toFixed(1)} <small>/ 10</small></b></div><p>{d.description}</p><div className="district-card-bottom">Смотреть квартиры <ArrowRight size={16}/></div></button>)}</div>
      <section className="listings-section" id="catalog"><div className="dashboard-section-title listings-title"><div><h2>Все <span>квартиры</span></h2><p>{loading ? 'Загружаем предложения…' : `${visible.length} предложений в каталоге`}</p></div><div className="listings-actions"><button className="mobile-filter-button" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={17}/> Параметры {activeCount > 0 && <b>{activeCount}</b>}</button><label htmlFor="sort">Сортировка</label><div className="select-wrap"><select id="sort" value={filters.sort} onChange={e => change('sort',e.target.value as CatalogSort)}><option value="recommended">По оценке</option><option value="price_asc">Цена ↑</option><option value="price_desc">Цена ↓</option><option value="area_desc">Площадь ↓</option></select><ChevronDown size={15}/></div></div></div>{loading ? <PageLoading/> : error ? <EmptyState title="Не удалось загрузить квартиры" message={error} action={<button className="button dark" onClick={() => window.location.reload()}>Повторить</button>}/> : visible.length ? <div className="card-grid">{visible.map((item,index) => <ApartmentCard item={item} index={index} key={item.id}/>)}</div> : <EmptyState title="Ничего не нашлось" message="Попробуйте расширить бюджет или выбрать другой район." action={<button className="button dark" onClick={reset}>Сбросить фильтры</button>}/>}</section>
      <div className="dashboard-end"><span><Sparkles size={18}/> ГеоДом помогает смотреть дальше квартиры</span><Link to="/register">Разместить своё объявление <ArrowRight size={17}/></Link></div>
    </div></div></div>
}
