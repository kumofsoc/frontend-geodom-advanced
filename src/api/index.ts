import { apartmentsApi } from './apartments'
import { authApi } from './auth'
import { complexesApi } from './complexes'
import { districtsApi } from './districts'
import { eventsApi } from './events'
import { geoApi } from './geo'
import { mortgageApi } from './mortgage'
import { proApi } from './pro'
import { recommendationsApi } from './recommendations'
import { rentApi } from './rent'
import { reportsApi } from './reports'
import { isDemo } from './config'

export { ApiError } from './http'
export { isDemo }

export const api={
  session:authApi.session,
  register:authApi.register,
  login:authApi.login,
  currentUser:authApi.currentUser,
  logout:authApi.logout,

  recommend:recommendationsApi.recommend,
  event:eventsApi.send,

  list:apartmentsApi.list.bind(apartmentsApi),
  apartmentsPage:apartmentsApi.page.bind(apartmentsApi),
  detail:apartmentsApi.detail.bind(apartmentsApi),
  mine:apartmentsApi.mine.bind(apartmentsApi),
  create:apartmentsApi.create.bind(apartmentsApi),
  update:apartmentsApi.update.bind(apartmentsApi),
  hide:apartmentsApi.hide.bind(apartmentsApi),
  upload:apartmentsApi.upload.bind(apartmentsApi),

  geoViewport:geoApi.viewport,
  async geoObjects() {
    return geoApi.viewport({minLat:55.85,maxLat:56.18,minLon:92.55,maxLon:93.25,limit:1200})
  },

  districts:districtsApi.directory,
  districtStats:districtsApi.stats,
  districtAnalysis:districtsApi.analysis,
  complexes:complexesApi.list,

  mortgageCalculate:mortgageApi.calculate,
  rentVsBuy:rentApi.calculate,
  reportOpen:reportsApi.trackOpen,

  demandProfile:proApi.demandProfile,
  saveDemandProfile:proApi.saveDemandProfile,
  deleteDemandProfile:proApi.deleteDemandProfile,
  proStatus:proApi.status,
  startProTrial:proApi.startTrial,
  proLeads:proApi.leads,
  setProLeadStage:proApi.setLeadStage,
  promotion:proApi.promotion,
  promote:proApi.promote,
  cancelPromotion:proApi.cancelPromotion
}
