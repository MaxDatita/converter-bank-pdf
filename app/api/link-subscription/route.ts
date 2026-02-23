import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase"

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN!
const MP_PRO_PLAN_ID = process.env.MP_PRO_PLAN_ID!
const MP_PREMIUM_PLAN_ID = process.env.MP_PREMIUM_PLAN_ID!

interface MPPreapproval {
  id: string
  preapproval_plan_id: string
  status: "authorized" | "paused" | "cancelled" | "pending"
  reason: string
}

/**
 * POST /api/link-subscription
 * Vincula un preapproval de Mercado Pago a la cuenta del usuario autenticado.
 *
 * Body: { preapprovalId: string }
 * Headers: Authorization: Bearer <token>
 */
export async function POST(request: NextRequest) {
  try {
    // Autenticar usuario
    const authHeader = request.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Autenticación requerida" }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabaseAdmin = createSupabaseAdminClient()

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 })
    }

    // Obtener preapprovalId del body
    const body = await request.json()
    const { preapprovalId } = body as { preapprovalId?: string }

    if (!preapprovalId) {
      return NextResponse.json(
        { error: "preapprovalId es requerido" },
        { status: 400 }
      )
    }

    if (!MP_ACCESS_TOKEN) {
      console.error("MP_ACCESS_TOKEN no configurado")
      return NextResponse.json(
        { error: "Configuración de pagos incompleta" },
        { status: 500 }
      )
    }

    // Verificar que el preapproval existe y es válido en MP
    const mpResponse = await fetch(
      `https://api.mercadopago.com/preapproval/${preapprovalId}`,
      {
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    )

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text()
      console.error("Error verificando preapproval en MP:", mpResponse.status, errorText)
      return NextResponse.json(
        { error: "No se pudo verificar la suscripción en Mercado Pago" },
        { status: 400 }
      )
    }

    const preapproval: MPPreapproval = await mpResponse.json()

    // Verificar que la suscripción esté autorizada
    if (preapproval.status !== "authorized") {
      return NextResponse.json(
        { error: `La suscripción no está activa (estado: ${preapproval.status})` },
        { status: 400 }
      )
    }

    // Determinar el plan según el preapproval_plan_id
    let plan: "pro" | "premium"
    if (preapproval.preapproval_plan_id === MP_PREMIUM_PLAN_ID) {
      plan = "premium"
    } else if (preapproval.preapproval_plan_id === MP_PRO_PLAN_ID) {
      plan = "pro"
    } else {
      console.error(
        "preapproval_plan_id no reconocido:",
        preapproval.preapproval_plan_id,
        "Pro:", MP_PRO_PLAN_ID,
        "Premium:", MP_PREMIUM_PLAN_ID
      )
      return NextResponse.json(
        { error: "Plan de suscripción no reconocido" },
        { status: 400 }
      )
    }

    // Actualizar el perfil del usuario en DB
    const { error: updateError } = await supabaseAdmin
      .from("user_profiles")
      .update({
        plan,
        mp_subscription_id: preapproval.id,
        mp_subscription_status: "authorized",
        grace_period_until: null,
        subscription_updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select("id, plan, mp_subscription_id, mp_subscription_status")
      .single()

    if (updateError) {
      console.error("Error actualizando perfil de usuario:", updateError)
      return NextResponse.json(
        { error: "Error al vincular la suscripción" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      plan,
      mp_subscription_id: preapproval.id,
      message: `Suscripción ${plan} activada exitosamente`,
    })
  } catch (error) {
    console.error("Error en link-subscription:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
