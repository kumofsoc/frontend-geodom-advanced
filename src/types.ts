export type ListingStatus = 'draft' | 'published' | 'hidden' | 'deleted'
export interface District { id: string; name: string; description: string }
export interface ApartmentPhoto { id: string; url: string; order: number; is_cover: boolean }
export interface ApartmentFeatures { schools_1km: number; parks_1km: number; kindergartens_1km: number; nearest_school_m: number; nearest_park_m: number; nearest_transport_m: number }
export interface DevelopmentProject { id: string; name: string; type: string; description: string; distance_m: number; status: 'planned' | 'approved' | 'construction' | 'completed' | 'cancelled'; planned_completion_year: number | null; source_url: string; source_name: string; updated_at: string }
export interface Recommendation { score: number | null; reasons: string[]; model_version: string; ml_available: boolean; warning?: string }
export interface Apartment {
  id: string; title: string; price: number; rooms: number; area: number; floor: number; total_floors: number;
  address: string; house_number: string; latitude: number; longitude: number; district: District;
  description: string; photos: ApartmentPhoto[]; source: 'seed' | 'user'; created_at: string;
  status: ListingStatus; owner_id: string | null; features: ApartmentFeatures;
  development_projects: DevelopmentProject[]; recommendation: Recommendation;
  kitchen_area?: number; building_year?: number; balcony?: boolean; renovation?: string; building_type?: string
}
export interface ListingInput { title: string; address: string; price: number; area: number; rooms: number; floor: number; total_floors: number; description: string; kitchen_area?: number; renovation?: string }
export interface User { id: string; login: string }
export type CatalogSort = 'recommended' | 'price_asc' | 'price_desc' | 'area_desc'
export interface CatalogFilters { district: string; maxPrice: number; rooms: number; query: string; sort: CatalogSort }

export interface RecommendationRequest {
  budget_max: number
  down_payment: number
  family: { adults: number; children: number }
  work_location: { lat: number; lon: number } | null
  max_commute_minutes: number
  priorities: { schools: number; parks: number; transport: number; ecology: number; safety: number }
  limit: number
}
export interface RecommendationItem {
  apartment_id: string | number
  title: string
  price: number
  price_m2: number
  predicted_price_m2: number | null
  score: number
  scores: { schools: number | null; parks: number | null; transport: number | null; ecology: number | null; safety: number | null; commute: number | null; price: number | null }
  commute_minutes: number | null
  reasons: string[]
  warnings: string[]
  cover_image_url: string | null
}
export interface RecommendationResponse {
  request_id: string
  model_version: string
  scoring_version: string
  ml_available: boolean
  warnings: string[]
  items: RecommendationItem[]
}
export type InteractionEvent = 'impression' | 'click' | 'save' | 'compare' | 'report'
export interface InteractionPayload { request_id: string; event: InteractionEvent; entity_type: 'apartment'; entity_id: string | number; position: number }
