import { useEffect, useMemo, useRef, useState } from 'react'
import type { Apartment } from '../types'
import { price } from '../lib/catalog'
import { validCoordinate, type GeoObject } from '../lib/dataSanitizers'
import { loadYandexMaps } from '../lib/yandexMaps'

type WorkLocation = { lat:number; lon:number } | null
type PoiLayer = 'education' | 'parks' | 'healthcare' | 'transport' | 'daily'
const DISTRICT_CARD_MAX_ZOOM = 11
const APARTMENT_PRICE_MIN_ZOOM = 12

const layerMeta: Array<{ key:PoiLayer; label:string; preset:string }> = [
  { key:'education',label:'Школы и детсады',preset:'islands#blueIcon' },
  { key:'parks',label:'Парки и зелень',preset:'islands#greenIcon' },
  { key:'healthcare',label:'Медицина',preset:'islands#redIcon' },
  { key:'transport',label:'Транспорт',preset:'islands#violetIcon' },
  { key:'daily',label:'Магазины и сервисы',preset:'islands#orangeIcon' }
]

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char] || char))
}

function safeHttpUrl(value: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function score10(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null
  return value > 10 ? value / 10 : value
}

function classifyGeoObject(item: GeoObject): PoiLayer | null {
  const value = `${item.category} ${item.subcategory || ''}`.toLowerCase()
  if (/(school|kindergarten|college|university|education|школ|сад|образован)/.test(value)) return 'education'
  if (/(park|garden|green|forest|recreation|парк|сквер|зел)/.test(value)) return 'parks'
  if (/(health|hospital|clinic|pharmacy|doctor|мед|больниц|поликлин|аптек)/.test(value)) return 'healthcare'
  if (/(transport|bus|tram|rail|station|stop|metro|транспорт|останов|вокзал)/.test(value)) return 'transport'
  if (/(shop|supermarket|market|cafe|restaurant|sport|fitness|amenity|магаз|кафе|ресторан|спорт)/.test(value)) return 'daily'
  return null
}

export function MapPanel({
  items,
  geoObjects,
  selectedDistrict,
  onDistrict,
  workLocation,
  workPicking,
  onWorkLocation,
  activeApartmentIds,
  scoreByApartment
}:{
  items:Apartment[]
  geoObjects:GeoObject[]
  selectedDistrict:string
  onDistrict:(district:string)=>void
  workLocation:WorkLocation
  workPicking:boolean
  onWorkLocation:(location:{ lat:number; lon:number })=>void
  activeApartmentIds?:Set<string>
  scoreByApartment?:Map<string,number>
}) {
  const element = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const ymapsRef = useRef<any>(null)
  const districtHandler = useRef(onDistrict)
  const workHandler = useRef(onWorkLocation)
  const pickingRef = useRef(workPicking)
  const resizeObserver = useRef<ResizeObserver | null>(null)
  const fittedSignature = useRef('')
  const [ready,setReady] = useState(false)
  const [zoom,setZoom] = useState(11)
  const [loadError,setLoadError] = useState('')
  const [layers,setLayers] = useState<Record<PoiLayer,boolean>>({
    education:true,
    parks:true,
    healthcare:true,
    transport:true,
    daily:false
  })

  districtHandler.current = onDistrict
  workHandler.current = onWorkLocation
  pickingRef.current = workPicking

  const layerCounts = useMemo(() => {
    const counts: Record<PoiLayer,number> = { education:0,parks:0,healthcare:0,transport:0,daily:0 }
    for (const item of geoObjects) {
      const layer = classifyGeoObject(item)
      if (layer) counts[layer] += 1
    }
    return counts
  },[geoObjects])

  const validApartmentCount = useMemo(
    () => items.filter(item => item.status === 'published' && validCoordinate(item.latitude,item.longitude)).length,
    [items]
  )

  useEffect(() => {
    let cancelled = false
    if (!element.current || map.current) return

    loadYandexMaps().then(ymaps => {
      if (cancelled || !element.current) return
      const instance = new ymaps.Map(element.current, {
        center:[56.014,92.87],
        zoom:11,
        controls:['zoomControl','fullscreenControl']
      }, {
        minZoom:7,
        maxZoom:19,
        suppressMapOpenBlock:true
      })

      instance.behaviors.enable(['drag','scrollZoom','dblClickZoom','multiTouch'])
      instance.events.add('boundschange', (event:any) => {
        const next = event.get('newZoom')
        setZoom(typeof next === 'number' ? next : instance.getZoom())
      })
      instance.events.add('click', (event:any) => {
        if (!pickingRef.current) return
        const coords = event.get('coords')
        const point = validCoordinate(coords?.[0],coords?.[1])
        if (point) workHandler.current(point)
      })

      ymapsRef.current = ymaps
      map.current = instance
      resizeObserver.current = new ResizeObserver(() => instance.container.fitToViewport())
      resizeObserver.current.observe(element.current)
      setReady(true)
    }).catch(error => {
      if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Не удалось загрузить карту')
    })

    return () => {
      cancelled = true
      resizeObserver.current?.disconnect()
      resizeObserver.current = null
      map.current?.destroy()
      map.current = null
      ymapsRef.current = null
    }
  },[])

  useEffect(() => {
    const instance = map.current
    const ymaps = ymapsRef.current
    if (!ready || !instance || !ymaps) return

    instance.geoObjects.removeAll()
    const valid = items.filter(item => item.status === 'published' && validCoordinate(item.latitude,item.longitude))
    const groups = new Map<string,Apartment[]>()
    const signature = valid.map(item => `${item.id}:${item.latitude}:${item.longitude}`).sort().join('|')

    if (signature && signature !== fittedSignature.current && !workPicking) {
      const points = valid
        .map(item => validCoordinate(item.latitude,item.longitude))
        .filter((point):point is { lat:number; lon:number } => point !== null)

      if (points.length > 1) {
        const latitudes = points.map(point => point.lat)
        const longitudes = points.map(point => point.lon)
        const bounds = [
          [Math.min(...latitudes),Math.min(...longitudes)],
          [Math.max(...latitudes),Math.max(...longitudes)]
        ]
        instance.setBounds(bounds,{ checkZoomRange:true,zoomMargin:[48,48] })
      } else if (points.length === 1) instance.setCenter([points[0].lat,points[0].lon],13)
      fittedSignature.current = signature
    }

    for (const item of valid) {
      const point = validCoordinate(item.latitude,item.longitude)
      if (!point) continue
      groups.set(item.district.name,[...(groups.get(item.district.name) || []),item])

      const activeByFilter = !activeApartmentIds || activeApartmentIds.has(String(item.id))
      const activeByDistrict = !selectedDistrict || selectedDistrict === item.district.name
      const active = activeByFilter && activeByDistrict
      const compactApartment = zoom < APARTMENT_PRICE_MIN_ZOOM
      const amount = new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(item.price/1000000)
      const personalScore = scoreByApartment?.get(String(item.id))
      const displayedScore = typeof personalScore === 'number' && Number.isFinite(personalScore)
        ? personalScore
        : score10(item.recommendation.score)
      const layout = ymaps.templateLayoutFactory.createClass(
        compactApartment
          ? `<div class="yandex-apartment-dot ${active ? '' : 'muted'}"></div>`
          : `<div class="yandex-price-pin ${active ? '' : 'muted'}"><span>${amount} млн ₽</span></div>`
      )
      const placemark = new ymaps.Placemark(
        [point.lat,point.lon],
        {
          balloonContentHeader:escapeHtml(item.title),
          balloonContentBody:`<strong>${escapeHtml(price(item.price))}</strong>${displayedScore === null ? '' : `<br><b>Персональная оценка: ${displayedScore.toFixed(1)} / 10</b>`}<br><span>${escapeHtml(item.address)}</span><br><a href="/apartments/${encodeURIComponent(item.id)}">Открыть квартиру →</a>`
        },
        compactApartment
          ? {
              iconLayout:layout,
              iconShape:{ type:'Circle',coordinates:[0,0],radius:6 },
              interactiveZIndex:false,
              zIndex:480,
              zIndexHover:480,
              zIndexActive:500
            }
          : {
              iconLayout:layout,
              iconShape:{ type:'Rectangle',coordinates:[[-54,-36],[54,2]] },
              interactiveZIndex:false,
              zIndex:900,
              zIndexHover:900,
              zIndexActive:920
            }
      )
      instance.geoObjects.add(placemark)
    }

    const compactDistricts = zoom > DISTRICT_CARD_MAX_ZOOM
    for (const [district,houses] of groups) {
      const points = houses
        .map(home => validCoordinate(home.latitude,home.longitude))
        .filter((point):point is { lat:number; lon:number } => point !== null)
      if (!points.length) continue

      const lat = points.reduce((sum,point) => sum+point.lat,0)/points.length
      const lon = points.reduce((sum,point) => sum+point.lon,0)/points.length
      const scores = houses.map(home => {
        const personal = scoreByApartment?.get(String(home.id))
        return typeof personal === 'number' && Number.isFinite(personal) ? personal : score10(home.recommendation.score)
      }).filter((value):value is number => value !== null)
      const average = scores.length ? scores.reduce((sum,value) => sum+value,0)/scores.length : null
      const active = selectedDistrict === district
      const html = compactDistricts
        ? `<div class="yandex-district-dot ${active ? 'active' : ''}" title="${escapeHtml(district)}"></div>`
        : `<div class="yandex-district-pin ${active ? 'active' : ''}"><span>${escapeHtml(district)}</span><div>${average === null ? '<b>—</b>' : `<b>${average.toFixed(1)}</b>`}<em>/10</em></div><small>${houses.length} ${houses.length === 1 ? 'квартира' : houses.length < 5 ? 'квартиры' : 'квартир'}</small></div>`

      const layout = ymaps.templateLayoutFactory.createClass(html)
      const placemark = new ymaps.Placemark(
        [lat,lon],
        { hintContent:escapeHtml(district) },
        {
          iconLayout:layout,
          iconShape:compactDistricts
            ? { type:'Circle',coordinates:[0,0],radius:11 }
            : { type:'Rectangle',coordinates:[[-62,-62],[62,0]] },
          interactiveZIndex:false,
          zIndex:compactDistricts ? 620 : 1050,
          zIndexHover:compactDistricts ? 620 : 1050,
          zIndexActive:compactDistricts ? 640 : 1070
        }
      )
      placemark.events.add('click', () => {
        districtHandler.current(district)
        if (!compactDistricts) instance.setCenter([lat,lon],13,{ checkZoomRange:true,duration:260 })
      })
      instance.geoObjects.add(placemark)
    }

    const poiMarks:any[] = []
    for (const item of geoObjects) {
      const layer = classifyGeoObject(item)
      if (!layer || !layers[layer]) continue
      const meta = layerMeta.find(candidate => candidate.key === layer)
      if (!meta) continue
      const sourceUrl = safeHttpUrl(item.sourceUrl)
      const body = [
        item.address ? `<span>${escapeHtml(item.address)}</span>` : '',
        item.source ? `<small>Источник: ${escapeHtml(item.source)}</small>` : '',
        item.sourceUpdatedAt ? `<small>Обновлено у источника: ${escapeHtml(item.sourceUpdatedAt)}</small>` : '',
        item.collectedAt ? `<small>Собрано GeoDom: ${escapeHtml(item.collectedAt)}</small>` : '',
        sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">Открыть источник →</a>` : ''
      ].filter(Boolean).join('<br>')

      poiMarks.push(new ymaps.Placemark(
        [item.lat,item.lon],
        {
          hintContent:escapeHtml(item.name),
          balloonContentHeader:escapeHtml(item.name),
          balloonContentBody:body || 'Данные об объекте инфраструктуры'
        },
        {
          preset:meta.preset,
          zIndex:220
        }
      ))
    }

    if (poiMarks.length) {
      const clusterer = new ymaps.Clusterer({
        groupByCoordinates:false,
        clusterDisableClickZoom:false,
        clusterHideIconOnBalloonOpen:false,
        geoObjectHideIconOnBalloonOpen:false
      })
      clusterer.add(poiMarks)
      instance.geoObjects.add(clusterer)
    }

    if (workLocation) {
      const point = validCoordinate(workLocation.lat,workLocation.lon)
      if (point) {
        const workPlacemark = new ymaps.Placemark(
          [point.lat,point.lon],
          { iconCaption:'Работа',hintContent:'Место работы',balloonContent:'Выбранное место работы' },
          { preset:'islands#redIcon',draggable:true,zIndex:1500 }
        )
        workPlacemark.events.add('dragend', () => {
          const coords = workPlacemark.geometry.getCoordinates()
          const next = validCoordinate(coords?.[0],coords?.[1])
          if (next) workHandler.current(next)
        })
        instance.geoObjects.add(workPlacemark)
      }
    }
  },[items,geoObjects,selectedDistrict,workLocation,workPicking,ready,zoom,activeApartmentIds,scoreByApartment,layers])

  return <div className={`map-wrapper yandex-map-wrapper ${workPicking ? 'work-picking' : ''}`}>
    <div ref={element} className="map-canvas" aria-label="Яндекс Карта квартир Красноярска"/>
    {loadError && <div className="map-load-error"><b>Яндекс Карта недоступна</b><span>{loadError}</span><small>Проверьте VITE_YANDEX_MAPS_API_KEY и доступ к api-maps.yandex.ru.</small></div>}
    {workPicking && <div className="work-pick-hint">Нажмите на карте в точке, где находится работа</div>}

    <div className="map-layer-panel" aria-label="Слои инфраструктуры">
      <div className="map-layer-title"><b>Слои на карте</b><small>{validApartmentCount} квартир · {geoObjects.length} POI</small></div>
      <div className="map-lod-status">{zoom <= DISTRICT_CARD_MAX_ZOOM ? 'Обзор районов · приблизьте для цен квартир' : 'Цены квартир · районы показаны точками'}</div>
      {layerMeta.map(layer => <button
        type="button"
        key={layer.key}
        className={layers[layer.key] ? 'active' : ''}
        onClick={() => setLayers(current => ({ ...current,[layer.key]:!current[layer.key] }))}
        aria-pressed={layers[layer.key]}
      >
        <i className={`poi-dot ${layer.key}`}/>
        <span>{layer.label}</span>
        <small>{layerCounts[layer.key]}</small>
      </button>)}
      {items.length !== validApartmentCount && <div className="map-data-warning">{items.length-validApartmentCount} квартир без валидных координат скрыто</div>}
    </div>

    <div className="map-legend">
      <span><i className="legend-dot blue"/> Квартиры</span>
      <span><i className="legend-dot green"/> Районы</span>
      <span><i className="legend-dot red"/> Работа</span>
    </div>
  </div>
}
