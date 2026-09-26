import { useMemo,useState } from 'react'
import { Check, RefreshCw, ShieldCheck, UserRoundSearch, X } from 'lucide-react'
import {
  buildSharedDemandProfile,
  clearSharedDemandProfile,
  loadSharedDemandProfile,
  revokeSharedDemandProfile,
  saveSharedDemandProfile,
  type SharedDemandProfile
} from '../lib/demandProfile'
import { useGeoDomStore } from '../store/useGeoDomStore'

export function DemandSharePanel() {
  const user=useGeoDomStore(state => state.user)
  const preferences=useGeoDomStore(state => state.preferences)
  const filters=useGeoDomStore(state => state.filters)
  const initial=useMemo(() => {
    const profile=loadSharedDemandProfile()
    return profile && profile.userId === user?.id ? profile : null
  },[user?.id])
  const [profile,setProfile]=useState<SharedDemandProfile|null>(initial)
  const [contact,setContact]=useState(initial?.contact || '')
  const [consent,setConsent]=useState(Boolean(initial?.consentToContact))
  const [message,setMessage]=useState('')

  if (!user) return null
  const currentUser=user

  function save() {
    if (contact.trim().length < 3) {
      setMessage('Укажите телефон, Telegram или email для связи.')
      return
    }
    const next=buildSharedDemandProfile({
      current:profile,
      user:currentUser,
      contact,
      consentToContact:consent,
      preferences,
      filters
    })
    saveSharedDemandProfile(next)
    setProfile(next)
    setMessage(consent ? 'Профиль поиска обновлён и доступен подходящим Pro-риелторам в demo.' : 'Профиль сохранён, но передача контакта выключена.')
  }

  function revoke() {
    const next=revokeSharedDemandProfile()
    if (next && next.userId === currentUser.id) {
      setProfile(next)
      setConsent(false)
      setMessage('Согласие на передачу контакта отозвано.')
    }
  }

  function remove() {
    clearSharedDemandProfile()
    setProfile(null)
    setContact('')
    setConsent(false)
    setMessage('Профиль поиска удалён из этого браузера.')
  }

  const district=filters.district || 'Любой район'
  const rooms=!filters.rooms ? 'Любая комнатность' : filters.rooms >= 4 ? '4+ комнат' : `${filters.rooms} комн.`
  const active=profile?.consentToContact === true

  return <section className="demand-share-panel">
    <div className="demand-share-head">
      <span><UserRoundSearch size={19}/></span>
      <div>
        <small>МОЙ ПОИСК → GEODOM PRO</small>
        <h2>Получать предложения только по вашему сценарию</h2>
        <p>GeoDom может передать ваш контакт риелтору только когда его объявление подходит под текущие параметры и вы явно разрешили связь.</p>
      </div>
      <div className={`demand-share-status ${active ? 'active' : ''}`}>{active ? <><Check size={14}/> Доступен Pro</> : <><ShieldCheck size={14}/> Контакт закрыт</>}</div>
    </div>

    <div className="demand-share-snapshot">
      <div><span>Бюджет</span><b>{new Intl.NumberFormat('ru-RU').format(preferences.budget_max)} ₽</b></div>
      <div><span>Район</span><b>{district}</b></div>
      <div><span>Комнаты</span><b>{rooms}</b></div>
      <div><span>До работы</span><b>до {preferences.max_commute_minutes} мин</b></div>
    </div>

    <div className="demand-share-form">
      <label>
        <span>Контакт для подходящих риелторов</span>
        <input value={contact} onChange={event => setContact(event.target.value)} placeholder="+7…, @telegram или email"/>
      </label>
      <label className="demand-consent">
        <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)}/>
        <span><b>Разрешаю передавать этот контакт подходящим Pro-риелторам</b><small>Согласие можно отозвать в любой момент. Без галочки контакт остаётся закрытым.</small></span>
      </label>
    </div>

    <div className="demand-share-actions">
      <button type="button" className="button dark" onClick={save}><RefreshCw size={15}/> {profile ? 'Обновить профиль поиска' : 'Сохранить профиль поиска'}</button>
      {profile?.consentToContact && <button type="button" className="button light" onClick={revoke}><ShieldCheck size={15}/> Отозвать согласие</button>}
      {profile && <button type="button" className="demand-delete" onClick={remove}><X size={15}/> Удалить профиль</button>}
    </div>

    {message && <div className="demand-share-message">{message}</div>}
    <p className="demand-share-footnote">Demo хранит профиль локально в браузере. Backend, биллинг и реальная передача лида пока не подключены.</p>
  </section>
}
