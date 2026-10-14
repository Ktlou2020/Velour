// Client-side shapes for the reviews API (mirror lib/reviews.ts / lib/reviews-overview.ts).
import type { CriterionKey, Ratings } from '@/lib/review-criteria';

export interface ReviewPerson {
  id: string;
  username: string;
  name: string;
  photo: string | null;
  city: string | null;
  age: number | null;
  isCouple: boolean;
}

export interface ReviewSummary {
  count: number;
  avg: number | null;
  criteria: Record<CriterionKey, number | null>;
  isNew: boolean;
}

export interface ReviewCardData {
  id: string;
  reviewer: ReviewPerson;
  ratings: Ratings;
  rating: number;
  comment: string;
  isExplicit: boolean;
  metIn: string;
  response: string | null;
  responseAt: string | null;
  publishedAt: string | null;
  hidden: boolean;
}

export interface ViewerState {
  isOwner: boolean;
  canRequest?: boolean;
  reason?: string;
  reasonText?: string;
  pendingRequestFromThem?: { id: string } | null;
  myReview?: { id: string; published: boolean; requestId: string | null } | null;
}

export interface UserReviewsResponse {
  summary: ReviewSummary;
  reviews: ReviewCardData[];
  page: number;
  pages: number;
  total: number;
  viewer: ViewerState;
}

export interface ReviewsOverview {
  summary: ReviewSummary;
  toWrite: { id: string; requester: ReviewPerson; createdAt: string; expiresAt: string }[];
  drafts: { id: string; requestId: string | null; reviewee: ReviewPerson; createdAt: string; publishesOn: string }[];
  sent: { id: string; reviewer: ReviewPerson; status: 'PENDING' | 'EXPIRED' | 'COMPLETED'; createdAt: string; expiresAt: string }[];
  awaiting: { id: string; reviewer: ReviewPerson; publishesOn: string; writeRequestId: string | null }[];
  written: { id: string; reviewee: ReviewPerson; publishedAt: string; rating: number }[];
}

export interface EligiblePerson {
  person: ReviewPerson;
  conversationId: string;
  messages: { mine: number; theirs: number };
  canRequest: boolean;
  reason?: string;
  reasonText?: string;
  prompt: boolean;
}
