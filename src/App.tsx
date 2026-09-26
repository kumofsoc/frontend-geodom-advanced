import { createContext, useContext, useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Menu, Plus, X } from 'lucide-react'
import { api, isDemo } from './lib/api'
import type { User } from './types'
import { Catalog } from './pages/Catalog'
import { Detail } from './pages/Detail'
import { Auth } from './pages/Auth'
import { Account } from './pages/Account'
import { ListingForm } from './pages/ListingForm'
import './styles.css'

type AuthState = { user: User | null; setUser: (user: User | null) => void }
const AuthContext = createContext<AuthState>({ user: null, setUser: () => {} })
export const useAuth = () => useContext(AuthContext)
function Header() {
  const { user } = useAuth(); const [open, setOpen] = useState(false); const location = useLocation()
  useEffect(() => setOpen(false), [location.pathname])
  return <><header className="site-header"><div className="shell header-inner"><Link to="/" className="brand" aria-label="Среда — главная"><span className="brand-symbol">с<span>°</span></span><span className="brand-name">среда<span className="brand-label">квартиры Красноярска</span></span></Link><nav className="desktop-nav"><NavLink to="/" end>Квартиры</NavLink><a href="/#how-it-works">Как это работает</a></nav><div className="header-actions"><Link className="post-link" to={user ? '/new' : '/login?next=/new'}><Plus size={18}/> Разместить квартиру</Link><Link className="account-link" to={user ? '/account' : '/login'}>{user ? <><span className="user-dot">{user.login[0].toUpperCase()}</span><span>Кабинет</span></> : 'Войти'}<ArrowUpRight size={15}/></Link></div><button className="mobile-menu" aria-label={open ? 'Закрыть меню' : 'Открыть меню'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X/> : <Menu/>}</button></div></header>{open && <div className="mobile-panel"><NavLink to="/">Квартиры</NavLink><a href="/#how-it-works" onClick={() => setOpen(false)}>Как это работает</a><Link to={user ? '/new' : '/login?next=/new'}>Разместить квартиру</Link><Link to={user ? '/account' : '/login'}>{user ? 'Личный кабинет' : 'Войти'}</Link></div>}</>
}
function Footer() { return <footer className="site-footer"><div className="shell footer-inner"><div><Link className="footer-brand" to="/">среда<span>°</span></Link><p>Квартиры и городская среда<br/>в одном месте.</p></div><div className="footer-right"><span>КРАСНОЯРСК · 2026</span><p>Информация о демо-объектах приведена для проверки интерфейса. Уточняйте сведения из официальных источников.</p></div></div></footer> }
function RequireAuth({ children }: { children: React.ReactNode }) { const { user } = useAuth(); const location = useLocation(); return user ? children : <NavigateToLogin next={location.pathname}/> }
function NavigateToLogin({ next }: { next: string }) { const navigate = useNavigate(); useEffect(() => { navigate(`/login?next=${encodeURIComponent(next)}`, { replace:true }) }, [navigate, next]); return null }
export default function App() {
  const [user, setUser] = useState<User | null>(api.session()?.user ?? null)
  useEffect(() => { api.currentUser().then(setUser).catch(() => setUser(null)) }, [])
  return <AuthContext.Provider value={{ user, setUser }}><div className="app"><Header/>{isDemo && <div className="demo-banner"><span className="shell">ДЕМО-РЕЖИМ <span>·</span> Примерные квартиры и проекты. Для реальных данных подключите FastAPI.</span></div>}<main><Routes><Route path="/" element={<Catalog/>}/><Route path="/apartments/:id" element={<Detail/>}/><Route path="/login" element={<Auth mode="login"/>}/><Route path="/register" element={<Auth mode="register"/>}/><Route path="/account" element={<RequireAuth><Account/></RequireAuth>}/><Route path="/new" element={<RequireAuth><ListingForm/></RequireAuth>}/><Route path="/apartments/:id/edit" element={<RequireAuth><ListingForm/></RequireAuth>}/><Route path="*" element={<div className="shell not-found"><span>404</span><h1>Такой страницы нет</h1><Link className="button dark" to="/">Вернуться к квартирам</Link></div>}/></Routes></main><Footer/></div></AuthContext.Provider>
}
