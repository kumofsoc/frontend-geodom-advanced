import { ArrowUpRight, Heart, MapPin, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Apartment } from '../types'
import { area, price } from '../lib/catalog'
export function ApartmentCard({ item, index = 0 }: { item: Apartment; index?: number }) {
  const cover = item.photos.find(x => x.is_cover)?.url || item.photos[0]?.url
  return <Link to={`/apartments/${item.id}`} className="home-card" style={{ animationDelay: `${index * 60}ms` }}>
    <div className="home-card-image">{cover ? <img src={cover} alt={item.title} loading="lazy" /> : <div className="image-placeholder">GEODOM</div>}<span className="photo-count">{item.photos.length ? `01 / ${String(item.photos.length).padStart(2, '0')}` : 'БЕЗ ФОТО'}</span><span className="card-like" aria-hidden="true"><Heart size={18} /></span></div>
    <div className="home-card-info"><div className="card-price">{price(item.price)} <ArrowUpRight size={19}/></div><h3>{item.title}</h3><div className="card-address"><MapPin size={14}/>{item.address}</div><div className="card-bottom"><span>{item.rooms === 0 ? 'Студия' : `${item.rooms}-комн.`}</span><span>{area(item.area)}</span><span>{item.floor} / {item.total_floors} эт.</span></div>{item.recommendation.score !== null && <div className="card-match"><Sparkles size={14}/> Обзорная оценка {(item.recommendation.score > 10 ? item.recommendation.score/10 : item.recommendation.score).toFixed(1)}/10 <small>{item.recommendation.ml_available ? 'ML' : 'демо'}</small></div>}</div>
  </Link>
}
export function EmptyState({ title, message, action }: { title: string; message: string; action?: React.ReactNode }) { return <div className="empty-state"><span className="empty-mark">✳</span><h2>{title}</h2><p>{message}</p>{action}</div> }
export function PageLoading() { return <div className="page-loading"><span className="spinner"/>Загружаем данные…</div> }
