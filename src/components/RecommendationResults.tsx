import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ArrowUpRight, Bookmark, Check, CircleAlert, GitCompareArrows, Sparkles, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { getSavedIds, toggleSavedId } from '../lib/recommendations'
import { price } from '../lib/catalog'
import type { InteractionEvent, RecommendationItem, RecommendationResponse } from '../types'

const dimensions: Array<{ key:keyof RecommendationItem['scores']; label:string }> = [
  { key:'schools',label:'Школы' }, { key:'parks',label:'Парки' }, { key:'transport',label:'Транспорт' },
  { key:'ecology',label:'Экология' }, { key:'safety',label:'Безопасность' }
]
export function RecommendationResults({ response, loading, error, onRetry }:{ response:RecommendationResponse|null; loading:boolean; error:string; onRetry:()=>void }) {
  const [saved,setSaved] = useState<string[]>(getSavedIds)
  const [compared,setCompared] = useState<string[]>([])
  const sent = useRef(new Set<string>())
  useEffect(() => { setCompared([]) },[response?.request_id])
  function track(event:InteractionEvent,item:RecommendationItem,position:number) {
    if (!response) return
    const key = `${response.request_id}:${event}:${item.apartment_id}`
    if (event === 'impression' && sent.current.has(key)) return
    sent.current.add(key)
    void api.event({ request_id:response.request_id,event,entity_type:'apartment',entity_id:item.apartment_id,position }).catch(() => {})
  }
  function save(item:RecommendationItem,position:number) { const active = toggleSavedId(String(item.apartment_id)); setSaved(getSavedIds()); if (active) track('save',item,position) }
  function compare(item:RecommendationItem,position:number) { const id=String(item.apartment_id); if (compared.includes(id)) { setCompared(prev => prev.filter(x => x !== id)); return } if (compared.length >= 3) return; setCompared(prev => [...prev,id]); track('compare',item,position) }
  return <section className="recommendations-section" id="recommendations"><div className="dashboard-section-title recommendation-title"><div><h2>Подбор <span>для вас</span></h2><p>Результаты учитывают бюджет, семью и выбранные приоритеты</p></div>{response && <span className="mini-label">{response.items.length} ВАРИАНТОВ · {response.scoring_version}</span>}</div>
    {loading ? <div className="recommendation-loading"><span className="spinner"/> Подбираем варианты под ваши параметры…</div> : error ? <div className="recommendation-error"><CircleAlert size={20}/><div><b>Не удалось получить рекомендации</b><p>{error}. Общий каталог ниже доступен.</p></div><button onClick={onRetry}>Повторить</button></div> : response && <>
      {response.warnings.length > 0 && <div className="recommendation-warning"><CircleAlert size={19}/><div>{response.warnings.map(w => <p key={w}>{w}</p>)}</div></div>}
      {response.items.length ? <div className="recommendation-grid">{response.items.map((item,index) => <RecommendationCard key={String(item.apartment_id)} item={item} position={index+1} saved={saved.includes(String(item.apartment_id))} compared={compared.includes(String(item.apartment_id))} compareFull={compared.length >= 3} onImpression={() => track('impression',item,index+1)} onOpen={() => track('click',item,index+1)} onSave={() => save(item,index+1)} onCompare={() => compare(item,index+1)}/>)}</div> : <div className="recommendation-empty"><h3>В этом бюджете вариантов нет</h3><p>Увеличьте максимальную стоимость или посмотрите общий каталог ниже.</p></div>}
      <div className="recommendation-meta"><Sparkles size={15}/> {response.ml_available ? `Модель: ${response.model_version}` : 'Демонстрационный скоринг без ML'} · Запрос {response.request_id.slice(0,8)}</div>
      {compared.length > 0 && <CompareTray items={compared.map(id => response.items.find(item => String(item.apartment_id) === id)).filter((item):item is RecommendationItem => !!item)} onOpen={item => track('click',item,response.items.findIndex(candidate => candidate.apartment_id === item.apartment_id)+1)} onRemove={id => setCompared(prev => prev.filter(x => x !== id))} onClose={() => setCompared([])}/>}
    </>}
  </section>
}
function RecommendationCard({item,position,saved,compared,compareFull,onImpression,onOpen,onSave,onCompare}:{ item:RecommendationItem;position:number;saved:boolean;compared:boolean;compareFull:boolean;onImpression:()=>void;onOpen:()=>void;onSave:()=>void;onCompare:()=>void }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const node=ref.current; if (!node) return
    if (!('IntersectionObserver' in window)) { onImpression(); return }
    const observer=new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { onImpression(); observer.disconnect() } },{ threshold:.35 })
    observer.observe(node); return () => observer.disconnect()
  },[onImpression])
  return <article ref={ref} className="recommendation-card"><Link to={`/apartments/${item.apartment_id}`} onClick={onOpen} className="recommendation-cover">{item.cover_image_url ? <img src={item.cover_image_url} alt={item.title} loading="lazy"/> : <div className="image-placeholder">GEODOM</div>}<span className="recommendation-rank">#{position} В ПОДБОРКЕ</span></Link><div className="recommendation-body"><div className="recommendation-score-row"><span className="recommendation-score"><Sparkles size={15}/> {item.score.toFixed(1)} <small>/ 10</small></span><span className="score-caption">СООТВЕТСТВИЕ</span></div><Link to={`/apartments/${item.apartment_id}`} onClick={onOpen} className="recommendation-title">{item.title} <ArrowUpRight size={17}/></Link><div className="recommendation-price">{price(item.price)} <small>{price(item.price_m2)} / м²</small></div><ul className="reason-list">{item.reasons.slice(0,2).map(reason => <li key={reason}><Check size={14}/>{reason}</li>)}</ul><div className="mini-scores">{dimensions.slice(0,3).map(({key,label}) => <div key={key}><span>{label}</span><div><i style={{width:`${(item.scores[key] || 0)*10}%`}}/></div><b>{item.scores[key]?.toFixed(1) ?? '—'}</b></div>)}</div>{item.warnings.length > 0 && <div className="card-warning">{item.warnings.join(' · ')}</div>}<div className="recommendation-actions"><button onClick={onSave} className={saved ? 'active' : ''} aria-label={saved ? 'Убрать из сохранённого' : 'Сохранить квартиру'}><Bookmark size={16} fill={saved?'currentColor':'none'}/>{saved?'Сохранено':'Сохранить'}</button><button onClick={onCompare} className={compared?'active':''} disabled={compareFull&&!compared} aria-label={compared?'Убрать из сравнения':'Добавить к сравнению'}><GitCompareArrows size={16}/>{compared?'В сравнении':'Сравнить'}</button></div></div></article>
}
function CompareTray({items,onOpen,onRemove,onClose}:{items:RecommendationItem[];onOpen:(item:RecommendationItem)=>void;onRemove:(id:string)=>void;onClose:()=>void}) {
  return <div className="compare-tray" role="region" aria-label="Сравнение квартир"><div className="compare-tray-head"><div><b>Сравнение квартир</b><span>До трёх вариантов рядом</span></div><button onClick={onClose} aria-label="Закрыть сравнение"><X size={18}/></button></div><div className="compare-columns">{items.map(item => <div key={String(item.apartment_id)}><button className="compare-remove" onClick={() => onRemove(String(item.apartment_id))} aria-label={`Убрать ${item.title}`}><X size={13}/></button><Link to={`/apartments/${item.apartment_id}`} onClick={() => onOpen(item)}>{item.title} <ArrowRight size={13}/></Link><strong>{price(item.price)}</strong><span>Оценка {item.score.toFixed(1)} / 10</span><span>Школы {item.scores.schools?.toFixed(1) ?? '—'} · Парки {item.scores.parks?.toFixed(1) ?? '—'}</span><span>Транспорт {item.scores.transport?.toFixed(1) ?? '—'}</span></div>)}</div></div>
}
