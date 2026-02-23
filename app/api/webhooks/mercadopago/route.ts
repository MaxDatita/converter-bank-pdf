import { NextRequest, NextResponse } from "next/server"
import { createHmac } from "crypto"
import { createSupabaseAdminClient } from "@/lib/supabase"

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN!
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET!

// Tipos de estados de suscripción MP
type MPSubscriptionStatus = "authorized" | "paused" | "cancelled" | "pending"

interface MPPreapproval {
  id: string
  preapproval_plan_id: string
  status: MPSubscriptionStatus
  payer_id: number
  reason: string
}

/**
 * Verifica la firma HMAC-SHA256 del webhook de Mercado Pago.
 * Template: "id:{data.id};request-id:{x-request-id};ts:{ts};"
 */
function verifyWebhookSignature(
  request: NextRequest,
  body: Record<string, unknown>
): boolean {
  try {
    const xSignature = request.headers.get("x-signature")
    const xRequestId = request.headers.get("x-request-id")

    if (!xSignature || !xRequestId || !MP_WEBHOOK_SECRET) {
      return false
    }

    // Parsear la firma: "ts=xxx,v1=yyy"
    const parts = xSignature.split(",")
    let ts = ""
    let v1 = ""
    for (const part of parts) {
      const [key, value] = part.split("=")
      if (key === "ts") ts = value
      if (key === "v1") v1 = value
    }

    if (!ts || !v1) return false

    const dataId = (body.data as Record<string, unknown>)?.id as string | undefined
    const template = `id:${dataId};request-id:${xRequestId};ts:${ts};`

    const expectedSignature = createHmac("sha256", MP_WEBHOOK_SECRET)
      .update(template)
      .digest("hex")

    return expectedSignature === v1
  } catch {
    return false
  }
}

/**
 * Consulta el estado completo del preapproval en la API de MP.
 * No confiar solo en el payload del webhook.
 */
async function fetchPreapprovalFromMP(preapprovalId: string): Promise<MPPreapproval | null> {
  try {
    const response = await fetch(
      `https://api.mercadopago.com/preapproval/${preapprovalId}`,
      {
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    )

    if (!response.ok) {
      console.error("Error fetching preapproval from MP:", response.status, await response.text())
      return null
    }

    return response.json()
  } catch (error) {
    console.error("Error fetching preapproval:", error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Verificar firma del webhook
    if (!verifyWebhookSignature(request, body)) {
      console.warn("Webhook MP: firma inválida")
      return NextResponse.json({ error: "Firma inválida" }, { status: 401 })
    }

    // Solo procesar eventos de suscripción
    const eventType = body.type as string
    if (eventType !== "subscription_preapproval") {
      // Retornar 200 para eventos no relevantes (MP espera 200 para no reintentar)
      return NextResponse.json({ received: true })
    }

    const preapprovalId = (body.data as Record<string, unknown>)?.id as string | undefined
    if (!preapprovalId) {
      return NextResponse.json({ error: "ID de preapproval no encontrado" }, { status: 400 })
    }

    // Fetch del estado real desde MP (no confiar solo en el payload)
    const preapproval = await fetchPreapprovalFromMP(preapprovalId)
    if (!preapproval) {
      return NextResponse.json({ error: "No se pudo obtener el preapproval" }, { status: 500 })
    }

    const supabaseAdmin = createSupabaseAdminClient()

    // Buscar usuario en DB por mp_subscription_id
    const { data: userProfile, error: findError } = await supabaseAdmin
      .from("user_profiles")
      .select("id, plan, mp_subscription_status, grace_period_until")
      .eq("mp_subscription_id", preapprovalId)
      .single()

    if (findError || !userProfile) {
      // Si no encontramos al usuario, igualmente retornar 200 (puede ser de otro sistema)
      console.warn("Webhook MP: no se encontró usuario con mp_subscription_id:", preapprovalId)
      return NextResponse.json({ received: true })
    }

    const now = new Date()
    const updateData: Record<string, unknown> = {
      mp_subscription_status: preapproval.status,
      subscription_updated_at: now.toISOString(),
    }

    if (preapproval.status === "authorized") {
      // Suscripción activa: limpiar período de gracia
      updateData.grace_period_until = null
    } else if (
      preapproval.status === "paused" ||
      preapproval.status === "cancelled"
    ) {
      // Solo establecer período de gracia si no hay uno activo
      const existingGrace = userProfile.grace_period_until
        ? new Date(userProfile.grace_period_until)
        : null

      if (!existingGrace || existingGrace <= now) {
        // Otorgar 3 días de gracia (cubre reintentos de cobro de MP)
        const graceUntil = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
        updateData.grace_period_until = graceUntil.toISOString()
      }
      // Si ya hay gracia activa, mantenerla sin cambios
    }

    const { error: updateError } = await supabaseAdmin
      .from("user_profiles")
      .update(updateData)
      .eq("id", userProfile.id)

    if (updateError) {
      console.error("Webhook MP: error actualizando user_profiles:", updateError)
      // Retornar 500 para que MP reintente
      return NextResponse.json({ error: "Error de base de datos" }, { status: 500 })
    }

    console.log(
      `Webhook MP: actualizado usuario ${userProfile.id} → status=${preapproval.status}`
    )

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Error en webhook de Mercado Pago:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
