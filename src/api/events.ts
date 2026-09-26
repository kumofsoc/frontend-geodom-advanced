import { isDemo } from './config'
import { request } from './http'
import { logDemoEvent } from '../lib/recommendations'
import type { InteractionPayload } from '../types'

export const eventsApi={
  async send(payload:InteractionPayload,signal?:AbortSignal):Promise<void> {
    if (isDemo) { logDemoEvent(payload);return }
    await request<void>('/api/v1/events',{method:'POST',body:JSON.stringify(payload),signal})
  }
}
