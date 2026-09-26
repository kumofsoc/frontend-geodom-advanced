import { mkdirSync,readFileSync,writeFileSync } from 'node:fs'
import { dirname,resolve } from 'node:path'

const input=resolve(process.argv[2] || 'local-data/media.jsonl')
const output=resolve(process.argv[3] || 'src/data/localHousingMedia.generated.ts')

const rows=readFileSync(input,'utf8')
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(Boolean)
  .map((line,index) => {
    try { return JSON.parse(line) }
    catch (error) { throw new Error(`Invalid JSONL at line ${index+1}: ${error.message}`) }
  })

const mediaPath=value => {
  const path=String(value || '').replace(/\\/g,'/').replace(/^\.\//,'')
  const marker='/media/'
  const index=path.lastIndexOf(marker)
  const relative=index >= 0 ? path.slice(index+marker.length) : path.replace(/^media\//,'')
  return '/media/'+relative.split('/').filter(Boolean).map(encodeURIComponent).join('/')
}

const groups={}
for (const row of rows) {
  if (row.entity_type && row.entity_type !== 'apartment') continue
  const entityId=String(row.entity_id || '').trim()
  if (!entityId) continue
  const url=mediaPath(row.local_path || row.storage_key)
  if (url === '/media/') continue
  const item={
    id:String(row.id || row.storage_key || `${entityId}:${row.position ?? 0}`),
    url,
    order:Number.isFinite(Number(row.position)) ? Number(row.position) : 0,
    is_cover:Boolean(row.is_cover),
    storage_key:row.storage_key || undefined,
    local_path:row.local_path || undefined,
    attribution:row.attribution || undefined,
    rights_status:row.rights_status || undefined,
    publication_allowed:typeof row.publication_allowed === 'boolean' ? row.publication_allowed : undefined
  }
  ;(groups[entityId] ||= []).push(item)
}
for (const items of Object.values(groups)) items.sort((a,b) => a.order-b.order)

mkdirSync(dirname(output),{ recursive:true })
const source=`// Generated from local media.jsonl. Temporary frontend-only bridge.\nexport const localHousingMedia = ${JSON.stringify(groups,null,2)} as Record<string, Array<{ id:string; url:string; order:number; is_cover:boolean; storage_key?:string; local_path?:string; attribution?:string; rights_status?:string; publication_allowed?:boolean }>>\n`
writeFileSync(output,source)
console.log(`Wrote ${Object.keys(groups).length} apartment media groups to ${output}`)
