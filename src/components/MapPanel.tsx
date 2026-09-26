import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Apartment } from '../types'
import { price } from '../lib/catalog'
export function MapPanel({ items, selectedDistrict, onDistrict }: { items: Apartment[]; selectedDistrict: string; onDistrict: (district: string) => void }) {
  const element = useRef<HTMLDivElement>(null); const map = useRef<L.Map | null>(null); const markers = useRef<L.LayerGroup | null>(null)
  const handler = useRef(onDistrict); handler.current = onDistrict
  useEffect(() => {
    if (!element.current || map.current) return
    const instance = L.map(element.current, { zoomControl: false, scrollWheelZoom: false }).setView([56.014,92.87], 11)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'&copy; OpenStreetMap contributors', maxZoom:19 }).addTo(instance)
    L.control.zoom({ position:'bottomright' }).addTo(instance)
    map.current = instance; markers.current = L.layerGroup().addTo(instance)
    const observer = new ResizeObserver(() => instance.invalidateSize()); observer.observe(element.current)
    return () => { observer.disconnect(); instance.remove(); map.current = null; markers.current = null }
  },[])
  useEffect(() => {
    if (!markers.current || !map.current) return
    markers.current.clearLayers()
    const valid = items.filter(x => x.latitude && x.longitude && x.status === 'published')
    for (const item of valid) {
      const active = !selectedDistrict || selectedDistrict === item.district.name
      const icon = L.divIcon({ className:'map-pin-container', html:`<span class="map-price-pin ${active ? '' : 'muted'}">${new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(item.price/1000000)} млн ₽</span>`, iconSize:[100,34], iconAnchor:[50,34] })
      const popup=document.createElement('div')
      const title=document.createElement('strong'); title.textContent=item.title
      const amount=document.createElement('div'); amount.textContent=price(item.price)
      const link=document.createElement('a'); link.href=`/apartments/${encodeURIComponent(item.id)}`; link.textContent='Открыть квартиру →'
      popup.append(title,amount,link)
      L.marker([item.latitude,item.longitude], { icon }).bindPopup(popup).addTo(markers.current!)
    }
    const groups = new Map<string,Apartment[]>()
    for (const item of valid) groups.set(item.district.name,[...(groups.get(item.district.name) || []),item])
    for (const [district,houses] of groups) {
      const lat = houses.reduce((sum,x) => sum+x.latitude,0)/houses.length
      const lng = houses.reduce((sum,x) => sum+x.longitude,0)/houses.length
      const avg = Math.round(houses.reduce((sum,x) => sum+(x.recommendation.score || 0),0)/houses.length)
      const pin=document.createElement('span'); pin.className=`district-map-pin ${selectedDistrict === district ? 'active' : ''}`
      pin.append(document.createTextNode(district))
      const score=document.createElement('b'); score.textContent=(avg/10).toFixed(1); pin.append(score)
      const icon = L.divIcon({ className:'district-pin-container', html:pin, iconSize:[120,58], iconAnchor:[60,90] })
      L.marker([lat,lng],{ icon,zIndexOffset:1000 }).on('click',() => handler.current(district)).addTo(markers.current!)
    }
  },[items,selectedDistrict])
  return <div className="map-wrapper"><div ref={element} className="map-canvas" aria-label="Карта квартир Красноярска"/><div className="map-legend"><span><i className="legend-dot blue"/> Квартиры</span><span><i className="legend-dot green"/> Районы</span></div></div>
}
