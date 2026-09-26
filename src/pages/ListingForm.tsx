import { useEffect,useState } from 'react'
import { ArrowLeft,ArrowRight,Check,ImagePlus,Info,RefreshCw,X } from 'lucide-react'
import { Link,useNavigate,useParams } from 'react-router-dom'
import { PageLoading } from '../components/Ui'
import { api } from '../lib/api'
import { validateApartment } from '../lib/catalog'
import { KRASNOYARSK_DISTRICTS } from '../lib/krasnoyarsk'
import type { ListingInput } from '../types'
import { useGeoDomStore } from '../store/useGeoDomStore'

type UploadStatus='queued'|'uploading'|'success'|'failed'
type UploadEntry={id:string;file:File;status:UploadStatus;error?:string}

const blank:ListingInput={
  title:'',address:'',district_name:'',price:0,area:0,rooms:1,floor:1,total_floors:1,
  description:'',kitchen_area:undefined,renovation:''
}

function uploadId(file:File,index:number) {
  return `${file.name}:${file.size}:${file.lastModified}:${index}:${Date.now()}`
}

export function ListingForm() {
  const {id}=useParams()
  const user=useGeoDomStore(state => state.user)
  const navigate=useNavigate()
  const [values,setValues]=useState<ListingInput>(blank)
  const [files,setFiles]=useState<UploadEntry[]>([])
  const [existingPhotos,setExistingPhotos]=useState<string[]>([])
  const [loading,setLoading]=useState(!!id)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [success,setSuccess]=useState('')
  const [progress,setProgress]=useState('')
  const [savedApartmentId,setSavedApartmentId]=useState(id || '')

  useEffect(() => {
    if (!id) return
    api.detail(id).then(item => {
      if (item.owner_id !== user?.id) throw new Error('Вы не можете редактировать это объявление')
      setValues({
        title:item.title,address:item.address,district_name:item.district.name === 'Уточняется' ? '' : item.district.name,
        price:item.price,area:item.area,rooms:item.rooms,floor:item.floor,total_floors:item.total_floors,
        description:item.description,kitchen_area:item.kitchen_area,renovation:item.renovation
      })
      setExistingPhotos(item.photos.map(photo => photo.url))
      setSavedApartmentId(item.id)
    }).catch(err => setError(err instanceof Error ? err.message : 'Не удалось загрузить объявление'))
      .finally(() => setLoading(false))
  },[id,user?.id])

  function field<K extends keyof ListingInput>(key:K,value:ListingInput[K]) {
    setValues(previous => ({...previous,[key]:value}))
  }

  function addPhotos(list:FileList|null) {
    if (!list) return
    const incoming=Array.from(list)
    if (incoming.some(file => !file.type.startsWith('image/'))) {
      setError('Можно загружать только изображения')
      return
    }
    if (incoming.some(file => file.size > 5*1024*1024)) {
      setError('Каждый файл должен быть не больше 5 МБ')
      return
    }
    if (files.length+existingPhotos.length+incoming.length > 10) {
      setError('Не больше 10 фотографий на объявление')
      return
    }
    setError('')
    setFiles(previous => [
      ...previous,
      ...incoming.map((file,index) => ({id:uploadId(file,previous.length+index),file,status:'queued' as const}))
    ])
  }

  function patchUpload(entryId:string,patch:Partial<UploadEntry>) {
    setFiles(previous => previous.map(entry => entry.id === entryId ? {...entry,...patch} : entry))
  }

  async function uploadOne(apartmentId:string,entryId:string) {
    const entry=files.find(item => item.id === entryId)
    if (!entry || entry.status === 'uploading' || entry.status === 'success') return true
    patchUpload(entryId,{status:'uploading',error:undefined})
    try {
      await api.upload(apartmentId,entry.file)
      patchUpload(entryId,{status:'success',error:undefined})
      return true
    } catch(err) {
      const message=err instanceof Error ? err.message : 'Не удалось загрузить фото'
      patchUpload(entryId,{status:'failed',error:message})
      return false
    }
  }

  async function retry(entryId:string) {
    if (!savedApartmentId) return
    setSuccess('')
    const ok=await uploadOne(savedApartmentId,entryId)
    if (ok) setSuccess('Фотография успешно загружена.')
  }

  async function submit(event:React.FormEvent) {
    event.preventDefault()
    const errors=validateApartment(values)
    if (errors.length) {
      setError(errors[0])
      window.scrollTo({top:0,behavior:'smooth'})
      return
    }

    setBusy(true)
    setError('')
    setSuccess('')
    let apartmentId=savedApartmentId

    try {
      setProgress(id || savedApartmentId ? 'Сохраняем изменения…' : 'Создаём объявление…')
      const item=id || savedApartmentId
        ? await api.update(id || savedApartmentId,values)
        : await api.create(values)
      apartmentId=item.id
      setSavedApartmentId(item.id)
    } catch(err) {
      setBusy(false)
      setProgress('')
      setError(err instanceof Error ? err.message : 'Не удалось сохранить объявление')
      window.scrollTo({top:0,behavior:'smooth'})
      return
    }

    const pending=files.filter(entry => entry.status !== 'success')
    let failed=0
    for(let index=0;index<pending.length;index++) {
      setProgress(`Загружаем фотографии: ${index+1} из ${pending.length}`)
      const ok=await uploadOne(apartmentId,pending[index].id)
      if (!ok) failed++
    }

    setBusy(false)
    setProgress('')

    if (failed > 0) {
      setSuccess(`Объявление сохранено. ${failed} ${failed === 1 ? 'фотографию' : 'фотографии'} не удалось загрузить. Повторите только неудачные файлы ниже.`)
      window.scrollTo({top:0,behavior:'smooth'})
      return
    }

    navigate('/account')
  }

  if (loading) return <div className="shell form-page"><PageLoading/></div>

  return <div className="shell form-page">
    <Link to="/account" className="back-link"><ArrowLeft size={17}/> Мои объявления</Link>
    <div className="form-heading">
      <span className="eyebrow"><span className="eyebrow-line"/> {id ? 'РЕДАКТИРОВАНИЕ' : 'НОВОЕ ОБЪЯВЛЕНИЕ'}</span>
      <h1>{id ? 'Изменить квартиру' : <>Расскажите о <em>квартире.</em></>}</h1>
      <p>Добавьте характеристики, район и фотографии. Backend перепроверит координаты и район по адресу.</p>
    </div>

    {error && <div className="form-error" role="alert">{error}</div>}
    {success && <div className="form-success" role="status"><Check size={17}/><span>{success}</span>{savedApartmentId && <Link to="/account">В кабинет</Link>}</div>}

    <form className="listing-form" onSubmit={submit}>
      <div className="form-main">
        <section className="form-section">
          <div className="form-section-head"><span>01</span><div><h2>Основная информация</h2><p>Начните с главного — как найти квартиру и что в ней особенного.</p></div></div>
          <div className="form-fields">
            <div className="form-field full"><label htmlFor="title">Название объявления *</label><input id="title" value={values.title} maxLength={100} onChange={event => field('title',event.target.value)} placeholder="Например, светлая квартира у набережной" required/></div>
            <div className="form-field full"><label htmlFor="address">Адрес в Красноярске *</label><input id="address" value={values.address} onChange={event => field('address',event.target.value)} placeholder="Красноярск, улица Ленина, 25" required/><small><Info size={14}/> Координаты backend определит по адресу; выбранный район используется как явный пользовательский признак.</small></div>
            <div className="form-field"><label htmlFor="district-name">Район *</label><select id="district-name" value={values.district_name} onChange={event => field('district_name',event.target.value)} required><option value="">Выберите район</option>{KRASNOYARSK_DISTRICTS.map(district => <option key={district.id} value={district.name}>{district.name}</option>)}</select><small><Info size={14}/> В Красноярске 7 административных районов.</small></div>
            <div className="form-field"><label htmlFor="price">Цена, ₽ *</label><input id="price" type="number" min="1" value={values.price || ''} onChange={event => field('price',Number(event.target.value))} placeholder="7 500 000" required/></div>
            <div className="form-field"><label htmlFor="area">Площадь, м² *</label><input id="area" type="number" min="0.1" step="0.1" value={values.area || ''} onChange={event => field('area',Number(event.target.value))} placeholder="56.4" required/></div>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-head"><span>02</span><div><h2>Характеристики</h2><p>Несколько деталей помогут лучше понять пространство.</p></div></div>
          <div className="form-fields">
            <div className="form-field"><label htmlFor="rooms">Количество комнат *</label><select id="rooms" value={values.rooms} onChange={event => field('rooms',Number(event.target.value))}><option value="0">Студия</option><option value="1">1 комната</option><option value="2">2 комнаты</option><option value="3">3 комнаты</option><option value="4">4 и более</option></select></div>
            <div className="form-field"><label htmlFor="floor">Этаж *</label><input id="floor" type="number" min="1" value={values.floor} onChange={event => field('floor',Number(event.target.value))} required/></div>
            <div className="form-field"><label htmlFor="total_floors">Этажей в доме *</label><input id="total_floors" type="number" min="1" value={values.total_floors} onChange={event => field('total_floors',Number(event.target.value))} required/></div>
            <div className="form-field"><label htmlFor="kitchen_area">Площадь кухни, м²</label><input id="kitchen_area" type="number" min="0" step="0.1" value={values.kitchen_area ?? ''} onChange={event => field('kitchen_area',event.target.value ? Number(event.target.value) : undefined)} placeholder="Необязательно"/></div>
            <div className="form-field full"><label htmlFor="renovation">Состояние</label><select id="renovation" value={values.renovation || ''} onChange={event => field('renovation',event.target.value)}><option value="">Не указано</option><option>Без ремонта</option><option>Предчистовая</option><option>Косметический ремонт</option><option>Современный ремонт</option></select></div>
            <div className="form-field full"><label htmlFor="description">Описание</label><textarea id="description" rows={5} value={values.description} onChange={event => field('description',event.target.value)} placeholder="Планировка, особенности, что вам нравится в этой квартире…"/></div>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-head"><span>03</span><div><h2>Фотографии</h2><p>До 10 изображений. Каждый файл загружается независимо и может быть повторён отдельно.</p></div></div>
          <label className="upload-zone"><ImagePlus size={27}/><b>Нажмите, чтобы выбрать фотографии</b><span>JPG, PNG, WebP · до 5 МБ каждая</span><input type="file" accept="image/*" multiple onChange={event => {addPhotos(event.target.files);event.target.value=''}}/></label>
          {(existingPhotos.length > 0 || files.length > 0) && <div className="selected-photos">
            {existingPhotos.map((src,index) => <div key={src} className="upload-photo-card success"><img src={src} alt={`Загруженное фото ${index+1}`}/><span>Уже загружено</span></div>)}
            {files.map((entry,index) => <LocalPhoto
              key={entry.id}
              entry={entry}
              index={index}
              canRetry={Boolean(savedApartmentId)}
              onRetry={() => void retry(entry.id)}
              onRemove={() => setFiles(previous => previous.filter(item => item.id !== entry.id))}
            />)}
          </div>}
        </section>

        <div className="form-submit-row">
          <button className="button dark" disabled={busy}>{busy ? progress : id || savedApartmentId ? 'Сохранить изменения' : 'Опубликовать квартиру'}{!busy && <ArrowRight size={18}/>}</button>
          <span><Check size={16}/> Объявление сохраняется отдельно от загрузки фотографий</span>
        </div>
      </div>

      <aside className="form-aside"><div className="form-tip"><span>ВАЖНО ЗНАТЬ</span><h3>Частичный upload не ломает объявление</h3><p>Сначала backend сохраняет объект. Затем фотографии загружаются независимо. Ошибка одного файла не отменяет уже созданную квартиру.</p><div className="tip-line"/><p>Неудачную фотографию можно повторить отдельно.</p></div></aside>
    </form>
  </div>
}

function LocalPhoto({
  entry,index,canRetry,onRetry,onRemove
}:{
  entry:UploadEntry
  index:number
  canRetry:boolean
  onRetry:()=>void
  onRemove:()=>void
}) {
  const [url,setUrl]=useState('')
  useEffect(() => {
    const next=URL.createObjectURL(entry.file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  },[entry.file])

  return <div className={`upload-photo-card ${entry.status}`}>
    {url ? <img src={url} alt={`Новое фото ${index+1}`}/> : null}
    <span className="upload-photo-status">
      {entry.status === 'queued' && 'В очереди'}
      {entry.status === 'uploading' && 'Загружается…'}
      {entry.status === 'success' && 'Загружено'}
      {entry.status === 'failed' && (entry.error || 'Ошибка загрузки')}
    </span>
    {entry.status === 'failed' && canRetry && <button type="button" className="upload-retry" onClick={onRetry}><RefreshCw size={14}/> Повторить</button>}
    {entry.status !== 'uploading' && entry.status !== 'success' && <button type="button" className="upload-remove" aria-label={`Убрать фото ${index+1}`} onClick={onRemove}><X size={15}/></button>}
  </div>
}
