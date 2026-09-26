import { useEffect, useRef, useState } from 'react'
import type { Apartment } from '../types'
import { price } from '../lib/catalog'
import { validCoordinate } from '../lib/dataSanitizers'
import { loadYandexMaps } from '../lib/yandexMaps'

type WorkLocation = { lat:number; lon:number } | null

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char] || char))
}

function score10(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null
  return value > 10 ? value / 10 : value
}

export function MapPanel({
  items,
  selectedDistrict,
  onDistrict,
  workLocation,
  workPicking,
  onWorkLocation,
  activeApartmentIds
}:{
  items:Apartment[]
  selectedDistrict:string
  onDistrict:(district:string)=>void
  workLocation:WorkLocation
  workPicking:boolean
  onWorkLocation:(location:{ lat:number; lon:number })=>void
  activeApartmentIds?:Set<string>
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

  districtHandler.current = onDistrict
  workHandler.current = onWorkLocation
  pickingRef.current = workPicking

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
      const bounds = valid
        .map(item => validCoordinate(item.latitude,item.longitude))
        .filter((point):point is { lat:number; lon:number } => point !== null)
        .map(point => [point.lat,point.lon])
      if (bounds.length > 1) instance.setBounds(bounds,{ checkZoomRange:true,zoomMargin:[48,48] })
      else if (bounds.length === 1) instance.setCenter(bounds[0],13)
      fittedSignature.current = signature
    }

    for (const item of valid) {
      const point = validCoordinate(item.latitude,item.longitude)
      if (!point) continue
      groups.set(item.district.name,[...(groups.get(item.district.name) || []),item])

      const activeByFilter = !activeApartmentIds || activeApartmentIds.has(String(item.id))
      const activeByDistrict = !selectedDistrict || selectedDistrict === item.district.name
      const active = activeByFilter && activeByDistrict
      const amount = new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(item.price/1000000)
      const layout = ymaps.templateLayoutFactory.createClass(
        `<div class="yandex-price-pin ${active ? '' : 'muted'}">${amount} млн ₽</div>`
      )
      const placemark = new ymaps.Placemark(
        [point.lat,point.lon],
        {
          hintContent:escapeHtml(item.title),
          balloonContentHeader:escapeHtml(item.title),
          balloonContentBody:`<strong>${escapeHtml(price(item.price))}</strong><br><a href="/apartments/${encodeURIComponent(item.id)}">Открыть квартиру →</a>`
        },
        {
          iconLayout:layout,
          iconShape:{ type:'Rectangle', coordinates:[[-52,-34],[52,0]] },
          zIndex:500
        }
      )
      instance.geoObjects.add(placemark)
    }

    const compactDistricts = zoom >= 13
    for (const [district,houses] of groups) {
      const points = houses.map(home => validCoordinate(home.latitude,home.longitude)).filter((point):point is { lat:number; lon:number } => point !== null)
      if (!points.length) continue
      const lat = points.reduce((sum,point) => sum+point.lat,0)/points.length
      const lon = points.reduce((sum,point) => sum+point.lon,0)/points.length
      const scores = houses.map(home => score10(home.recommendation.score)).filter((value):value is number => value !== null)
      const average = scores.length ? scores.reduce((sum,value) => sum+value,0)/scores.length : null
      const active = selectedDistrict === district

      const html = compactDistricts
        ? `<div class="yandex-district-dot ${active ? 'active' : ''}" title="${escapeHtml(district)}"></div>`
        : `<div class="yandex-district-pin ${active ? 'active' : ''}"><span>${escapeHtml(district)}</span>${average === null ? '' : `<b>${average.toFixed(1)}</b>`}</div>`
      const layout = ymaps.templateLayoutFactory.createClass(html)
      const placemark = new ymaps.Placemark(
        [lat,lon],
        { hintContent:escapeHtml(district) },
        {
          iconLayout:layout,
          iconShape:compactDistricts
            ? { type:'Circle', coordinates:[0,0], radius:11 }
            : { type:'Rectangle', coordinates:[[-62,-62],[62,0]] },
          zIndex:1000
        }
      )
      placemark.events.add('click', () => districtHandler.current(district))
      instance.geoObjects.add(placemark)
    }

    if (workLocation) {
      const point = validCoordinate(workLocation.lat,workLocation.lon)
      if (point) {
        const workPlacemark = new ymaps.Placemark(
          [point.lat,point.lon],
          { iconCaption:'Работа', hintContent:'Место работы', balloonContent:'Выбранное место работы' },
          { preset:'islands#redIcon', draggable:true, zIndex:1500 }
        )
        workPlacemark.events.add('dragend', () => {
          const coords = workPlacemark.geometry.getCoordinates()
          const next = validCoordinate(coords?.[0],coords?.[1])
          if (next) workHandler.current(next)
        })
        instance.geoObjects.add(workPlacemark)
      }
    }
  },[items,selectedDistrict,workLocation,workPicking,ready,zoom,activeApartmentIds])

  return <div className={`map-wrapper yandex-map-wrapper ${workPicking ? 'work-picking' : ''}`}>
    <div ref={element} className="map-canvas" aria-label="Яндекс Карта квартир Красноярска"/>
    {loadError && <div className="map-load-error"><b>Яндекс Карта недоступна</b><span>{loadError}</span><small>Проверьте VITE_YANDEX_MAPS_API_KEY и доступ к api-maps.yandex.ru.</small></div>}
    {workPicking && <div className="work-pick-hint">Нажмите на карте в точке, где находится работа</div>}
    <div className="map-legend"><span><i className="legend-dot blue"/> Квартиры</span><span><i className="legend-dot green"/> Районы</span><span><i className="legend-dot red"/> Работа</span></div>
  </div>
}
