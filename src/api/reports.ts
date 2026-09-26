import { eventsApi } from './events'
import type { RecommendationResponse } from '../types'

export const reportsApi={
  async trackOpen(response:RecommendationResponse,signal?:AbortSignal) {
    const first=response.items[0]
    if (!first) return
    await eventsApi.send({request_id:response.request_id,event:'report',entity_type:'apartment',entity_id:first.apartment_id,position:1},signal)
  }
}
