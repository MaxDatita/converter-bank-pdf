import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase"
import { getEffectivePlanForUser } from "@/lib/subscription"
import { openai } from "@ai-sdk/openai"
import { generateText } from "ai"

interface ChatTransaction {
  fecha: string
  concepto: string
  importe: string
}

interface ChatProcessedData {
  banco: string
  tipo: string
  periodo: string
  transacciones: ChatTransaction[]
}

interface ChatProcessedFile {
  processedData?: ChatProcessedData
  pages?: number
}

// Función para extraer mes/año del período
function extractMonthYear(periodo: string): string {
  // Intentar diferentes formatos de período
  const meses: { [key: string]: string } = {
    'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
    'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
    'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
  }

  // Formato: "Enero 2024" o "Julio 2023"
  const mesAnoMatch = periodo.match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(\d{4})/i)
  if (mesAnoMatch) {
    const mes = meses[mesAnoMatch[1].toLowerCase()]
    const ano = mesAnoMatch[2]
    return `${mes}/${ano}`
  }

  // Formato: "01/01/2024 - 31/01/2024" o "01/07/2023 - 31/07/2023"
  const fechaRangeMatch = periodo.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (fechaRangeMatch) {
    const mes = fechaRangeMatch[2]
    const ano = fechaRangeMatch[3]
    return `${mes}/${ano}`
  }

  // Formato: "2024-01" o "2023-07"
  const isoMatch = periodo.match(/(\d{4})-(\d{2})/)
  if (isoMatch) {
    return `${isoMatch[2]}/${isoMatch[1]}`
  }

  // Si no se puede extraer, intentar buscar año y mes en cualquier formato
  const anoMatch = periodo.match(/(\d{4})/)
  const mesNumMatch = periodo.match(/(\d{1,2})/)
  if (anoMatch && mesNumMatch) {
    const mes = mesNumMatch[1].padStart(2, '0')
    return `${mes}/${anoMatch[1]}`
  }

  // Si no se puede determinar, devolver el período original o "N/A"
  return periodo.substring(0, 20) // Limitar longitud
}

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación y plan premium
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

    const { effectivePlan } = await getEffectivePlanForUser(user.id)
    if (effectivePlan !== "premium") {
      return NextResponse.json(
        { error: "El chat con IA requiere una suscripción Premium activa" },
        { status: 403 }
      )
    }

    const {
      message,
      processedFiles,
    }: {
      message?: string
      processedFiles?: ChatProcessedFile[]
    } = await request.json()

    if (!message || !processedFiles || processedFiles.length === 0) {
      return NextResponse.json(
        { error: "Mensaje y archivos procesados son requeridos" },
        { status: 400 }
      )
    }

    // Verificar que hay archivos procesados
    const validFiles = processedFiles.filter(
      (f): f is ChatProcessedFile & { processedData: ChatProcessedData } =>
        Boolean(f.processedData)
    )
    if (validFiles.length === 0) {
      return NextResponse.json(
        { error: "No hay archivos procesados para analizar" },
        { status: 400 }
      )
    }

    // Preparar contexto de los archivos para OpenAI
    // OPTIMIZACIÓN: Limitar transacciones por archivo para mejorar velocidad
    const MAX_TRANSACTIONS_PER_FILE = 500 // Máximo de transacciones por archivo en el prompt
    const contextData = validFiles.map((file) => {
      const allTransactions = file.processedData.transacciones || []
      const totalTransactions = allTransactions.length
      
      // Si hay muchas transacciones, tomar muestra representativa (primeras y últimas)
      let transactionsToInclude = allTransactions
      if (totalTransactions > MAX_TRANSACTIONS_PER_FILE) {
        const firstHalf = Math.floor(MAX_TRANSACTIONS_PER_FILE / 2)
        const secondHalf = MAX_TRANSACTIONS_PER_FILE - firstHalf
        transactionsToInclude = [
          ...allTransactions.slice(0, firstHalf),
          ...allTransactions.slice(-secondHalf)
        ]
      }
      
      return {
        banco: file.processedData.banco,
        tipo: file.processedData.tipo,
        periodo: file.processedData.periodo,
        periodoFormateado: extractMonthYear(file.processedData.periodo), // MM/YYYY extraído
        transacciones: transactionsToInclude,
        pages: file.pages,
        totalTransactions: totalTransactions,
        transactionsIncluded: transactionsToInclude.length,
        isSample: totalTransactions > MAX_TRANSACTIONS_PER_FILE
      }
    })

    // Verificar que realmente hay transacciones
    const totalTransactions = contextData.reduce((sum, file) => sum + file.totalTransactions, 0)
    
    // Log para debugging
    console.log("Chat AI - Archivos recibidos:", {
      totalFiles: validFiles.length,
      totalTransactions,
      contextData: contextData.map(f => ({
        banco: f.banco,
        transacciones: f.totalTransactions,
        sample: f.transacciones.slice(0, 2)
      }))
    })
    
    if (totalTransactions === 0) {
      return NextResponse.json(
        { error: "Los archivos no contienen transacciones procesadas" },
        { status: 400 }
      )
    }

    // Crear prompt contextual para OpenAI con TODAS las transacciones
    const systemPrompt = `Eres un asistente financiero experto en análisis de resúmenes bancarios argentinos. 
    
Tienes acceso a los siguientes resúmenes procesados (TODAS las transacciones están incluidas):

${contextData.map((file, index: number) => {
  // Formatear transacciones de forma más compacta
  const transaccionesFormateadas = file.transacciones.map((t) => {
    // Formato compacto: fecha|concepto|importe (sin referencia para ahorrar tokens)
    const tipoTransaccion = t.importe.startsWith('-') ? 'D' : (t.importe.startsWith('+') ? 'C' : '?')
    return `${t.fecha}|${t.concepto.substring(0, 50)}|${tipoTransaccion}:${t.importe}`
  }).join('\n')

  const sampleNote = file.isSample 
    ? `\n⚠️ NOTA: Este resumen tiene ${file.totalTransactions} transacciones. Se muestran ${file.transactionsIncluded} (primeras y últimas) para análisis.`
    : ''

  // Formato: Resumen X/Y -> MM/YYYY
  const resumenId = `Resumen ${index + 1}/${contextData.length} -> ${file.periodoFormateado}`

  return `
${resumenId}: ${file.banco} | ${file.tipo} | ${file.periodo} | ${file.pages}p | ${file.totalTransactions} transacciones${sampleNote}
${transaccionesFormateadas}
`
}).join('\n---\n')}

═══════════════════════════════════════════════════════════════
INSTRUCCIONES PARA EL ANÁLISIS:
═══════════════════════════════════════════════════════════════
1. Tienes acceso COMPLETO a TODAS las transacciones de TODOS los resúmenes cargados
2. Solo responde preguntas relacionadas con estos archivos bancarios específicos
3. Si te preguntan sobre otros temas, indícales que solo puedes analizar los resúmenes subidos
4. Proporciona análisis CONCISOS y directos basados en los datos reales
5. Usa formato HTML simple para destacar información importante
6. Sé específico con números, fechas y patrones encontrados
7. Responde en español de manera clara y profesional
8. SIEMPRE menciona datos específicos de las transacciones cuando sea relevante
9. Puedes analizar patrones, sumar totales, identificar gastos recurrentes, etc.
10. Cuando analices múltiples resúmenes, identifica claramente de cuál archivo proviene cada dato
11. FORMATO DE REFERENCIA A RESUMENES: Cuando haya múltiples resúmenes cargados, SIEMPRE refiérete a ellos usando el formato "Resumen X/Y -> MM/YYYY" donde:
    - X es el número de posición del resumen (1, 2, 3, etc.)
    - Y es el total de resúmenes cargados
    - MM/YYYY es el mes y año extraído del período del resumen
    - Ejemplo: Si te refieres al segundo resumen de 7 totales que corresponde a julio 2023, di "Resumen 2/7 -> 07/2023"
    - Este formato debe usarse SIEMPRE cuando menciones un resumen específico en tus respuestas

FILTRADO Y PRECISIÓN NUMÉRICA (CRÍTICO):
- Cuando el usuario pregunte por un MONTO ESPECÍFICO (ej: "$1,000", "1000 pesos", "mil pesos"), debes:
  1. Filtrar SOLO transacciones con ese monto EXACTO
  2. Comparar números exactamente: $1,000 es DIFERENTE de $3,000, $1,500, $10,000, etc.
  3. NO incluir transacciones con montos similares o aproximados
  4. Si preguntan por "$1,000", solo incluir transacciones que tengan exactamente $1,000.00 o +$1,000.00 o -$1,000.00
- Ejemplos de filtrado correcto:
  * Pregunta: "¿Cuándo tuve créditos por $1,000?" → Solo transacciones con importe exacto +$1,000.00
  * Pregunta: "¿Cuántos débitos de $500 hubo?" → Solo transacciones con importe exacto -$500.00
  * Pregunta: "Transacciones de $2,000" → Solo transacciones con importe exacto $2,000.00 (sin importar signo)
- Si el usuario pregunta por un rango o aproximación, entonces puedes incluir montos cercanos, pero si pregunta por un monto específico, debe ser EXACTO

COMPLETITUD Y VERIFICACIÓN (CRÍTICO):
- ANTES de responder, SIEMPRE:
  1. Revisa TODOS los resúmenes cargados (no solo el primero)
  2. Busca en TODAS las transacciones disponibles, incluso si hay muestra limitada
  3. Cuenta cuántas transacciones coinciden con los criterios de búsqueda
  4. Verifica que no hayas omitido ninguna transacción relevante
- Si hay una muestra limitada de transacciones (indicada con ⚠️ NOTA), menciona esto en tu respuesta:
  * "Nota: Se muestran X de Y transacciones. Puede haber más transacciones relevantes."
- Cuando listes transacciones, incluye TODAS las que coincidan con los criterios, sin omitir ninguna
- Si encuentras transacciones en múltiples resúmenes, lista TODAS, agrupadas por resumen

FORMATO DE RESPUESTA:
- Usa <h3> para títulos principales
- Usa <h4> para subtítulos
- Usa <strong> para negrita (destacar montos, fechas importantes)
- Usa <ul><li> para listas
- Incluye solo los montos y operaciones relevantes
- Evita explicaciones innecesarias

INTERPRETACIÓN DE SIGNOS EN LOS MONTOS (CRÍTICO):
- Los montos con signo MENOS (-) delante son SIEMPRE saldos negativos o DÉBITOS (egresos, gastos, retiros)
- Los montos con signo MÁS (+) delante o SIN signo son SIEMPRE saldos positivos o CRÉDITOS (ingresos, depósitos, acreditaciones)
- Ejemplos:
  * "-$1,500.00" = Débito de $1,500 (salida de dinero)
  * "+$2,000.00" = Crédito de $2,000 (entrada de dinero)
  * "$500.00" = Crédito de $500 (entrada de dinero, sin signo explícito)
- Al sumar totales, los débitos (con -) reducen el saldo y los créditos (con + o sin signo) lo aumentan
- Al calcular diferencias o comparar períodos, respeta siempre estos signos

DATOS DISPONIBLES PARA ANÁLISIS:
- Transacciones individuales con fecha, concepto, referencia e importe (TODAS incluidas)
- Clasificación de débitos (negativos con signo -) y créditos (positivos con signo + o sin signo)
- Información del banco y período de cada resumen
- Cantidad total de transacciones y páginas por resumen
- Múltiples resúmenes si el usuario cargó varios archivos

IMPORTANTE: 
- Tienes acceso a TODAS las transacciones, no solo una muestra
- Puedes hacer análisis completos: sumar totales, calcular promedios, identificar patrones, etc.
- Cuando haya múltiples resúmenes, analiza cada uno y también haz comparaciones entre ellos
- Usa los datos reales de las transacciones para dar respuestas específicas, útiles y CONCISAS
- SIEMPRE respeta la interpretación de signos: - = débito/saldo negativo, + o sin signo = crédito/saldo positivo`

    const userPrompt = `Usuario pregunta: "${message}"

Analiza los resúmenes bancarios proporcionados y responde de manera específica y útil.`

    // OPTIMIZACIÓN: Usar GPT-4o-mini para el chat (más rápido que GPT-5-nano)
    // GPT-5-nano es más económico pero más lento, mejor para procesamiento batch
    // GPT-4o-mini es más rápido para respuestas interactivas
    const response = await generateText({
      model: openai("gpt-4o-mini"), // Modelo más rápido para chat interactivo
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.2,
    })

    return NextResponse.json({
      response: response.text,
      timestamp: new Date().toISOString(),
      filesAnalyzed: validFiles.length,
      totalTransactions: validFiles.reduce(
        (sum: number, f) => sum + f.processedData.transacciones.length,
        0
      ),
    })

  } catch (error) {
    console.error("Error en chat AI:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
