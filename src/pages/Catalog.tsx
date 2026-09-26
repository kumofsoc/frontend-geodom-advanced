import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ArrowUpRight, Building2, ChevronDown, CircleHelp, MapPin, Search, SlidersHorizontal, Sparkles } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApartmentCard, EmptyState, PageLoading } from '../components/Ui'
import { MapPanel } from '../components/MapPanel'
import { PreferencePanel } from '../components/PreferencePanel'
import { RecommendationResults } from '../components/RecommendationResults'
import { api, isDemo } from '../lib/api'
import { filterApartments } from '../lib/catalog'
import {
  defaultCatalogFilters,
  defaultPreferences,
  loadCatalogFilters,
  loadPreferences,
  saveCatalogFilters,
  savePreferences,
  validatePreferences
} from '../lib/preferences'
import { loadLastRecommendation } from '../lib/recommendations'
import type { Apartment, CatalogFilters, CatalogSort, RecommendationRequest, RecommendationResponse } from '../types'

export function Catalog() {
  const [items,setItems] = useState<Apartment[]>([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')
  const [params,setParams] = useSearchParams()
  const [filtersOpen,setFiltersOpen] = useState(false)
  const [workPicking,setWorkPicking] = useState(false)
  const [filters,setFilters] = useState<CatalogFilters>(() => {
    const saved = loadCatalogFilters()
    return {
      ...saved,
      district:params.get('district') ?? saved.district,
      query:params.get('q') ?? saved.query
    }
  })
  const [preferences,setPreferences] = useState<RecommendationRequest>(loadPreferences)
  const [response,setResponse] = useState<RecommendationResponse|null>(loadLastRecommendation)
  const [recommendationLoading,setRecommendationLoading] = useState(() => !loadLastRecommendation())
  const [recommendationError,setRecommendationError] = useState('')
  const [validationError,setValidationError] = useState('')

  useEffect(() => {
    api.list().then(setItems).catch(e => setError(e.message)).finally(() => setLoading(false))
  },[])

  useEffect(() => {
    const saved = loadLastRecommendation()
    if (!saved) setRecommendationLoading(true)
    api.recommend(loadPreferences())
      .then(setResponse)
      .catch(e => {
        const message = e instanceof Error ? e.message : 'Сервер рекомендаций недоступен'
        if (!saved) setRecommendationError(message)
        else setResponse({ ...saved,warnings:[...saved.warnings,'Показан сохранённый результат: сервер временно недоступен.'] })
      })
      .finally(() => setRecommendationLoading(false))
  },[])

  useEffect(() => { savePreferences(preferences) },[preferences])
  useEffect(() => { saveCatalogFilters(filters) },[filters])

  const districts = useMemo(() => [...new Set(items.map(x => x.district.name))].filter(x => x !== 'Уточняется').sort(),[items])
  const visible = useMemo(() => filterApartments(items,filters),[items,filters])
  const districtCards = useMemo(() => districts.map(name => {
    const group = items.filter(x => x.district.name === name)
    return {
      name,
      count:group.length,
      score:Math.round(group.reduce((sum,x) => sum+(x.recommendation.score || 0),0)/group.length),
      photo:group[0]?.photos[0]?.url,
      description:group[0]?.district.description
    }
  }).sort((a,b) => b.score-a.score).slice(0,3),[items,districts])

  function change<K extends keyof CatalogFilters>(key:K,value:CatalogFilters[K]) {
    setFilters(prev => ({ ...prev,[key]:value }))
  }

  function reset() {
    setFilters(defaultCatalogFilters)
    setParams({})
  }

  function search(e:React.FormEvent) {
    e.preventDefault()
    setParams(filters.query ? { q:filters.query } : {})
  }

  function pickDistrict(name:string) {
    change('district',filters.district === name ? '' : name)
    document.getElementById('catalog')?.scrollIntoView({behavior:'smooth',block:'start'})
  }

  function startWorkPick() {
    setWorkPicking(true)
    setFiltersOpen(false)
    requestAnimationFrame(() => document.getElementById('main-map')?.scrollIntoView({ behavior:'smooth', block:'center' }))
  }

  function chooseWorkLocation(location:{ lat:number; lon:number }) {
    setPreferences(current => ({ ...current,work_location:location }))
    setWorkPicking(false)
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
    savePreferences(preferences)
    change('maxPrice',preferences.budget_max)
    await recommend(preferences)
    document.getElementById('recommendations')?.scrollIntoView({behavior:'smooth',block:'start'})
    return true
  }

  function resetPreferences() {
    reset()
    setPreferences(defaultPreferences)
    setWorkPicking(false)
    setValidationError('')
    savePreferences(defaultPreferences)
    void recommend(defaultPreferences)
  }

  const activeCount = Number(!!filters.district)+Number(!!filters.maxPrice)+Number(!!filters.rooms)

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
        onFilter={change}
        onReset={resetPreferences}
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        workPicking={workPicking}
        onStartWorkPick={startWorkPick}
      />
      <div className="dashboard-main">
        <div className="dashboard-intro">
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
        </div>

        <form className="dashboard-search" onSubmit={search}>
          <Search size={19}/>
          <input aria-label="Поиск по району или адресу" value={filters.query} onChange={e => change('query',e.target.value)} placeholder="Поиск по району, улице или адресу…"/>
          <button type="submit">Найти <ArrowRight size={16}/></button>
        </form>

        <div className="map-panel" id="main-map">
          <div className="map-topbar">
            <div><span className="map-tab active"><MapPin size={16}/> Яндекс Карта</span><span className="map-tab secondary">Красноярск и районы</span></div>
            <div className="map-topbar-note"><span className="pulse-dot"/> {workPicking ? 'Выберите место работы' : `${visible.length} предложений на карте`}</div>
          </div>
          {loading
            ? <PageLoading/>
            : error
              ? <EmptyState title="Карта недоступна" message={error}/>
              : <MapPanel
                  items={visible}
                  selectedDistrict={filters.district}
                  onDistrict={pickDistrict}
                  workLocation={preferences.work_location}
                  workPicking={workPicking}
                  onWorkLocation={chooseWorkLocation}
                />}
          <div className="map-caption"><CircleHelp size={15}/> Районы превращаются в точки при приближении. Колесо мыши масштабирует карту. <span>Картография © Яндекс</span></div>
        </div>

        <RecommendationResults response={response} loading={recommendationLoading} error={recommendationError} onRetry={() => { void recommend(preferences) }}/>

        <div className="dashboard-section-title">
          <div><h2>Районы <span>Красноярска</span></h2><p>Обзор квартир и инфраструктуры по районам</p></div>
          <span className="mini-label">{isDemo ? 'ДЕМОНСТРАЦИОННЫЕ ОЦЕНКИ' : 'ОБЗОР РАЙОНОВ'}</span>
        </div>
        <div className="district-cards">{districtCards.map((d,i) => <button className={`district-card ${filters.district === d.name ? 'chosen' : ''}`} key={d.name} onClick={() => pickDistrict(d.name)}>
          <div className="district-image">{d.photo && <img src={d.photo} alt=""/>}<span>{i === 0 ? '✦ Высокая оценка' : `${d.count} предложений`}</span></div>
          <div className="district-card-head"><h3>{d.name}</h3><b><Sparkles size={16}/>{(d.score/10).toFixed(1)} <small>/ 10</small></b></div>
          <p>{d.description}</p>
          <div className="district-card-bottom">Смотреть квартиры <ArrowRight size={16}/></div>
        </button>)}</div>

        <section className="listings-section" id="catalog">
          <div className="dashboard-section-title listings-title">
            <div><h2>Все <span>квартиры</span></h2><p>{loading ? 'Загружаем предложения…' : `${visible.length} предложений в каталоге`}</p></div>
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
                ? <div className="card-grid">{visible.map((item,index) => <ApartmentCard item={item} index={index} key={item.id}/>)}</div>
                : <EmptyState title="Ничего не нашлось" message="Попробуйте расширить бюджет или выбрать другой район." action={<button className="button dark" onClick={reset}>Сбросить фильтры</button>}/>}
        </section>

        <div className="dashboard-end">
          <span><Sparkles size={18}/> ГеоДом помогает смотреть дальше квартиры</span>
          <Link to="/register">Разместить своё объявление <ArrowRight size={17}/></Link>
        </div>
      </div>
    </div>
  </div>
}
