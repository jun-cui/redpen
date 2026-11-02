// Hand-maintained types for the Supabase schema in supabase/migrations.
// Shaped like `supabase gen types typescript` output, but jsonb columns use the
// precise domain types from ./types instead of a generic Json.
// Row shapes are type aliases, not interfaces: supabase-js constrains rows to
// Record<string, unknown>, which interfaces do not satisfy (no implicit index signature),
// and the whole client would silently degrade to `never`.

import type {
  CardCategory,
  CardOrigin,
  Correction,
  FsrsSnapshot,
  Grading,
  KeyPoint,
  MistakeOrigin,
  MistakeType,
  PointResult,
  SubjectCode,
} from './types'

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type ProfileRow = {
  id: string
  display_name: string | null
  desired_retention: number
  created_at: string
  updated_at: string
}

export type TopicRow = {
  id: string
  user_id: string
  subject: SubjectCode
  name: string
  unit: string | null
  position: number
  archived: boolean
  created_at: string
}

export type CardRow = {
  id: string
  user_id: string
  subject: SubjectCode
  topic_id: string | null
  question: string
  key_points: KeyPoint[]
  origin: CardOrigin
  suspended: boolean
  fsrs_state: number
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  last_review: string | null
  category: CardCategory
  last_score: number | null
  created_at: string
  updated_at: string
}

export type ReviewRow = {
  id: string
  user_id: string
  card_id: string
  reviewed_at: string
  answer: string
  grading: Grading
  results: PointResult[]
  corrections: Correction[]
  missing: string[]
  points_hit: number
  points_total: number
  easy: boolean
  rating: 1 | 2 | 3 | 4
  card_before: FsrsSnapshot
  duration_ms: number | null
  amended_at: string | null
}

export type MistakeRow = {
  id: string
  user_id: string
  created_at: string
  origin: MistakeOrigin
  subject: SubjectCode | null
  topic_id: string | null
  card_id: string | null
  review_id: string | null
  key_point_id: string | null
  source: string | null
  what_went_wrong: string
  fix: string
  mistake_type: MistakeType | null
  raw_text: string | null
  flashcard_id: string | null
}

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: Optional<ProfileRow, 'display_name' | 'desired_retention' | 'created_at' | 'updated_at'>
        Update: Partial<ProfileRow>
        Relationships: []
      }
      topics: {
        Row: TopicRow
        Insert: Optional<TopicRow, 'id' | 'user_id' | 'unit' | 'position' | 'archived' | 'created_at'>
        Update: Partial<TopicRow>
        Relationships: []
      }
      cards: {
        Row: CardRow
        Insert: Optional<
          CardRow,
          | 'id'
          | 'user_id'
          | 'topic_id'
          | 'origin'
          | 'suspended'
          | 'fsrs_state'
          | 'due'
          | 'stability'
          | 'difficulty'
          | 'elapsed_days'
          | 'scheduled_days'
          | 'learning_steps'
          | 'reps'
          | 'lapses'
          | 'last_review'
          | 'category'
          | 'last_score'
          | 'created_at'
          | 'updated_at'
        >
        Update: Partial<CardRow>
        Relationships: [
          {
            foreignKeyName: 'cards_topic_id_user_id_subject_fkey'
            columns: ['topic_id', 'user_id', 'subject']
            isOneToOne: false
            referencedRelation: 'topics'
            referencedColumns: ['id', 'user_id', 'subject']
          },
        ]
      }
      reviews: {
        Row: ReviewRow
        Insert: Optional<
          ReviewRow,
          'id' | 'user_id' | 'reviewed_at' | 'answer' | 'corrections' | 'missing' | 'easy' | 'duration_ms' | 'amended_at'
        >
        Update: Partial<ReviewRow>
        Relationships: [
          {
            foreignKeyName: 'reviews_card_id_user_id_fkey'
            columns: ['card_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'cards'
            referencedColumns: ['id', 'user_id']
          },
        ]
      }
      mistakes: {
        Row: MistakeRow
        Insert: Optional<
          MistakeRow,
          | 'id'
          | 'user_id'
          | 'created_at'
          | 'subject'
          | 'topic_id'
          | 'card_id'
          | 'review_id'
          | 'key_point_id'
          | 'source'
          | 'mistake_type'
          | 'raw_text'
          | 'flashcard_id'
        >
        Update: Partial<MistakeRow>
        Relationships: [
          {
            foreignKeyName: 'mistakes_topic_id_user_id_subject_fkey'
            columns: ['topic_id', 'user_id', 'subject']
            isOneToOne: false
            referencedRelation: 'topics'
            referencedColumns: ['id', 'user_id', 'subject']
          },
          {
            foreignKeyName: 'mistakes_card_id_user_id_fkey'
            columns: ['card_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'cards'
            referencedColumns: ['id', 'user_id']
          },
          {
            foreignKeyName: 'mistakes_review_id_user_id_fkey'
            columns: ['review_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'reviews'
            referencedColumns: ['id', 'user_id']
          },
          {
            foreignKeyName: 'mistakes_flashcard_id_user_id_fkey'
            columns: ['flashcard_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'cards'
            referencedColumns: ['id', 'user_id']
          },
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      record_review: {
        Args: {
          p_card_id: string
          p_results: PointResult[]
          p_card_after: FsrsSnapshot
          p_rating: number
          p_easy?: boolean
          p_answer?: string
          p_grading?: Grading
          /** null keeps the review's existing value when amending (p_review_id). */
          p_corrections?: Correction[] | null
          /** null keeps the review's existing value when amending (p_review_id). */
          p_missing?: string[] | null
          p_reviewed_at?: string
          p_duration_ms?: number
          p_review_id?: string
          /** A new review's id: sent again, the saved review is returned. Ignored when amending. */
          p_id?: string
          /** The reps the client scheduled from; ignored when amending. */
          p_expected_reps?: number
        }
        Returns: { review: ReviewRow; card: CardRow }
      }
      compute_card_category: {
        Args: { p_card_id: string }
        Returns: CardCategory
      }
      add_example_cards: {
        Args: Record<string, never>
        Returns: number
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
