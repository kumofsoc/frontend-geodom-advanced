export type ListingStatus = 'draft' | 'published' | 'hidden' | 'deleted'
export interface District { id: string; name: string; description: string }
export interface ApartmentPhoto {
  id:string
  url:string
  order:number
  is_cover:boolean
  storage_key?:string
  local_path?:string
  attribution?:string
  rights_status?:string
  publication_allowed?:boolean
  source_url?:string
}
export interface ApartmentFeatures { schools_1km: number; parks_1km: number; kindergartens_1km: number; nearest_school_m: number; nearest_park_m: number; nearest_transport_m: number }
export interface DevelopmentProject { id: string; name: string; type: string; description: string; distance_m: number; status: 'planned' | 'approved' | 'construction' | 'completed' | 'cancelled'; planned_completion_year: number | null; source_url: string; source_name: string; updated_at: string }
export interface Recommendation { score: number | null; reasons: string[]; model_version: string; ml_available: boolean; warning?: string }
export interface Apartment {
  id: string; title: string; price: number; rooms: number; area: number; floor: number; total_floors: number;
  address: string; house_number: string; latitude: number; longitude: number; district: District;
  description: string; photos: ApartmentPhoto[]; source: 'seed' | 'user'; created_at: string;
  status: ListingStatus; owner_id: string | null; features: ApartmentFeatures;
  development_projects: DevelopmentProject[]; recommendation: Recommendation;
  kitchen_area?: number; building_year?: number; balcony?: boolean; renovation?: string; building_type?: string;
  external_id?:string; upstream_source?:string; upstream_source_id?:string; source_url?:string;
  source_updated_at?:string; collected_at?:string; price_m2?:number; complex_name?:string;
  cover_storage_key?:string; photo_count?:number
}
export interface ListingInput { title: string; address: string; district_name: string; price: number; area: number; rooms: number; floor: number; total_floors: number; description: string; kitchen_area?: number; renovation?: string }
export interface User { id: string; login: string }
export type CatalogSort = 'recommended' | 'price_asc' | 'price_desc' | 'area_desc'
export interface CatalogFilters { district: string; maxPrice: number; rooms: number; minArea: number; yearFrom: number; buildingType: string; onlyWithPhotos: boolean; query: string; sort: CatalogSort }

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
  score: number | null
  scores: { schools: number | null; parks: number | null; transport: number | null; ecology: number | null; safety: number | null; commute: number | null; price: number | null }
  contributions?: Partial<Record<'schools' | 'parks' | 'transport' | 'ecology' | 'safety' | 'commute' | 'price', number>>
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

export interface DistrictMarketStats {
  id:number
  name:string
  apartment_count:number
  median_price?:number
  median_price_m2?:number
  median_area?:number
  photo_coverage?:number
  min_price?:number
  max_price?:number
  avg_schools_1km?:number
  avg_kindergartens_1km?:number
  avg_parks_1km?:number
  avg_transport_stops_1km?:number
  updated_at?:string
}


export type HousingIntent='buy'|'rent'

export interface Paginated<T> {
  items:T[]
  limit:number
  offset:number
  hasMore:boolean
}

export interface GeoBounds {
  minLat:number
  maxLat:number
  minLon:number
  maxLon:number
}

export interface DistrictAnalysis {
  id:string
  name:string
  overallScore:number|null
  scores:{
    transport:number|null
    ecology:number|null
    schools:number|null
    safety:number|null
    infrastructure:number|null
  }
  apartmentCount:number
  medianPrice:number|null
  medianPriceM2:number|null
  coverage:number|null
  updatedAt:string|null
  sourceName:string
  sourceUrl:string|null
  warnings:string[]
}

export interface ResidentialComplex {
  id:string
  name:string
  developer:string|null
  address:string|null
  latitude:number|null
  longitude:number|null
  plannedCompletionYear:number|null
  sourceName:string
  sourceId:string
  sourceUrl:string|null
  apartmentCount:number
  minPrice:number|null
  medianPrice:number|null
  updatedAt:string|null
}

export interface MortgageCalculationRequest {
  apartment_price:number
  down_payment:number
  annual_rate:number
  term_years:number
}

export interface MortgageCalculationResponse {
  loan_amount:number
  monthly_payment:number
  total_payment:number
  overpayment:number
  annual_rate:number
  term_years:number
  term_months:number
}

export interface RentVsBuyAssumptions {
  horizon_years:number
  monthly_rent:number
  rent_growth_percent:number
  home_growth_percent:number
  maintenance_percent:number
  investment_return_percent:number
  purchase_costs_percent:number
  sale_costs_percent:number
}

export interface RentVsBuyBackendRequest extends RentVsBuyAssumptions {
  apartment_price:number
  down_payment:number
  annual_rate:number
  mortgage_years:number
}

export interface RentVsBuyBackendResponse {
  mortgage_monthly:number
  rent_monthly:number
  ownership_total:number
  rent_total:number
  break_even_year:number|null
  horizon_years:number
  assumptions:RentVsBuyAssumptions
  source_name:string
  updated_at:string|null
  warnings:string[]
}


export interface FutureDevelopmentMapItem {
  id:string
  name:string
  type:string
  description:string
  latitude:number
  longitude:number
  address:string|null
  status:'planned'|'approved'|'construction'|'completed'|'cancelled'
  plannedCompletionYear:number|null
  sourceUrl:string|null
  sourceName:string
  updatedAt:string|null
}
