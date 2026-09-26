import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, ArrowUpRight, Building2, ChevronDown, CircleHelp, MapPin, Search, SlidersHorizontal, Sparkles } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApartmentCard, EmptyState, PageLoading } from '../components/Ui'
import { MapPanel } from '../components/MapPanel'
import { PreferencePanel } from '../components/PreferencePanel'
import { RecommendationResults } from '../components/RecommendationResults'
import { Reveal } from '../components/MotionPrimitives'
import { api, isDemo } from '../lib/api'
import { filterApartments } from '../lib/catalog'
import { defaultPreferences, validatePreferences } from '../lib/preferences'
import { loadLastRecommendation } from '../lib/recommendations'
import type { GeoObject } from '../lib/dataSanitizers'
import type { Apartment, CatalogFilters, CatalogSort, RecommendationRequest, RecommendationResponse } from '../types'
import { useGeoDomStore } from '../store/useGeoDomStore'

const CitySignal = lazy(() => import('../components/CitySignal'))
const CATALOG_PAGE_SIZE = 24

export function Catalog() {
  const [items,setItems] = useState<Apartment[]>([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')
  const [geoObjects,setGeoObjects] = useState<GeoObject[]>([])
  const [geoError,setGeoError] = useState('')
  const [params,setParams] = useSearchParams()
  const preferences = useGeoDomStore(state => state.preferences)
  const filters = useGeoDomStore(state => state.filters)
  const filtersOpen = useGeoDomStore(state => state.filtersOpen)
  const workPicking = useGeoDomStore(state => state.workPicking)
  const setPreferences = useGeoDomStore(state => state.setPreferences)
  const setFilter = useGeoDomStore(state => state.setFilter)
  const resetFilters = useGeoDomStore(state => state.resetFilters)
  const resetPreferencesState = useGeoDomStore(state => state.resetPreferences)
  const setFiltersOpen = useGeoDomStore(state => state.setFiltersOpen)
  const setWorkPicking = useGeoDomStore(state => state.setWorkPicking)
  const setWorkLocation = useGeoDomStore(state => state.setWorkLocation)
  const [response,setResponse] = useState<RecommendationResponse|null>(loadLastRecommendation)
  const [recommendationLoading,setRecommendationLoading] = useState(() => !loadLastRecommendation())
  const [recommendationError,setRecommendationError] = useState('')
  const [validationError,setValidationError] = useState('')
  const [shownCount,setShownCount] = useState(CATALOG_PAGE_SIZE)
  const priorityRecalcReady = useRef(false)

  useEffect(() => {
    const district = params.get('district')
    const query = params.get('q')
    if (district !== null) setFilter('district',district)
    if (query !== null) setFilter('query',query)
  },[])

  useEffect(() => {
    api.list().then(setItems).catch(e => setError(e.message)).finally(() => setLoading(false))
    api.geoObjects().then(setGeoObjects).catch(e => setGeoError(e instanceof Error ? e.message : 'Не удалось загрузить инфраструктуру'))
  },[])

  useEffect(() => {
    const saved = loadLastRecommendation()
    if (!saved) setRecommendationLoading(true)
    api.recommend(preferences)
      .then(setResponse)
      .catch(e => {
        const message = e instanceof Error ? e.message : 'Сервер рекомендаций недоступен'
        if (!saved) setRecommendationError(message)
        else setResponse({ ...saved,warnings:[...saved.warnings,'Показан сохранённый результат: сервер временно недоступен.'] })
      })
      .finally(() => setRecommendationLoading(false))
  },[])

  const prioritySignature = Object.values(preferences.priorities).join(':')
  useEffect(() => {
    if (!priorityRecalcReady.current) {
      priorityRecalcReady.current = true
      return
    }
    const timer = window.setTimeout(() => {
      if (validatePreferences(preferences)) return
      setRecommendationLoading(true)
      setRecommendationError('')
      api.recommend(preferences)
        .then(setResponse)
        .catch(e => {
          const message = e instanceof Error ? e.message : 'Сервер рекомендаций недоступен'
          setRecommendationError(message)
        })
        .finally(() => setRecommendationLoading(false))
    },450)
    return () => window.clearTimeout(timer)
  },[prioritySignature])

  const districts = useMemo(() => [...new Set(items.map(x => x.district.name))].filter(x => x !== 'Уточняется').sort(),[items])
  const buildingTypes = useMemo(() => [...new Set(items.map(item => item.building_type).filter((value):value is string => !!value))].sort(),[items])
  const visible = useMemo(() => filterApartments(items,filters),[items,filters])
  const shownApartments = useMemo(() => visible.slice(0,shownCount),[visible,shownCount])
  const visibleIds = useMemo(() => new Set(visible.map(item => String(item.id))),[visible])
  useEffect(() => {
    setShownCount(CATALOG_PAGE_SIZE)
  },[filters])

  const personalScores = useMemo(() => new Map(
    (response?.items ?? []).map(item => [String(item.apartment_id),item.score] as const)
  ),[response])
  const districtCards = useMemo(() => districts.map(name => {
    const group = items.filter(x => x.district.name === name)
    const scores = group.map(item => {
      const personal = personalScores.get(String(item.id))
      if (typeof personal === 'number' && Number.isFinite(personal)) return personal
      const fallback = item.recommendation.score
      if (fallback === null || !Number.isFinite(fallback)) return null
      return fallback > 10 ? fallback/10 : fallback
    }).filter((value):value is number => value !== null)
    return {
      name,
      count:group.length,
      score:scores.length ? scores.reduce((sum,value) => sum+value,0)/scores.length : 0,
      photo:group[0]?.photos[0]?.url,
      description:group[0]?.district.description
    }
  }).sort((a,b) => b.score-a.score).slice(0,3),[items,districts,personalScores])

  function change<K extends keyof CatalogFilters>(key:K,value:CatalogFilters[K]) {
    setFilter(key,value)
  }

  function reset() {
    resetFilters()
    setParams({})
  }

  function search(e:React.FormEvent) {
    e.preventDefault()
    setParams(filters.query ? { q:filters.query } : {})
  }

  function setDistrict(name:string) {
    change('district',filters.district === name ? '' : name)
  }

  function pickDistrict(name:string) {
    setDistrict(name)
    document.getElementById('catalog')?.scrollIntoView({behavior:'smooth',block:'start'})
  }

  function startWorkPick() {
    setWorkPicking(true)
    setFiltersOpen(false)
    requestAnimationFrame(() => document.getElementById('main-map')?.scrollIntoView({ behavior:'smooth', block:'center' }))
  }

  function chooseWorkLocation(location:{ lat:number; lon:number }) {
    setWorkLocation(location)
  }

  async function recommend(value:RecommendationRequest) {
    setRecommendationLoading(true)
    setRecommendationError('')
    try {
      const result = await api.recommend(value)
      setResponse(result)
    } catch(e) {
      const message = e instanceof Error ? e.message : 'Сервер рекомендаций недоступен'
      if (response) setResponse({ ...response,warnings:[...response.warnings.filter(w => !w.startsWith('Показан сохранённый результат')),'Показан сохранённый результат: сервер временно недоступен.'] })
      else setRecommendationError(message)
    } finally {
      setRecommendationLoading(false)
    }
  }

  async function apply() {
    const invalid = validatePreferences(preferences)
    if (invalid) {
      setValidationError(invalid)
      return false
    }
    setValidationError('')
    change('maxPrice',preferences.budget_max)
    await recommend(preferences)
    document.getElementById('recommendations')?.scrollIntoView({behavior:'smooth',block:'start'})
    return true
  }

  function resetPreferences() {
    reset()
    resetPreferencesState()
    setValidationError('')
    void recommend(defaultPreferences)
  }

  const activeCount = Number(!!filters.district)+Number(!!filters.maxPrice)+Number(!!filters.rooms)+Number(!!filters.minArea)+Number(!!filters.yearFrom)+Number(!!filters.buildingType)+Number(filters.onlyWithPhotos)

  return <div className="dashboard-page">
    <div className="shell dashboard-grid">
      <PreferencePanel
        value={preferences}
        onChange={setPreferences}
        onApply={apply}
        busy={recommendationLoading}
        error={validationError}
        filters={filters}
        districts={districts}
        buildingTypes={buildingTypes}
        onFilter={change}
        onReset={resetPreferences}
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        workPicking={workPicking}
        onStartWorkPick={startWorkPick}
      />
      <div className="dashboard-main">
        <Reveal className="dashboard-intro">
          <div>
            <span className="dashboard-kicker">GEODOM · АНАЛИЗ ГОРОДСКОЙ СРЕДЫ</span>
            <h1>Выберите квартиру <em>с пониманием района</em></h1>
            <p>Укажите бюджет, семью и важные для вас факторы. Изучите персональный подбор, инфраструктуру и планы развития.</p>
          </div>
          <div className="intro-badge">
            <span className="intro-badge-icon"><Building2 size={22}/></span>
            <div><b>{districts.length || '—'} районов</b><small>для осознанного выбора</small></div>
            <ArrowUpRight size={16}/>
          </div>
          <Suspense fallback={null}><CitySignal/></Suspense>
        </Reveal>

        <form className="dashboard-search" onSubmit={search}>
          <Search size={19}/>
          <input aria-label="Поиск по району или адресу" value={filters.query} onChange={e => change('query',e.target.value)} placeholder="Поиск по району, улице или адресу…"/>
          <button type="submit">Найти <ArrowRight size={16}/></button>
        </form>

        <Reveal delay={.08}>
        <div className="map-panel" id="main-map">
          <div className="map-topbar">
            <div><span className="map-tab active"><MapPin size={16}/> Яндекс Карта</span><span className="map-tab secondary">Красноярск и районы</span></div>
            <div className="map-topbar-note"><span className="pulse-dot"/> {workPicking ? 'Выберите место работы' : `${visible.length} из ${items.length} подходят фильтрам · все показаны`}</div>
          </div>
          {loading
            ? <PageLoading/>
            : error
              ? <EmptyState title="Карта недоступна" message={error}/>
              : <MapPanel
                  items={items}
                  geoObjects={geoObjects}
                  activeApartmentIds={visibleIds}
                  scoreByApartment={personalScores}
                  selectedDistrict={filters.district}
                  onDistrict={setDistrict}
                  workLocation={preferences.work_location}
                  workPicking={workPicking}
                  onWorkLocation={chooseWorkLocation}
                />}
          <div className="map-caption"><CircleHelp size={15}/> Районы превращаются в точки при приближении. Инфраструктура кластеризуется и фильтруется слоями.{geoError ? ` Слой POI недоступен: ${geoError}.` : ''} <span>Картография © Яндекс</span></div>
        </div>
        </Reveal>

        <Reveal delay={.04}><RecommendationResults response={response} loading={recommendationLoading} error={recommendationError} onRetry={() => { void recommend(preferences) }}/></Reveal>

        <Reveal>
        <div className="dashboard-section-title">
          <div><h2>Районы <span>Красноярска</span></h2><p>Обзор квартир и инфраструктуры по районам</p></div>
          <span className="mini-label">{isDemo ? 'ДЕМОНСТРАЦИОННЫЕ ОЦЕНКИ' : 'ОБЗОР РАЙОНОВ'}</span>
        </div>
        <div className="district-cards">{districtCards.map((d,i) => <button className={`district-card ${filters.district === d.name ? 'chosen' : ''}`} key={d.name} onClick={() => pickDistrict(d.name)}>
          <div className="district-image">{d.photo && <img src={d.photo} alt=""/>}<span>{i === 0 ? '✦ Высокая оценка' : `${d.count} предложений`}</span></div>
          <div className="district-card-head"><h3>{d.name}</h3><b><Sparkles size={16}/>{d.score.toFixed(1)} <small>/ 10</small></b></div>
          <p>{d.description}</p>
          <div className="district-card-bottom">Смотреть квартиры <ArrowRight size={16}/></div>
        </button>)}</div>
        </Reveal>

        <Reveal>
        <section className="listings-section" id="catalog">
          <div className="dashboard-section-title listings-title">
            <div><h2>Все <span>квартиры</span></h2><p>{loading ? 'Загружаем предложения…' : `${visible.length} предложений · показано ${Math.min(shownCount,visible.length)}`}</p></div>
            <div className="listings-actions">
              <button className="mobile-filter-button" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={17}/> Параметры {activeCount > 0 && <b>{activeCount}</b>}</button>
              <label htmlFor="sort">Сортировка</label>
              <div className="select-wrap">
                <select id="sort" value={filters.sort} onChange={e => change('sort',e.target.value as CatalogSort)}>
                  <option value="recommended">По оценке</option>
                  <option value="price_asc">Цена ↑</option>
                  <option value="price_desc">Цена ↓</option>
                  <option value="area_desc">Площадь ↓</option>
                </select>
                <ChevronDown size={15}/>
              </div>
            </div>
          </div>
          {loading
            ? <PageLoading/>
            : error
              ? <EmptyState title="Не удалось загрузить квартиры" message={error} action={<button className="button dark" onClick={() => window.location.reload()}>Повторить</button>}/>
              : visible.length
                ? <>
                    <div className="card-grid">{shownApartments.map((item,index) => <ApartmentCard item={item} index={index} key={item.id}/>)}</div>
                    {shownCount < visible.length && <div className="catalog-load-more">
                      <button type="button" className="button light" onClick={() => setShownCount(count => count+CATALOG_PAGE_SIZE)}>Показать ещё {Math.min(CATALOG_PAGE_SIZE,visible.length-shownCount)}</button>
                      <span>{shownCount} / {visible.length}</span>
                    </div>}
                  </>
                : <EmptyState title="Ничего не нашлось" message="Попробуйте расширить бюджет или выбрать другой район." action={<button className="button dark" onClick={reset}>Сбросить фильтры</button>}/>}
        </section>
        </Reveal>

        <div className="dashboard-end">
          <span><Sparkles size={18}/> ГеоДом помогает смотреть дальше квартиры</span>
          <Link to="/register">Разместить своё объявление <ArrowRight size={17}/></Link>
        </div>
      </div>
    </div>
  </div>
}
