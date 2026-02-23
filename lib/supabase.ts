import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export function createSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey)
}

export function createSupabaseAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY not available, using anon client")
    return createClient(supabaseUrl, supabaseAnonKey)
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Tipos para la base de datos
export interface User {
  id: string
  email: string
  name?: string
  avatar_url?: string
  google_id?: string
  plan: "free" | "pro" | "premium"
  mp_subscription_id?: string | null
  mp_subscription_status?: "authorized" | "paused" | "cancelled" | "pending" | null
  subscription_updated_at?: string | null
  grace_period_until?: string | null
  created_at: string
  updated_at: string
}

export interface MonthlyUsage {
  id: string
  user_id: string
  year: number
  month: number
  pages_processed: number
  files_processed: number
  created_at: string
  updated_at: string
}

export interface DailyUsage {
  id: string
  user_id: string
  date: string
  pages_processed: number
  files_processed: number
  created_at: string
  updated_at: string
}

export interface ConversionHistory {
  id: string
  user_id: string
  filename: string
  bank_name?: string
  account_type?: string
  period?: string
  pages_count: number
  transactions_count: number
  created_at: string
}

// Límites por plan
export const PLAN_LIMITS = {
  free: {
    dailyPages: 3, // Elevado de 2 a 3 páginas por día
    monthlyPages: null, // Sin límite mensual
    canEdit: false,
    multipleFiles: false,
    aiChat: false,
    maxEditLines: 3, // Permitir editar las primeras 3 líneas
  },
  pro: {
    dailyPages: null, // Sin límite diario
    monthlyPages: 120,
    canEdit: true,
    multipleFiles: false,
    aiChat: false,
    maxEditLines: null, // Sin límite de líneas editables
  },
  premium: {
    dailyPages: null, // Sin límite diario
    monthlyPages: 300,
    canEdit: true,
    multipleFiles: true,
    aiChat: true,
    maxEditLines: null, // Sin límite de líneas editables
  },
} as const

// Límites para usuarios anónimos
export const ANONYMOUS_LIMITS = {
  dailyPages: 1, // Solo 1 página por día
  monthlyPages: null, // Sin límite mensual (para compatibilidad)
  canEdit: false,
  multipleFiles: false,
  aiChat: false,
  maxEditLines: 3, // Permitir editar las primeras 3 líneas
} as const

// Tipo unificado para todos los límites
export type PlanLimits = typeof PLAN_LIMITS[keyof typeof PLAN_LIMITS] | typeof ANONYMOUS_LIMITS

// Función helper para obtener límites según el tipo de usuario
export function getPlanLimits(userType: "free" | "pro" | "premium" | "anonymous"): PlanLimits {
  if (userType === "anonymous") {
    return ANONYMOUS_LIMITS
  }
  return PLAN_LIMITS[userType]
}
