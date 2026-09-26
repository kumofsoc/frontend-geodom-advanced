import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ArrowUpRight, House, Menu, Plus, X } from 'lucide-react'
import { api, isDemo } from './lib/api'
import { PageLoading } from './components/Ui'
import { useGeoDomStore } from './store/useGeoDomStore'
import './styles.css'

const Catalog = lazy(() => import('./pages/Catalog').then(module => ({ default:module.Catalog })))
const Detail = lazy(() => import('./pages/Detail').then(module => ({ default:module.Detail })))
const Auth = lazy(() => import('./pages/Auth').then(module => ({ default:module.Auth })))
const Account = lazy(() => import('./pages/Account').then(module => ({ default:module.Account })))
const ListingForm = lazy(() => import('./pages/ListingForm').then(module => ({ default:module.ListingForm })))

function Header() {
  const user = useGeoDomStore(state => state.user); const [open, setOpen] = useState(false); const location = useLocation()
  useEffect(() => setOpen(false), [location.pathname])
  return <><header className="site-header"><div className="shell header-inner"><Link to="/" className="brand" aria-label="ГеоДом — главная"><span className="brand-symbol"><House size={25} strokeWidth={2.8}/></span><span className="brand-name">ГеоДом<span className="brand-label">где лучше жить</span></span></Link><nav className="desktop-nav"><a href="/#recommendations">Подбор</a><a href="/#catalog">Квартиры</a></nav><div className="header-actions"><Link className="post-link" to={user ? '/new' : '/login?next=/new'}><Plus size={18}/> Разместить квартиру</Link><Link className="account-link" to={user ? '/account' : '/login'}>{user ? <><span className="user-dot">{user.login[0].toUpperCase()}</span><span>Кабинет</span></> : 'Войти'}<ArrowUpRight size={15}/></Link></div><button className="mobile-menu" aria-label={open ? 'Закрыть меню' : 'Открыть меню'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X/> : <Menu/>}</button></div></header>{open && <div className="mobile-panel"><a href="/#recommendations" onClick={() => setOpen(false)}>Подбор</a><a href="/#catalog" onClick={() => setOpen(false)}>Квартиры</a><Link to={user ? '/new' : '/login?next=/new'}>Разместить квартиру</Link><Link to={user ? '/account' : '/login'}>{user ? 'Личный кабинет' : 'Войти'}</Link></div>}</>
}
function Footer() { return <footer className="site-footer"><div className="shell footer-inner"><div><Link className="footer-brand" to="/">ГеоДом<span>°</span></Link><p>Квартиры и городская среда<br/>в одном месте.</p></div><div className="footer-right"><span>КРАСНОЯРСК · 2026</span><p>Информация о демо-объектах приведена для проверки интерфейса. Уточняйте сведения из официальных источников.</p></div></div></footer> }
function RequireAuth({ children }: { children: React.ReactNode }) { const user = useGeoDomStore(state => state.user); const location = useLocation(); return user ? children : <NavigateToLogin next={location.pathname}/> }
function NavigateToLogin({ next }: { next: string }) { const navigate = useNavigate(); useEffect(() => { navigate(`/login?next=${encodeURIComponent(next)}`, { replace:true }) }, [navigate, next]); return null }
export default function App() {
  const setUser = useGeoDomStore(state => state.setUser)
  useEffect(() => {
    const sessionUser = api.session()?.user
    if (sessionUser) setUser(sessionUser)
    api.currentUser().then(setUser).catch(() => setUser(null))
  }, [setUser])
  return <div className="app"><Header/>{isDemo && <div className="demo-banner"><span className="shell">ДЕМО-РЕЖИМ <span>·</span> Примерные квартиры и проекты. Для реальных данных подключите FastAPI.</span></div>}<main><Suspense fallback={<PageLoading/>}><Routes><Route path="/" element={<Catalog/>}/><Route path="/apartments/:id" element={<Detail/>}/><Route path="/login" element={<Auth mode="login"/>}/><Route path="/register" element={<Auth mode="register"/>}/><Route path="/account" element={<RequireAuth><Account/></RequireAuth>}/><Route path="/new" element={<RequireAuth><ListingForm/></RequireAuth>}/><Route path="/apartments/:id/edit" element={<RequireAuth><ListingForm/></RequireAuth>}/><Route path="*" element={<div className="shell not-found"><span>404</span><h1>Такой страницы нет</h1><Link className="button dark" to="/">Вернуться к квартирам</Link></div>}/></Routes></Suspense></main><Footer/></div>
}
