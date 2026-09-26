import { lazy,Suspense,useEffect,useMemo,useRef,useState } from 'react'
import { ArrowRight,ArrowUpRight,BellRing,Building2,ChevronDown,CircleHelp,MapPin,Search,SlidersHorizontal,Sparkles } from 'lucide-react'
import { Link,useSearchParams } from 'react-router-dom'
import { ApartmentCard,EmptyState } from '../components/Ui'
import { MapPanel } from '../components/MapPanel'
import { PreferencePanel } from '../components/PreferencePanel'
import { RecommendationResults } from '../components/RecommendationResults'
import { Reveal } from '../components/MotionPrimitives'
import { DistrictAnalysisCards } from '../components/DistrictAnalysisCards'
import { ResidentialComplexComparison } from '../components/ResidentialComplexComparison'
import { WarningBanner } from '../components/DataTrust'
import { api,isDemo } from '../lib/api'
import { filterApartments } from '../lib/catalog'
import { defaultPreferences,validatePreferences } from '../lib/preferences'
import { loadLastRecommendation } from '../lib/recommendations'
import type { Apartment,CatalogFilters,CatalogSort,DistrictAnalysis,RecommendationRequest,RecommendationResponse } from '../types'
import { useGeoDomStore } from '../store/useGeoDomStore'
import { KRASNOYARSK_DISTRICTS } from '../lib/krasnoyarsk'
import { loadPromotedIds } from '../lib/pro'
import { createSavedSearch } from '../lib/savedSearches'

const CitySignal=lazy(() => import('../components/CitySignal'))
const MortgageCalculator=lazy(() => import('../components/MortgageCalculator').then(module => ({default:module.MortgageCalculator})))
const RentVsBuyCalculator=lazy(() => import('../components/RentVsBuyCalculator').then(module => ({default:module.RentVsBuyCalculator})))
const CATALOG_PAGE_SIZE=24

type DistrictDirectoryItem={id:string;name:string;description:string}

function CatalogSkeleton() {
  return <div className="catalog-skeleton-grid" aria-label="Загрузка квартир">
    {Array.from({length:6},(_,index) => <div className="catalog-skeleton-card" key={index}><i/><span/><span/><span/></div>)}
  </div>
}

export function Catalog() {
  const [items,setItems]=useState<Apartment[]>([])
  const [loading,setLoading]=useState(true)
  const [loadingMore,setLoadingMore]=useState(false)
  const [hasMore,setHasMore]=useState(false)
  const [error,setError]=useState('')
  const [districtDirectory,setDistrictDirectory]=useState<DistrictDirectoryItem[]>([])
  const [districtAnalysis,setDistrictAnalysis]=useState<DistrictAnalysis[]>([])
  const [districtError,setDistrictError]=useState('')
  const [params,setParams]=useSearchParams()

  const preferences=useGeoDomStore(state => state.preferences)
  const filters=useGeoDomStore(state => state.filters)
  const user=useGeoDomStore(state => state.user)
  const housingIntent=useGeoDomStore(state => state.housingIntent)
  const filtersOpen=useGeoDomStore(state => state.filtersOpen)
  const workPicking=useGeoDomStore(state => state.workPicking)
  const setPreferences=useGeoDomStore(state => state.setPreferences)
  const setFilter=useGeoDomStore(state => state.setFilter)
  const setHousingIntent=useGeoDomStore(state => state.setHousingIntent)
  const resetFilters=useGeoDomStore(state => state.resetFilters)
  const resetPreferencesState=useGeoDomStore(state => state.resetPreferences)
  const setFiltersOpen=useGeoDomStore(state => state.setFiltersOpen)
  const setWorkPicking=useGeoDomStore(state => state.setWorkPicking)
  const setWorkLocation=useGeoDomStore(state => state.setWorkLocation)

  const [response,setResponse]=useState<RecommendationResponse|null>(loadLastRecommendation)
  const [recommendationLoading,setRecommendationLoading]=useState(false)
  const [recommendationError,setRecommendationError]=useState('')
  const [validationError,setValidationError]=useState('')
  const [savedSearchMessage,setSavedSearchMessage]=useState('')
  const recommendationAbort=useRef<AbortController|null>(null)

  useEffect(() => {
    const district=params.get('district')
    const query=params.get('q')
    const rooms=Number(params.get('rooms') || 0)
    const maxPrice=Number(params.get('max_price') || 0)
    if (district !== null) setFilter('district',district)
    if (query !== null) setFilter('query',query)
    if (Number.isFinite(rooms) && rooms >= 0) setFilter('rooms',rooms)
    if (Number.isFinite(maxPrice) && maxPrice >= 0) setFilter('maxPrice',maxPrice)
  },[])

  useEffect(() => {
    const controller=new AbortController()
    Promise.all([
      api.districts(controller.signal),
      api.districtAnalysis(controller.signal)
    ]).then(([directory,analysis]) => {
      if (controller.signal.aborted) return
      setDistrictDirectory(directory)
      setDistrictAnalysis(analysis)
    }).catch(err => {
      if (!controller.signal.aborted) setDistrictError(err instanceof Error ? err.message : 'Не удалось загрузить данные районов')
    })
    return () => controller.abort()
  },[])

  const selectedDistrictId=useMemo(
    () => districtDirectory.find(item => item.name === filters.district)?.id,
    [districtDirectory,filters.district]
  )

  const serverFilterKey=`${filters.maxPrice}:${filters.rooms}:${selectedDistrictId || ''}`
  useEffect(() => {
    const controller=new AbortController()
    setLoading(true)
    setError('')
    api.apartmentsPage({
      limit:CATALOG_PAGE_SIZE,
      offset:0,
      maxPrice:filters.maxPrice || undefined,
      rooms:filters.rooms > 0 && filters.rooms < 4 ? filters.rooms : undefined,
      districtId:selectedDistrictId,
      signal:controller.signal
    }).then(page => {
      if (controller.signal.aborted) return
      setItems(page.items)
      setHasMore(page.hasMore)
    }).catch(err => {
      if (!controller.signal.aborted) {
        setItems([])
        setHasMore(false)
        setError(err instanceof Error ? err.message : 'Не удалось загрузить каталог')
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  },[serverFilterKey])

  useEffect(() => {
    const next=new URLSearchParams()
    if (filters.district) next.set('district',filters.district)
    if (filters.query) next.set('q',filters.query)
    if (filters.rooms) next.set('rooms',String(filters.rooms))
    if (filters.maxPrice) next.set('max_price',String(filters.maxPrice))
    setParams(next,{replace:true})
  },[filters.district,filters.query,filters.rooms,filters.maxPrice])

  async function loadMore() {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    setError('')
    try {
      const page=await api.apartmentsPage({
        limit:CATALOG_PAGE_SIZE,
        offset:items.length,
        maxPrice:filters.maxPrice || undefined,
        rooms:filters.rooms > 0 && filters.rooms < 4 ? filters.rooms : undefined,
        districtId:selectedDistrictId
      })
      setItems(current => {
        const known=new Set(current.map(item => item.id))
        return [...current,...page.items.filter(item => !known.has(item.id))]
      })
      setHasMore(page.hasMore)
    } catch(err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить следующую страницу')
    } finally {
      setLoadingMore(false)
    }
  }

  const districts=(districtDirectory.length ? districtDirectory.map(item => item.name) : KRASNOYARSK_DISTRICTS.map(item => item.name)).sort()
  const buildingTypes=useMemo(() => [...new Set(items.map(item => item.building_type).filter((value):value is string => !!value))].sort(),[items])
  const visible=useMemo(() => filterApartments(items,filters),[items,filters])
  const promotedIds=useMemo(() => new Set(loadPromotedIds()),[])
  const promotedApartments=useMemo(() => visible.filter(item => promotedIds.has(item.id)).slice(0,3),[visible,promotedIds])
  const visibleIds=useMemo(() => new Set(visible.map(item => String(item.id))),[visible])
  const personalScores=useMemo(() => new Map(
    (response?.items ?? []).flatMap(item => typeof item.score === 'number' && Number.isFinite(item.score) ? [[String(item.apartment_id),item.score] as const] : [])
  ),[response])

  const topRecommendation=response?.items.find(item => typeof item.price === 'number' && item.price > 0) ?? null

  function change<K extends keyof CatalogFilters>(key:K,value:CatalogFilters[K]) {
    setFilter(key,value)
  }

  function reset() {
    resetFilters()
    setParams({})
  }

  function search(event:React.FormEvent) {
    event.preventDefault()
    document.getElementById('catalog')?.scrollIntoView({behavior:'smooth',block:'start'})
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
    requestAnimationFrame(() => document.getElementById('main-map')?.scrollIntoView({behavior:'smooth',block:'center'}))
  }

  async function recommend(value:RecommendationRequest) {
    recommendationAbort.current?.abort()
    const controller=new AbortController()
    recommendationAbort.current=controller
    setRecommendationLoading(true)
    setRecommendationError('')
    try {
      const result=await api.recommend(value,controller.signal)
      if (controller.signal.aborted) return
      setResponse(result)

      const existing=new Set(items.map(item => item.id))
      const missing=result.items.slice(0,10).filter(item => !existing.has(String(item.apartment_id)))
      if (missing.length) {
        const details=await Promise.all(missing.map(async item => {
          try { return await api.detail(String(item.apartment_id)) }
          catch { return null }
        }))
        if (!controller.signal.aborted) {
          setItems(current => {
            const known=new Set(current.map(item => item.id))
            return [...details.filter((item):item is Apartment => !!item && !known.has(item.id)),...current]
          })
        }
      }
    } catch(err) {
      if (controller.signal.aborted) return
      setRecommendationError(err instanceof Error ? err.message : 'Сервер рекомендаций недоступен')
    } finally {
      if (!controller.signal.aborted) setRecommendationLoading(false)
    }
  }

  async function apply() {
    if (housingIntent === 'rent') {
      setValidationError('Live backend Case 2 пока не отдаёт арендный каталог. GeoDom не подменяет его квартирами на продажу — выберите «Купить» для персональной рекомендации.')
      return false
    }
    const invalid=validatePreferences(preferences)
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
    setResponse(null)
    setRecommendationError('')
  }

  function saveCurrentSearch() {
    const parts=[
      filters.district || 'Красноярск',
      filters.rooms ? (filters.rooms >= 4 ? '4+ комн.' : `${filters.rooms} комн.`) : '',
      filters.maxPrice ? `до ${Math.round(filters.maxPrice/1_000_000*10)/10} млн` : ''
    ].filter(Boolean)
    createSavedSearch({label:parts.join(' · '),preferences,filters,items})
    setSavedSearchMessage(`Поиск сохранён. В загруженной выборке ему соответствуют ${visible.length} квартир.`)
    window.setTimeout(() => setSavedSearchMessage(''),3200)
  }

  const activeCount=Number(!!filters.district)+Number(!!filters.maxPrice)+Number(!!filters.rooms)+Number(!!filters.minArea)+Number(!!filters.yearFrom)+Number(!!filters.buildingType)+Number(filters.onlyWithPhotos)
  const filterChips=[
    filters.district ? {key:'district',label:`Район: ${filters.district}`,clear:() => change('district','')} : null,
    filters.maxPrice ? {key:'maxPrice',label:`До ${new Intl.NumberFormat('ru-RU').format(filters.maxPrice)} ₽`,clear:() => change('maxPrice',0)} : null,
    filters.rooms ? {key:'rooms',label:filters.rooms >= 4 ? '4+ комнаты' : `${filters.rooms} комн.`,clear:() => change('rooms',0)} : null,
    filters.minArea ? {key:'minArea',label:`От ${filters.minArea} м²`,clear:() => change('minArea',0)} : null,
    filters.yearFrom ? {key:'yearFrom',label:`Дом от ${filters.yearFrom}`,clear:() => change('yearFrom',0)} : null,
    filters.buildingType ? {key:'buildingType',label:filters.buildingType,clear:() => change('buildingType','')} : null,
    filters.onlyWithPhotos ? {key:'onlyWithPhotos',label:'Только с фото',clear:() => change('onlyWithPhotos',false)} : null
  ].filter((chip):chip is {key:string;label:string;clear:()=>void} => chip !== null)

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
        intent={housingIntent}
        onIntent={setHousingIntent}
      />

      <div className="dashboard-main">
        <Reveal className="dashboard-intro">
          <div>
            <span className="dashboard-kicker">GEODOM · CASE 2 · ИНТЕРФЕЙС ПРИНЯТИЯ РЕШЕНИЯ</span>
            <h1>Выберите жильё <em>с пониманием района</em></h1>
            <p>Бюджет, семья, работа и приоритеты формируют один запрос к backend. Итоговый score и объяснения приходят с сервера.</p>
          </div>
          <div className="intro-badge"><span className="intro-badge-icon"><Building2 size={22}/></span><div><b>{KRASNOYARSK_DISTRICTS.length} районов</b><small>{isDemo ? 'явный demo mode' : 'live backend'}</small></div><ArrowUpRight size={16}/></div>
          <Suspense fallback={null}><CitySignal/></Suspense>
        </Reveal>

        <form className="dashboard-search" onSubmit={search}>
          <Search size={19}/>
          <input aria-label="Поиск по району или адресу" value={filters.query} onChange={event => change('query',event.target.value)} placeholder="Поиск по району, улице или адресу…"/>
          <button type="submit">Найти <ArrowRight size={16}/></button>
        </form>

        {filterChips.length > 0 && <div className="active-filter-chips" aria-label="Активные фильтры">
          {filterChips.map(chip => <button type="button" key={chip.key} onClick={chip.clear}>{chip.label}<span aria-hidden="true">×</span></button>)}
          <button type="button" className="clear-all" onClick={reset}>Сбросить всё</button>
        </div>}

        <Reveal delay={.08}>
          <div className="map-panel" id="main-map">
            <div className="map-topbar">
              <div><span className="map-tab active"><MapPin size={16}/> Яндекс Карта</span><span className="map-tab secondary">viewport POI · отдельные слои</span></div>
              <div className="map-topbar-note"><span className="pulse-dot"/> {workPicking ? 'Выберите место работы' : `${visible.length} загруженных квартир подходят фильтрам`}</div>
            </div>
            {savedSearchMessage && <div className="saved-search-toast"><BellRing size={14}/>{savedSearchMessage}</div>}
            {loading && !items.length
              ? <CatalogSkeleton/>
              : error && !items.length
                ? <EmptyState title="Карта недоступна" message={error}/>
                : <MapPanel
                    items={items}
                    activeApartmentIds={visibleIds}
                    scoreByApartment={personalScores}
                    districtAnalysis={districtAnalysis}
                    selectedDistrict={filters.district}
                    onDistrict={setDistrict}
                    workLocation={preferences.work_location}
                    workPicking={workPicking}
                    onWorkLocation={location => setWorkLocation(location)}
                  />}
            <div className="map-caption"><CircleHelp size={15}/> POI запрашиваются только по текущему bbox с debounce и отменой устаревших запросов. Квартиры, POI, районы и будущая инфраструктура — отдельные слои. <span>Картография © Яндекс</span></div>
          </div>
        </Reveal>

        <Reveal delay={.04}>
          <RecommendationResults response={response} loading={recommendationLoading} error={recommendationError} onRetry={() => void recommend(preferences)}/>
        </Reveal>

        <Reveal>
          <div className="dashboard-section-title">
            <div><h2>Анализ <span>районов</span></h2><p>Backend-owned district data. Отсутствующие score не превращаются в нули.</p></div>
            <Link className="districts-all-link" to="/districts">Все 7 районов <ArrowRight size={14}/></Link>
          </div>
          {districtError && <WarningBanner title="Анализ районов недоступен" warnings={[districtError]}/>}
          <DistrictAnalysisCards items={districtAnalysis} selectedDistrict={filters.district} onSelect={pickDistrict}/>
        </Reveal>

        <Reveal><ResidentialComplexComparison/></Reveal>

        {topRecommendation && housingIntent === 'buy' && <Reveal>
          <section className="dashboard-finance-section">
            <div className="dashboard-section-title"><div><h2>Финансовый <span>сценарий</span></h2><p>Расчёт для первого варианта из текущей персональной выдачи: {topRecommendation.title}.</p></div></div>
            <Suspense fallback={<CatalogSkeleton/>}>
              <div className="finance-tools dashboard-finance-tools">
                <MortgageCalculator apartmentPrice={topRecommendation.price} defaultDownPayment={preferences.down_payment}/>
                <RentVsBuyCalculator apartmentPrice={topRecommendation.price} defaultDownPayment={preferences.down_payment}/>
              </div>
            </Suspense>
          </section>
        </Reveal>}

        <Reveal>
          {promotedApartments.length > 0 && <section className="sponsored-section" aria-label="Продвигаемые объявления">
            <div className="sponsored-heading"><div><span>ПЛАТНОЕ ПРОДВИЖЕНИЕ</span><h2>Продвигаемые объявления</h2></div><small>Позиция здесь не меняет персональный score</small></div>
            <div className="card-grid">{promotedApartments.map((item,index) => <ApartmentCard item={item} index={index} promoted key={item.id}/>)}</div>
          </section>}

          <section className="listings-section" id="catalog">
            <div className="dashboard-section-title listings-title">
              <div><h2>Каталог <span>квартир</span></h2><p>{loading ? 'Загружаем страницу…' : `${visible.length} подходят среди ${items.length} загруженных${hasMore ? ' · есть ещё' : ''}`}</p></div>
              <div className="listings-actions">
                {user ? <button type="button" className="save-search-button" onClick={saveCurrentSearch}><BellRing size={15}/> Сохранить поиск</button> : <Link className="save-search-button" to="/login?next=/"><BellRing size={15}/> Сохранить поиск</Link>}
                <button type="button" className="mobile-filter-button" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={17}/> Параметры {activeCount > 0 && <b>{activeCount}</b>}</button>
                <label htmlFor="sort">Сортировка</label>
                <div className="select-wrap"><select id="sort" value={filters.sort} onChange={event => change('sort',event.target.value as CatalogSort)}><option value="recommended">По оценке</option><option value="price_asc">Цена ↑</option><option value="price_desc">Цена ↓</option><option value="area_desc">Площадь ↓</option></select><ChevronDown size={15}/></div>
              </div>
            </div>

            {loading && !items.length
              ? <CatalogSkeleton/>
              : error && !items.length
                ? <EmptyState title="Не удалось загрузить квартиры" message={error} action={<button className="button dark" onClick={() => window.location.reload()}>Повторить</button>}/>
                : visible.length
                  ? <div className="card-grid">{visible.map((item,index) => <ApartmentCard item={item} index={index} key={item.id}/>)}</div>
                  : <EmptyState title="В загруженной странице ничего не нашлось" message={hasMore ? 'Загрузите следующую страницу или измените фильтры.' : 'Попробуйте расширить параметры.'} action={<button className="button dark" onClick={reset}>Сбросить фильтры</button>}/>}

            {error && items.length > 0 && <WarningBanner title="Следующая страница не загрузилась" warnings={[error]}/>}
            {hasMore && <div className="catalog-load-more"><button type="button" className="button light" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Загружаем…' : 'Загрузить ещё'}</button><span>{items.length} загружено</span></div>}
          </section>
        </Reveal>

        <div className="dashboard-end"><span><Sparkles size={18}/> GeoDom объясняет решение, а не просто показывает объявления</span><Link to="/report">Собрать итоговый отчёт <ArrowRight size={17}/></Link></div>
      </div>
    </div>
  </div>
}
