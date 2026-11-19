export type ServiceRequestStatus = 'pending' | 'negotiating' | 'accepted' | 'rejected' | 'cancelled'
export type RequestAction = 'offer' | 'accept' | 'reject' | 'cancel'
export type RequestRole = 'client' | 'worker'

export interface ServiceRequestSummary {
  id: string
  client_name: string
  worker_name: string
  category_name: string
  description: string
  requested_date: string
  requested_time: string
  status: ServiceRequestStatus
  agreed_amount_bob: number | null
  created_at: string
}

export interface ServiceRequestListItem extends ServiceRequestSummary {
  current_offer: { amount_bob: number } | null
}

export interface ServiceOffer {
  id: string
  offered_by: string
  amount_bob: number
  note: string | null
  created_at: string
}

export interface ServiceRequestDetail extends ServiceRequestSummary {
  journey_status?: JourneyStatus | null
  client_id: string
  worker_id: string
  revision: number
  current_offer_id: string | null
  agreed_at: string | null
  decision_note: string | null
  offers: ServiceOffer[]
  location: { address: string; reference: string | null } | null
}

export interface ServiceRequestInput {
  requestId: string
  workerId: string
  categoryId: string
  description: string
  date: string
  time: string
  address: string
  reference: string
  budget: number | null
}
import type { JourneyStatus } from './serviceJourney'

