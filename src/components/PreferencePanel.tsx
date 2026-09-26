import { ArrowRight, RotateCcw, X } from 'lucide-react'
import type { CatalogFilters, RecommendationRequest } from '../types'

const workPlaces = [
  { label:'Не указывать', value:'none', location:null },
  { label:'Центр Красноярска', value:'center', location:{ lat:56.010, lon:92.872 } },
  { label:'СФУ · Свободный проспект', value:'sfu', location:{ lat:55.994, lon:92.771 } },
  { label:'Вокзал Красноярск-Пассажирский', value:'station', location:{ lat:56.004, lon:92.829 } }
]
const priorities: Array<{ key:keyof RecommendationRequest['priorities']; label:string }> = [
  { key:'schools', label:'Школы' }, { key:'parks', label:'Парки' }, { key:'transport', label:'Транспорт' },
  { key:'ecology', label:'Экология' }, { key:'safety', label:'Безопасность' }
]
export function PreferencePanel({ value, onChange, onApply, busy, error, filters, districts, onFilter, onReset, open, onClose }:{
  value:RecommendationRequest; onChange:(value:RecommendationRequest)=>void; onApply:()=>Promise<boolean>; busy:boolean; error:string;
  filters:CatalogFilters; districts:string[]; onFilter:<K extends keyof CatalogFilters>(key:K,value:CatalogFilters[K])=>void;
  onReset:()=>void; open:boolean; onClose:()=>void
}) {
  const workValue = workPlaces.find(place => place.location?.lat === value.work_location?.lat)?.value || 'none'
  return <aside className={`dashboard-sidebar preferences-sidebar ${open ? 'open' : ''}`}><div className="sidebar-heading"><h2>Ваши параметры</h2><button type="button" onClick={onReset}>Сбросить</button><button type="button" className="mobile-only-close" onClick={onClose} aria-label="Закрыть параметры"><X size={19}/></button></div>
    <form onSubmit={e => { e.preventDefault(); void onApply().then(ok => { if (ok) onClose() }) }}>
      <div className="sidebar-block"><label className="sidebar-label" htmlFor="budget-max">Бюджет на жильё, ₽</label><input id="budget-max" type="number" min="1" step="100000" value={value.budget_max || ''} onChange={e => onChange({...value,budget_max:Number(e.target.value)})} required/><label className="sidebar-label inline" htmlFor="down-payment">Первоначальный взнос, ₽</label><input id="down-payment" type="number" min="0" step="100000" value={value.down_payment} onChange={e => onChange({...value,down_payment:Number(e.target.value)})}/></div>
      <div className="sidebar-block"><span className="sidebar-label">Состав семьи</span><div className="family-grid"><label>Взрослых<select value={value.family.adults} aria-label="Количество взрослых" onChange={e => onChange({...value,family:{...value.family,adults:Number(e.target.value)}})}>{[1,2,3,4].map(n => <option key={n}>{n}</option>)}</select></label><label>Детей<select value={value.family.children} aria-label="Количество детей" onChange={e => onChange({...value,family:{...value.family,children:Number(e.target.value)}})}>{[0,1,2,3,4].map(n => <option key={n}>{n}</option>)}</select></label></div></div>
      <div className="sidebar-block"><label className="sidebar-label" htmlFor="work-location">Место работы</label><select id="work-location" value={workValue} onChange={e => onChange({...value,work_location:workPlaces.find(place => place.value === e.target.value)?.location || null})}>{workPlaces.map(place => <option value={place.value} key={place.value}>{place.label}</option>)}</select><label className="sidebar-label inline" htmlFor="commute">Время в пути до работы</label><select id="commute" value={value.max_commute_minutes} onChange={e => onChange({...value,max_commute_minutes:Number(e.target.value)})}>{[20,30,40,60,90].map(n => <option key={n} value={n}>До {n} минут</option>)}</select></div>
      <div className="sidebar-block"><label className="sidebar-label" htmlFor="district">Район каталога</label><select id="district" value={filters.district} onChange={e => onFilter('district',e.target.value)}><option value="">Все районы</option>{districts.map(d => <option key={d}>{d}</option>)}</select><span className="sidebar-label inline">Комнат в каталоге</span><div className="room-options">{[[0,'Все'],[1,'1'],[2,'2'],[3,'3']].map(([n,label]) => <button type="button" key={n} className={filters.rooms === n ? 'selected' : ''} onClick={() => onFilter('rooms',Number(n))}>{label}</button>)}</div></div>
      <div className="sidebar-block priority-block"><span className="sidebar-label">Ваши приоритеты <small>1–5</small></span><p>Вес факторов для персональной рекомендации</p><div className="priority-sliders">{priorities.map(({key,label}) => <label key={key} className="priority-slider"><span>{label}<b>{value.priorities[key]}</b></span><input type="range" min="1" max="5" value={value.priorities[key]} aria-label={`Приоритет: ${label}`} onChange={e => onChange({...value,priorities:{...value.priorities,[key]:Number(e.target.value)}})}/></label>)}</div></div>
      {error && <div className="sidebar-error" role="alert">{error}</div>}
      <button className="sidebar-apply" type="submit" disabled={busy}>{busy ? 'Подбираем…' : 'Подобрать жильё'} <ArrowRight size={18}/></button>
      <button className="sidebar-reset" type="button" onClick={onReset}><RotateCcw size={15}/> Сбросить параметры</button>
    </form>
  </aside>
}
