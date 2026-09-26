import { isDemo } from './config'
import { readLocal } from './common'
import { getSession,request } from './http'
import type { SharedDemandProfile } from '../lib/demandProfile'
import type { LeadStage,ProLead } from '../lib/pro'

type BackendDemandProfile={
  user_id:number
  name?:string
  intent:'buy'|'rent'
  budget_max:number
  monthly_rent_max?:number|null
  district_names:string[]
  rooms_min:number
  rooms_max:number
  max_commute_minutes:number
  priorities:string[]
  work_label:string
  work_location?:{lat:number;lon:number}|null
  contact?:string
  consent_to_contact:boolean
  active:boolean
  created_at:string
  updated_at:string
}

type BackendProLead={
  user_id:number
  name:string
  intent:'buy'|'rent'
  budget_max:number
  monthly_rent_max?:number|null
  district_names:string[]
  rooms_min:number
  rooms_max:number
  max_commute_minutes:number
  priorities:string[]
  work_label:string
  consent_to_contact:boolean
  contact?:string
  match_score:number
  reasons:string[]
  stage:LeadStage
  created_at:string
}

type ProAccountStatus={user_id:number|string;status:'none'|'trial'|'active'|'expired'|'disabled';trial_until?:string|null}

function fromDemand(raw:BackendDemandProfile):SharedDemandProfile {
  const user=getSession()?.user
  return {
    id:`backend:${raw.user_id}`,userId:String(raw.user_id),name:raw.name || user?.login || 'Пользователь',
    contact:raw.contact || '',consentToContact:Boolean(raw.consent_to_contact),budgetMax:Number(raw.budget_max || 0),
    districts:Array.isArray(raw.district_names) ? raw.district_names : [],roomsMin:Number(raw.rooms_min || 0),roomsMax:Number(raw.rooms_max || 0),
    maxCommuteMinutes:Number(raw.max_commute_minutes || 0),priorities:Array.isArray(raw.priorities) ? raw.priorities : [],
    workLocation:raw.work_location ?? null,createdAt:raw.created_at,updatedAt:raw.updated_at
  }
}

function toDemand(profile:SharedDemandProfile) {
  return {
    intent:'buy',budget_max:profile.budgetMax,monthly_rent_max:null,district_names:profile.districts,
    rooms_min:profile.roomsMin,rooms_max:profile.roomsMax,max_commute_minutes:profile.maxCommuteMinutes,
    priorities:profile.priorities,work_label:profile.workLocation ? `${profile.workLocation.lat.toFixed(5)}, ${profile.workLocation.lon.toFixed(5)}` : '',
    work_location:profile.workLocation,contact:profile.contact,consent_to_contact:profile.consentToContact,active:true
  }
}

function fromLead(raw:BackendProLead):ProLead {
  return {
    id:`user:${raw.user_id}`,name:raw.name || `Пользователь ${raw.user_id}`,intent:raw.intent,budgetMax:Number(raw.budget_max || 0),
    monthlyRentMax:raw.monthly_rent_max ?? undefined,districts:Array.isArray(raw.district_names) ? raw.district_names : [],
    roomsMin:Number(raw.rooms_min || 0),roomsMax:Number(raw.rooms_max || 0),maxCommuteMinutes:Number(raw.max_commute_minutes || 0),
    priorities:Array.isArray(raw.priorities) ? raw.priorities : [],workLabel:raw.work_label || 'Место работы не задано',
    createdAt:raw.created_at,consentToContact:Boolean(raw.consent_to_contact),contact:raw.contact || '',source:'backend'
  }
}

export const proApi={
  async demandProfile():Promise<SharedDemandProfile|null> {
    if (isDemo) {
      const value=readLocal<SharedDemandProfile|null>('geodom-shared-demand-profile-v1',null)
      return value && typeof value.id === 'string' ? value : null
    }
    const raw=await request<BackendDemandProfile|null>('/api/demand-profile')
    return raw ? fromDemand(raw) : null
  },
  async saveDemandProfile(profile:SharedDemandProfile):Promise<SharedDemandProfile> {
    if (isDemo) return profile
    return fromDemand(await request<BackendDemandProfile>('/api/demand-profile',{method:'PUT',body:JSON.stringify(toDemand(profile))}))
  },
  async deleteDemandProfile():Promise<void> {
    if (!isDemo) await request<void>('/api/demand-profile',{method:'DELETE'})
  },
  async status():Promise<ProAccountStatus> {
    if (isDemo) return {user_id:getSession()?.user.id || 'demo',status:'active'}
    return request<ProAccountStatus>('/api/pro/status')
  },
  async startTrial():Promise<ProAccountStatus> {
    if (isDemo) return {user_id:getSession()?.user.id || 'demo',status:'trial'}
    return request<ProAccountStatus>('/api/pro/trial',{method:'POST',body:'{}'})
  },
  async leads(apartmentId:string):Promise<Array<{lead:ProLead;score:number;reasons:string[];stage:LeadStage}>> {
    if (isDemo) return []
    const rows=await request<BackendProLead[]>(`/api/pro/leads?apartment_id=${encodeURIComponent(apartmentId)}`)
    return rows.map(row => ({lead:fromLead(row),score:Number(row.match_score || 0),reasons:row.reasons || [],stage:row.stage || 'new'}))
  },
  async setLeadStage(apartmentId:string,leadId:string,stage:LeadStage):Promise<void> {
    if (isDemo) return
    const leadUserId=leadId.replace(/^user:/,'')
    await request<void>(`/api/pro/leads/${encodeURIComponent(leadUserId)}/stage`,{method:'PUT',body:JSON.stringify({apartment_id:Number(apartmentId),stage})})
  },
  async promotion(apartmentId:string) {
    if (isDemo) return null
    return request<{apartment_id:number;status:string;starts_at:string;ends_at:string}|null>(`/api/pro/promotions/${encodeURIComponent(apartmentId)}`)
  },
  async promote(apartmentId:string,days=7):Promise<void> {
    if (!isDemo) await request(`/api/pro/promotions/${encodeURIComponent(apartmentId)}`,{method:'POST',body:JSON.stringify({days})})
  },
  async cancelPromotion(apartmentId:string):Promise<void> {
    if (!isDemo) await request<void>(`/api/pro/promotions/${encodeURIComponent(apartmentId)}`,{method:'DELETE'})
  }
}
