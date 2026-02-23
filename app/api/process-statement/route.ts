import { generateObject } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import { TransactionClassifier } from "@/lib/transaction-classifier"
import { createSupabaseAdminClient } from "@/lib/supabase"
import { getEffectivePlan } from "@/lib/subscription"
import { countPDFPages } from "@/lib/pdf-utils"

const TransactionSchema = z.object({
  fecha: z.string().describe("Fecha de la transacción en formato DD/MM/YYYY"),
  concepto: z.string().describe("Concepto o detalle de la operación"),
  referencia: z.string().describe("Referencia o número de operación"),
  importe: z.string().describe("Importe sin signo, será clasificado automáticamente"),
})

const BankStatementSchema = z.object({
  banco: z
    .string()
    .describe("Nombre del banco argentino detectado (ej: Banco Nación, BBVA, Galicia, Santander, ICBC, Macro, etc.)"),
  tipo: z.string().describe("Tipo de cuenta: Cuenta Corriente, Caja de Ahorro, Tarjeta de Crédito, etc."),
  periodo: z.string().describe("Período del resumen (ej: Enero 2024, 01/01/2024 - 31/01/2024)"),
  transacciones: z.array(TransactionSchema).describe("Lista de todas las transacciones encontradas"),
})

export async function POST(request: Request) {
  try {
    // Resolver identidad del usuario antes de la llamada costosa a OpenAI
    const supabaseAdmin = createSupabaseAdminClient()
    const authHeader = request.headers.get("authorization")
    let currentUser = null

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7)
      try {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
        if (!error && user) {
          currentUser = user

          // Obtener perfil para calcular plan efectivo (verificando suscripción MP)
          const { data: profile } = await supabaseAdmin
            .from("user_profiles")
            .select("plan, mp_subscription_status, grace_period_until")
            .eq("id", user.id)
            .single()

          if (profile) {
            getEffectivePlan({
              plan: profile.plan,
              mp_subscription_status: profile.mp_subscription_status ?? null,
              grace_period_until: profile.grace_period_until ?? null,
            })
          }
        }
      } catch {
        // Token inválido, continuar como usuario anónimo
      }
    }

    const formData = await request.formData()
    const file = formData.get("pdf") as File

    if (!file) {
      return Response.json({ error: "No se encontró el archivo PDF" }, { status: 400 })
    }

    // Count PDF pages
    const pagesCount = await countPDFPages(file)

    // Convert file to base64 for AI SDK 5
    const fileBuffer = await file.arrayBuffer()
    const base64File = Buffer.from(fileBuffer).toString("base64")

    // Inicializar el clasificador de transacciones
    const classifier = new TransactionClassifier()

    // Usando GPT-5 nano: más económico y con mayor contexto
    const result = await generateObject({
      model: openai("gpt-5-nano"), // Cambiado a GPT-5 nano para reducir costos
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analiza este resumen bancario argentino y extrae todas las transacciones.

INSTRUCCIONES:
1. Extrae TODAS las transacciones con fecha, concepto, referencia e importe
2. Para el importe, extrae solo el número SIN SIGNO (será clasificado automáticamente)
3. Mantén el concepto exactamente como aparece en el documento
4. Identifica correctamente el banco, tipo de cuenta y período

${classifier.generatePatternsPrompt()}

IMPORTANTE: 
- Extrae el importe como número positivo sin signo
- El concepto debe ser exacto para permitir clasificación automática
- Incluye todas las transacciones visibles en el documento`,
            },
            {
              type: "image",
              image: `data:application/pdf;base64,${base64File}`,
            },
          ],
        },
      ],
      schema: BankStatementSchema,
    })

    // Aplicar clasificación automática usando los patrones
    const transaccionesClasificadas = classifier.applyClassification(result.object.transacciones)

    const finalResult = {
      ...result.object,
      transacciones: transaccionesClasificadas,
    }

    try {
      // Record the conversion
      const conversionData = {
        user_id: currentUser?.id || null, // null for anonymous users
        filename: file.name,
        bank_name: finalResult.banco,
        account_type: finalResult.tipo,
        period: finalResult.periodo,
        pages_count: pagesCount,
        transactions_count: finalResult.transacciones.length,
        created_at: new Date().toISOString(),
      }

      const { error: insertError } = await supabaseAdmin.from("conversion_history").insert([conversionData])

      if (insertError) {
        console.error("Error recording conversion:", insertError)
        // Don't fail the request if logging fails
      }

      // Get client IP address for anonymous tracking
      const clientIP = request.headers.get('x-forwarded-for') || 
                       request.headers.get('x-real-ip') || 
                       '127.0.0.1' // fallback

      // Update usage tracking (for both authenticated and anonymous users)
      try {
        const now = new Date()
        const currentYear = now.getFullYear()
        const currentMonth = now.getMonth() + 1
        const today = now.toISOString().split("T")[0]

        if (currentUser?.id) {
          // Update daily usage for authenticated users
          await supabaseAdmin.from("daily_usage").upsert(
            {
              user_id: currentUser.id,
              date: today,
              pages_processed: pagesCount,
              files_processed: 1,
            },
            {
              onConflict: "user_id,date",
              ignoreDuplicates: false,
            },
          )

          // Update monthly usage for authenticated users
          await supabaseAdmin.from("monthly_usage").upsert(
            {
              user_id: currentUser.id,
              year: currentYear,
              month: currentMonth,
              pages_processed: pagesCount,
              files_processed: 1,
            },
            {
              onConflict: "user_id,year,month",
              ignoreDuplicates: false,
            },
          )
        } else {
          // Update anonymous usage tracking
          await supabaseAdmin.from("anonymous_usage").upsert(
            {
              ip_address: clientIP,
              date: today,
              pages_processed: pagesCount,
              files_processed: 1,
            },
            {
              onConflict: "ip_address,date",
              ignoreDuplicates: false,
            },
          )

          // Also update daily_usage for anonymous users (with null user_id)
          await supabaseAdmin.from("daily_usage").upsert(
            {
              user_id: null, // null indicates anonymous user
              date: today,
              pages_processed: pagesCount,
              files_processed: 1,
            },
            {
              onConflict: "user_id,date",
              ignoreDuplicates: false,
            },
          )

          // Also update monthly_usage for anonymous users (with null user_id)
          await supabaseAdmin.from("monthly_usage").upsert(
            {
              user_id: null, // null indicates anonymous user
              year: currentYear,
              month: currentMonth,
              pages_processed: pagesCount,
              files_processed: 1,
            },
            {
              onConflict: "user_id,year,month",
              ignoreDuplicates: false,
            },
          )
        }
      } catch (updateError) {
        console.error("Error updating usage tracking:", updateError)
      }
    } catch (trackingError) {
      console.error("Error in conversion tracking:", trackingError)
      // Continue with the response even if tracking fails
    }

    return Response.json(finalResult)
  } catch (error) {
    console.error("Error processing PDF:", error)
    return Response.json(
      {
        error: "Error al procesar el archivo PDF. Verifica que sea un resumen bancario válido.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
