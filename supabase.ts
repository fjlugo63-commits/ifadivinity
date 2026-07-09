import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

let supabaseInstance: SupabaseClient;

try {
  if (isSupabaseConfigured) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  } else {
    supabaseInstance = createClient(
      'https://placeholder-project.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTkwMDAwMDAwMH0.placeholder'
    );
  }
} catch {
  supabaseInstance = createClient(
    'https://placeholder-project.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTkwMDAwMDAwMH0.placeholder'
  );
}

export const supabase: SupabaseClient = supabaseInstance;

export type UserRole = 'anon' | 'buyer' | 'seller' | 'admin' | 'super_admin' | 'client' | 'awo' | 'house_admin';

// Centralized table names mapping to actual Supabase tables
export const TABLES = {
  profiles: 'app_340b9f1944_profiles',
  categories: 'app_340b9f1944_categories',
  products: 'app_340b9f1944_products',
  orders: 'app_340b9f1944_orders',
  order_items: 'app_340b9f1944_order_items',
  bookings: 'app_340b9f1944_bookings',
  reviews: 'app_340b9f1944_reviews',
  consultations: 'app_340b9f1944_consultations',
  notifications: 'app_340b9f1944_notifications',
  ifa_houses: 'app_340b9f1944_ifa_houses',
  house_practitioners: 'app_340b9f1944_house_practitioners',
  subscription_entitlements: 'app_340b9f1944_subscription_entitlements',
  house_announcements: 'app_340b9f1944_house_announcements',
  odu_reference: 'app_340b9f1944_odu_reference',
  consultation_odu: 'app_340b9f1944_consultation_odu',
  ire_osogbo: 'app_340b9f1944_ire_osogbo',
  ebo: 'app_340b9f1944_ebo',
  botanica_items: 'app_340b9f1944_botanica_items',
  consultation_notes: 'app_340b9f1944_consultation_notes',
  consultation_summary: 'app_340b9f1944_consultation_summary',
  clients: 'app_340b9f1944_clients',
  client_notes: 'app_340b9f1944_client_notes',
  availability_blocks: 'app_340b9f1944_availability_blocks',
  availability_exceptions: 'app_340b9f1944_availability_exceptions',
  booking_requests: 'app_340b9f1944_booking_requests',
  messages: 'app_340b9f1944_messages',
} as const;

// Product type matching actual DB schema
export interface DBProduct {
  id: string;
  seller_id: string;
  category_id: string | null;
  title: string;
  slug: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  currency: string | null;
  images: string[] | null;
  status: string; // 'active' | 'draft' | 'archived'
  is_digital: boolean | null;
  digital_file_url: string | null;
  stock_quantity: number | null;
  tags: string[] | null;
  service_type: string | null;
  duration_minutes: number | null;
  created_at: string;
  updated_at: string;
}

// Order type matching actual DB schema
export interface DBOrder {
  id: string;
  buyer_id: string | null;
  total_amount: number;
  currency: string | null;
  status: string;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  shipping_address: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Profile type matching actual DB schema
export interface DBProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  bio: string | null;
  phone: string | null;
  avatar_url: string | null;
  verified_egbo: boolean;
  created_at: string;
  updated_at: string;
}

// Booking type matching actual DB schema
export interface DBBooking {
  id: string;
  practitioner_id: string | null;
  client_id: string | null;
  product_id: string | null;
  service_type: string;
  scheduled_at: string;
  duration_minutes: number | null;
  status: string;
  price: number;
  notes: string | null;
  meeting_url: string | null;
  created_at: string;
  updated_at: string;
}

// Category type matching actual DB schema
export interface DBCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
}

// Order item type matching actual DB schema
export interface DBOrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  seller_id: string | null;
  title: string;
  quantity: number;
  price: number;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  full_name: string | null;
  created_at: string;
}

// Consultation type for Awo Dashboard
export interface DBConsultation {
  id: string;
  awo_id: string;
  client_id: string | null;
  client_name: string;
  consultation_type: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  notes: string | null;
  meeting_url: string | null;
  created_at: string;
  updated_at: string;
}

// Notification type for Awo Dashboard
export interface DBNotification {
  id: string;
  user_id: string;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Ifa House type
export interface DBIfaHouse {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
}

// House Practitioner membership
export interface DBHousePractitioner {
  id: string;
  house_id: string;
  practitioner_id: string;
  role: string;
  joined_at: string;
}

// Subscription Entitlement
export interface DBSubscriptionEntitlement {
  id: string;
  user_id: string | null;
  house_id: string | null;
  entitlement_key: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

// House Announcement
export interface DBAnnouncement {
  id: string;
  house_id: string;
  author_id: string;
  title: string;
  content: string;
  created_at: string;
}

// Odu Reference type
export interface DBOduReference {
  id: number;
  name: string;
  aliases: string[];
  binary_pattern: string;
  category: string;
  position: number;
  description: string | null;
  created_at: string;
}

// Ire/Osogbo outcome type
export interface DBIreOsogbo {
  id: string;
  consultation_id: string;
  outcome_type: 'ire' | 'osogbo';
  outcome_subtype: string;
  confirmed_by: string;
  confirmed_at: string;
  updated_by: string | null;
  updated_at: string | null;
  update_reason: string | null;
  previous_outcome_type: string | null;
  previous_outcome_subtype: string | null;
  created_at: string;
}

// Ire/Osogbo sub-type definition
export interface IreOsogboSubtype {
  key: string;
  label: string;
  meaning: string;
}

// Ebo type
export interface DBEbo {
  id: string;
  consultation_id: string;
  ebo_category: string;
  ebo_items: string[];
  instructions: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  confirmed_by: string;
  confirmed_at: string;
  updated_by: string | null;
  updated_at: string | null;
  update_reason: string | null;
  previous_category: string | null;
  previous_items: string[] | null;
  previous_instructions: string | null;
  created_at: string;
}

// Ebo category definition
export interface EboCategory {
  key: string;
  label: string;
  meaning: string;
  icon: string;
}

// Ebo item definition
export interface EboItem {
  key: string;
  label: string;
  meaning: string;
  botanica_available?: boolean;
  botanica_price?: number | null;
}

// Ebo recommendations
export interface EboRecommendations {
  categories: string[];
  items: string[];
  outcome_type: string;
  outcome_subtype: string;
}

// Consultation Notes type
export interface DBConsultationNote {
  id: string;
  consultation_id: string;
  content: string;
  formatted_content: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Consultation Summary type
export interface DBConsultationSummary {
  id: string;
  consultation_id: string;
  summary_text: string;
  client_summary: string | null;
  generated_from: {
    odu: { id: string; name: string; aliases: string[] } | null;
    outcome: { type: string; subtype: string; category: string } | null;
    ebo: { category: string; items: string[]; instructions: string | null } | null;
    notes: string | null;
  };
  confirmed_by: string | null;
  confirmed_at: string | null;
  updated_by: string | null;
  updated_at: string | null;
  created_at: string;
}

// Availability Block type
export interface DBAvailabilityBlock {
  id: string;
  awo_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_break: boolean;
  timezone: string;
  created_at: string;
  updated_at: string;
}

// Availability Exception type
export interface DBAvailabilityException {
  id: string;
  awo_id: string;
  exception_date: string;
  exception_type: 'day_off' | 'extended_hours' | 'special_window';
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

// Booking Request type
export interface DBBookingRequest {
  id: string;
  client_id: string;
  awo_id: string;
  requested_at: string;
  duration_minutes: number;
  service_type: string;
  status: 'pending' | 'accepted' | 'declined' | 'proposed_new_time';
  proposed_time: string | null;
  client_message: string | null;
  awo_response: string | null;
  consultation_id: string | null;
  client_timezone: string;
  client_name?: string;
  created_at: string;
  updated_at: string;
}

// Client Management types
export interface DBClient {
  id: string;
  awo_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  timezone: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  // Enriched fields from API
  total_consultations?: number;
  last_consultation_date?: string | null;
  has_upcoming?: boolean;
}

export interface DBClientNote {
  id: string;
  client_id: string;
  awo_id: string;
  content: string;
  formatted_content: string | null;
  created_at: string;
  updated_at: string;
}

// Consultation Odu type
export interface DBConsultationOdu {
  id: string;
  consultation_id: string;
  odu_id: number;
  confirmed_by: string;
  confirmed_at: string;
  updated_by: string | null;
  updated_at: string | null;
  update_reason: string | null;
  previous_odu_id: number | null;
  created_at: string;
  odu?: DBOduReference;
}

// Message type for client-awo messaging
export interface DBMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  consultation_id: string | null;
  message_text: string;
  read_at: string | null;
  created_at: string;
}