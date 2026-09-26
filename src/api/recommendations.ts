import { isDemo,apiBase } from './config'
import { request } from './http'
import { demoDelay } from './common'
import { demoRecommend,normalizeRecommendation,rememberRecommendation } from '../lib/recommendations'
import type { RecommendationRequest,RecommendationResponse } from '../types'

export const recommendationsApi={
  async recommend(input:RecommendationRequest,signal?:AbortSignal):Promise<RecommendationResponse> {
    const response=isDemo
      ? (await demoDelay(),demoRecommend(input))
      : normalizeRecommendation(await request<RecommendationResponse>('/api/v1/recommendations',{method:'POST',body:JSON.stringify(input),signal}),apiBase)
    rememberRecommendation(response)
    return response
  }
}
