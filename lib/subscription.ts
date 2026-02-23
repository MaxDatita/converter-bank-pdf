import { createSupabaseAdminClient } from "./supabase"

type Plan = "free" | "pro" | "premium"

interface EffectivePlanResult {
  effectivePlan: Plan
  subscriptionLapsed: boolean
}

interface UserProfileForPlan {
  plan: Plan
  mp_subscription_status: string | null
  grace_period_until: string | null
}

/**
 * Determina el plan efectivo de un usuario basado en el estado de su suscripción MP.
 * Función pura — no hace llamadas a DB.
 *
 * Lógica:
 * - Si el plan es "free", siempre retorna "free" sin importar el estado de MP
 * - Si el plan es pro/premium con suscripción "authorized" → retorna el plan
 * - Si el plan es pro/premium con período de gracia activo → retorna el plan
 * - Si el plan es pro/premium sin suscripción activa y sin gracia → retorna "free" + subscriptionLapsed=true
 */
export function getEffectivePlan(userProfile: UserProfileForPlan): EffectivePlanResult {
  const { plan, mp_subscription_status, grace_period_until } = userProfile

  // Los usuarios free siempre son free
  if (plan === "free") {
    return { effectivePlan: "free", subscriptionLapsed: false }
  }

  // Suscripción autorizada y activa
  if (mp_subscription_status === "authorized") {
    return { effectivePlan: plan, subscriptionLapsed: false }
  }

  // Verificar período de gracia (cubre reintentos de cobro y tiempo para actualizar método de pago)
  if (grace_period_until) {
    const graceUntil = new Date(grace_period_until)
    if (graceUntil > new Date()) {
      return { effectivePlan: plan, subscriptionLapsed: false }
    }
  }

  // Sin suscripción activa y sin período de gracia válido → tratar como free
  return { effectivePlan: "free", subscriptionLapsed: true }
}

/**
 * Versión async de getEffectivePlan — consulta la DB para obtener el perfil del usuario.
 * Usar en rutas que no tienen el perfil cargado previamente.
 */
export async function getEffectivePlanForUser(userId: string): Promise<EffectivePlanResult> {
  try {
    const supabaseAdmin = createSupabaseAdminClient()

    const { data: profile, error } = await supabaseAdmin
      .from("user_profiles")
      .select("plan, mp_subscription_status, grace_period_until")
      .eq("id", userId)
      .single()

    if (error || !profile) {
      console.error("Error fetching user profile for plan check:", error)
      return { effectivePlan: "free", subscriptionLapsed: false }
    }

    return getEffectivePlan({
      plan: profile.plan as Plan,
      mp_subscription_status: profile.mp_subscription_status ?? null,
      grace_period_until: profile.grace_period_until ?? null,
    })
  } catch (error) {
    console.error("Error in getEffectivePlanForUser:", error)
    return { effectivePlan: "free", subscriptionLapsed: false }
  }
}
