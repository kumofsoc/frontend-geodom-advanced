import { AlertTriangle,CalendarClock,ChevronDown,Database,ExternalLink,Info } from 'lucide-react'
import type { ReactNode } from 'react'

export function SourceBadge({name,url}:{name:string;url?:string|null}) {
  const body=<><Database size={13}/><span>{name || 'Источник не указан'}</span>{url && <ExternalLink size={12}/>}</>
  return url
    ? <a className="data-source-badge" href={url} target="_blank" rel="noopener noreferrer">{body}</a>
    : <span className="data-source-badge">{body}</span>
}

export function DataFreshness({date,label='Обновлено'}:{date?:string|null;label?:string}) {
  if (!date) return <span className="data-freshness unknown"><CalendarClock size={13}/> Дата не указана</span>
  const parsed=new Date(date)
  const readable=Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('ru-RU')
  return <span className="data-freshness"><CalendarClock size={13}/> {label}: {readable}</span>
}

export function WarningBanner({title='Ограничения данных',warnings}:{title?:string;warnings:string[]}) {
  if (!warnings.length) return null
  return <div className="warning-banner" role="status"><AlertTriangle size={17}/><div><b>{title}</b>{warnings.map((warning,index) => <p key={`${warning}:${index}`}>{warning}</p>)}</div></div>
}

export function CoverageIndicator({value,label='Покрытие данных'}:{value:number|null;label?:string}) {
  const normalized=value === null || !Number.isFinite(value) ? null : Math.max(0,Math.min(1,value))
  return <div className="coverage-indicator">
    <div><span>{label}</span><b>{normalized === null ? 'Нет данных' : `${Math.round(normalized*100)}%`}</b></div>
    <div className="coverage-track" aria-hidden="true"><i style={{width:normalized === null ? '0%' : `${normalized*100}%`}}/></div>
  </div>
}

export function AssumptionsDrawer({title='Как посчитано?',children}:{title?:string;children:ReactNode}) {
  return <details className="assumptions-drawer"><summary><Info size={14}/><span>{title}</span><ChevronDown size={14}/></summary><div>{children}</div></details>
}
