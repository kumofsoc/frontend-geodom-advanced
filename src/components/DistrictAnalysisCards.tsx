import { ArrowRight,MapPin,Sparkles } from 'lucide-react'
import { CoverageIndicator,DataFreshness,SourceBadge,WarningBanner } from './DataTrust'
import { price } from '../lib/catalog'
import type { DistrictAnalysis } from '../types'

const scoreRows:Array<{key:keyof DistrictAnalysis['scores'];label:string}>=[
  {key:'transport',label:'Транспорт'},
  {key:'ecology',label:'Экология'},
  {key:'schools',label:'Школы'},
  {key:'safety',label:'Безопасность'},
  {key:'infrastructure',label:'Инфраструктура'}
]

function score(value:number|null) {
  return value === null || !Number.isFinite(value) ? 'Нет данных' : value.toFixed(1)
}

export function DistrictAnalysisCards({
  items,
  selectedDistrict,
  onSelect
}:{
  items:DistrictAnalysis[]
  selectedDistrict:string
  onSelect:(name:string)=>void
}) {
  const visible=[...items]
    .sort((a,b) => {
      if (a.overallScore !== null && b.overallScore !== null) return b.overallScore-a.overallScore
      if (a.overallScore !== null) return -1
      if (b.overallScore !== null) return 1
      return b.apartmentCount-a.apartmentCount
    })
    .slice(0,3)

  return <div className="district-analysis-grid">
    {visible.map(item => <article className={`district-analysis-card ${selectedDistrict === item.name ? 'chosen' : ''}`} key={item.id}>
      <div className="district-analysis-head">
        <div><span><MapPin size={13}/> {item.apartmentCount} квартир в данных</span><h3>{item.name}</h3></div>
        <div className="district-analysis-score"><Sparkles size={14}/><b>{score(item.overallScore)}</b>{item.overallScore !== null && <small>/10</small>}</div>
      </div>

      <div className="district-analysis-factors">
        {scoreRows.map(row => <div key={row.key}><span>{row.label}</span><b>{score(item.scores[row.key])}</b></div>)}
      </div>

      <div className="district-analysis-market">
        <div><span>Медианная цена</span><b>{item.medianPrice === null ? 'Нет данных' : price(Math.round(item.medianPrice))}</b></div>
        <div><span>Цена за м²</span><b>{item.medianPriceM2 === null ? 'Нет данных' : `${price(Math.round(item.medianPriceM2))}/м²`}</b></div>
      </div>

      <CoverageIndicator value={item.coverage}/>
      <div className="district-analysis-provenance"><SourceBadge name={item.sourceName} url={item.sourceUrl}/><DataFreshness date={item.updatedAt}/></div>
      <WarningBanner warnings={item.warnings}/>

      <button type="button" className="district-analysis-open" onClick={() => onSelect(item.name)}>
        Смотреть квартиры района <ArrowRight size={15}/>
      </button>
    </article>)}
  </div>
}
