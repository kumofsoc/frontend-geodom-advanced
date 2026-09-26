import { useEffect,useMemo,useState } from 'react'
import { ArrowUpRight,Building2,Check,GitCompareArrows } from 'lucide-react'
import { api } from '../lib/api'
import { price } from '../lib/catalog'
import { DataFreshness,SourceBadge,WarningBanner } from './DataTrust'
import { loadSelectedComplexIds,saveSelectedComplexIds } from '../lib/decisionSnapshot'
import type { ResidentialComplex } from '../types'

function cell(value:string|number|null|undefined,fallback='Нет данных') {
  return value === null || value === undefined || value === '' ? fallback : value
}

export function ResidentialComplexComparison() {
  const [items,setItems]=useState<ResidentialComplex[]>([])
  const [selected,setSelected]=useState<string[]>(loadSelectedComplexIds)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')

  useEffect(() => {
    const controller=new AbortController()
    api.complexes(30,controller.signal)
      .then(rows => {
        if (controller.signal.aborted) return
        setItems(rows)
        setSelected(current => {
          const available=current.filter(id => rows.some(item => item.id === id))
          if (available.length) return available
          const initial=rows.slice(0,Math.min(3,rows.length)).map(item => item.id)
          saveSelectedComplexIds(initial)
          return initial
        })
      })
      .catch(err => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Не удалось загрузить ЖК')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  },[])

  const selectedItems=useMemo(() => selected.map(id => items.find(item => item.id === id)).filter((item):item is ResidentialComplex => !!item),[selected,items])

  function toggle(id:string) {
    setSelected(current => {
      const next=current.includes(id) ? current.filter(value => value !== id) : current.length >= 3 ? current : [...current,id]
      saveSelectedComplexIds(next)
      return next
    })
  }

  return <section className="complex-comparison-section">
    <div className="dashboard-section-title">
      <div><h2>Сравнение <span>новостроек</span></h2><p>Выберите до 3 ЖК. GeoDom показывает только то, что реально пришло от backend и источников.</p></div>
      <span className="complex-compare-count"><GitCompareArrows size={15}/>{selected.length} / 3</span>
    </div>

    {error && <WarningBanner title="ЖК недоступны" warnings={[error]}/>}
    {loading && <div className="recommendation-loading"><span className="spinner"/> Загружаем ЖК…</div>}
    {!loading && !error && !items.length && <div className="complex-empty">Backend пока не вернул подтверждённые ЖК. GeoDom не создаёт mock-новостройки в live-режиме.</div>}

    {items.length > 0 && <>
      <div className="complex-picker">
        {items.slice(0,9).map(item => <button type="button" key={item.id} className={selected.includes(item.id) ? 'active' : ''} onClick={() => toggle(item.id)}>
          <span>{selected.includes(item.id) && <Check size={13}/>}</span>
          <div><b>{item.name}</b><small>{item.developer || 'Застройщик не указан'}</small></div>
        </button>)}
      </div>

      {selectedItems.length > 0 && <div className="complex-table-wrap">
        <div className="complex-table" style={{'--complex-count':selectedItems.length} as React.CSSProperties}>
          <div className="complex-label">Параметр</div>
          {selectedItems.map(item => <div className="complex-head" key={item.id}><Building2 size={18}/><b>{item.name}</b><small>{item.developer || 'Нет данных'}</small></div>)}

          <ComplexRow label="Район / адрес" items={selectedItems} render={item => cell(item.address)}/>
          <ComplexRow label="Срок сдачи" items={selectedItems} render={item => item.plannedCompletionYear ? String(item.plannedCompletionYear) : 'Нет данных'}/>
          <ComplexRow label="Цена от" items={selectedItems} render={item => item.minPrice === null ? 'Нет данных' : price(item.minPrice)}/>
          <ComplexRow label="Квартир в данных" items={selectedItems} render={item => String(item.apartmentCount)}/>
          <ComplexRow label="Планировки" items={selectedItems} render={() => 'Нет данных'}/>
          <ComplexRow label="Транспорт" items={selectedItems} render={() => 'Нет данных'}/>
          <ComplexRow label="Школы" items={selectedItems} render={() => 'Нет данных'}/>
          <ComplexRow label="Парки / экология" items={selectedItems} render={() => 'Нет данных'}/>
          <ComplexRow label="До работы" items={selectedItems} render={() => 'Маршрут не рассчитан'}/>
          <div className="complex-label">Источник / дата</div>
          {selectedItems.map(item => <div className="complex-source" key={item.id}>
            <SourceBadge name={item.sourceName} url={item.sourceUrl}/>
            <DataFreshness date={item.updatedAt}/>
            {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Открыть <ArrowUpRight size={12}/></a>}
          </div>)}
        </div>
      </div>}

      <WarningBanner title="Покрытие сравнения ЖК" warnings={['Backend summary пока не передаёт планировки, транспорт, школы, экологию и маршрут до работы. Эти ячейки оставлены как «Нет данных», а не заполнены предположениями.']}/>
    </>}
  </section>
}

function ComplexRow({label,items,render}:{label:string;items:ResidentialComplex[];render:(item:ResidentialComplex)=>React.ReactNode}) {
  return <>
    <div className="complex-label">{label}</div>
    {items.map(item => <div className="complex-value" key={`${label}:${item.id}`}>{render(item)}</div>)}
  </>
}
