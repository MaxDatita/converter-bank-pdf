import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase"

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN!
const CRON_SECRET = process.env.CRON_SECRET!

type MPStatus = "authorized" | "paused" | "cancelled" | "pending"

interface MPPreapproval {
  id: string
  status: MPStatus
}

interface UserSubscription {
  id: string
  plan: string
  mp_subscription_id: string
  mp_subscription_status: string
  grace_period_until: string | null
}

async function fetchPreapprovalStatus(preapprovalId: string): Promise<MPStatus | null> {
  try {
    const response = await fetch(
      `https://api.mercadopago.com/preapproval/${preapprovalId}`,
      {
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        },
      }
    )

    if (!response.ok) {
      console.error(`[cron] Error fetching preapproval ${preapprovalId}: ${response.status}`)
      return null
    }

    const data: MPPreapproval = await response.json()
    return data.status
  } catch (error) {
    console.error(`[cron] Exception fetching preapproval ${preapprovalId}:`, error)
    return null
  }
}

export async function GET(request: NextRequest) {
  // Verificar que la llamada viene de Vercel Cron (o de un llamado autorizado manualmente)
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const supabaseAdmin = createSupabaseAdminClient()
  const now = new Date()

  // Traer todos los usuarios con suscripción MP registrada (cualquier estado)
  // Verificamos todos, no solo 'authorized', para detectar reactivaciones también
  const { data: users, error: fetchError } = await supabaseAdmin
    .from("user_profiles")
    .select("id, plan, mp_subscription_id, mp_subscription_status, grace_period_until")
    .not("mp_subscription_id", "is", null)

  if (fetchError) {
    console.error("[cron] Error fetching users:", fetchError)
    return NextResponse.json({ error: "Error consultando la base de datos" }, { status: 500 })
  }

  if (!users || users.length === 0) {
    return NextResponse.json({ message: "No hay suscripciones para verificar", checked: 0 })
  }

  const results = {
    checked: users.length,
    updated: 0,
    errors: 0,
    details: [] as Array<{ userId: string; mpId: string; dbStatus: string; mpStatus: string; action: string }>,
  }

  for (const user of users as UserSubscription[]) {
    const realStatus = await fetchPreapprovalStatus(user.mp_subscription_id)

    if (realStatus === null) {
      results.errors++
      continue
    }

    const dbStatus = user.mp_subscription_status

    // Sin cambios: no hacer nada
    if (realStatus === dbStatus) continue

    // Hay discrepancia entre DB y MP → actualizar
    const updateData: Record<string, unknown> = {
      mp_subscription_status: realStatus,
      subscription_updated_at: now.toISOString(),
    }

    if (realStatus === "authorized") {
      // Reactivación: limpiar período de gracia
      updateData.grace_period_until = null
    } else if (realStatus === "paused" || realStatus === "cancelled") {
      // La DB tenía 'authorized' pero MP dice que no → otorgar gracia si no hay una activa
      const existingGrace = user.grace_period_until ? new Date(user.grace_period_until) : null
      if (!existingGrace || existingGrace <= now) {
        const graceUntil = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
        updateData.grace_period_until = graceUntil.toISOString()
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("user_profiles")
      .update(updateData)
      .eq("id", user.id)

    if (updateError) {
      console.error(`[cron] Error updating user ${user.id}:`, updateError)
      results.errors++
    } else {
      results.updated++
      results.details.push({
        userId: user.id,
        mpId: user.mp_subscription_id,
        dbStatus,
        mpStatus: realStatus,
        action: realStatus === "authorized" ? "reactivated" : "grace_period_set",
      })
    }
  }

  console.log("[cron] check-subscriptions completado:", results)

  return NextResponse.json({
    message: "Verificación completada",
    ...results,
    // No exponer detalles de usuarios en producción, solo el resumen
    details: process.env.NODE_ENV === "development" ? results.details : undefined,
  })
}
