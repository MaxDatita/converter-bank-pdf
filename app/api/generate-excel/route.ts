import * as XLSX from "xlsx"
import { createSupabaseAdminClient } from "@/lib/supabase"
import { getEffectivePlanForUser } from "@/lib/subscription"

interface Transaction {
  fecha: string
  concepto: string
  referencia: string
  importe: string
}

interface ProcessedData {
  banco: string
  tipo: string
  periodo: string
  transacciones: Transaction[]
}

interface PremiumData {
  files: Array<{
    filename: string
    banco: string
    tipo: string
    periodo: string
    transacciones: Transaction[]
  }>
}

export async function POST(request: Request) {
  try {
    const data: ProcessedData | PremiumData = await request.json()

    // Verificar plan para multi-archivo (requiere premium con suscripción activa)
    if ('files' in data) {
      const authHeader = request.headers.get("authorization")
      if (!authHeader?.startsWith("Bearer ")) {
        return Response.json({ error: "Autenticación requerida para exportar múltiples archivos" }, { status: 401 })
      }

      const token = authHeader.substring(7)
      const supabaseAdmin = createSupabaseAdminClient()
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

      if (authError || !user) {
        return Response.json({ error: "Token inválido" }, { status: 401 })
      }

      const { effectivePlan } = await getEffectivePlanForUser(user.id)
      if (effectivePlan !== "premium") {
        return Response.json(
          { error: "La exportación de múltiples archivos requiere una suscripción Premium activa" },
          { status: 403 }
        )
      }
    }

    // Crear un nuevo workbook
    const workbook = XLSX.utils.book_new()

    // Verificar si es datos Premium (múltiples archivos) o individual
    if ('files' in data) {
      // Premium: Múltiples archivos en hojas separadas
      const premiumData = data as PremiumData
      
      premiumData.files.forEach((file) => {
        // Crear worksheet para cada archivo
        const worksheet = XLSX.utils.aoa_to_sheet([])
        
        // Agregar información del archivo
        XLSX.utils.sheet_add_aoa(
          worksheet,
          [
            ["INFORMACIÓN DEL RESUMEN", "", "", ""],
            ["Archivo:", file.filename, "", ""],
            ["Banco:", file.banco, "", ""],
            ["Tipo de Cuenta:", file.tipo, "", ""],
            ["Período:", file.periodo, "", ""],
            ["", "", "", ""], // Fila vacía para separar
            ["TRANSACCIONES", "", "", ""],
            ["Fecha", "Concepto", "Referencia", "Importe"], // Headers
          ],
          { origin: "A1" },
        )

        // Agregar las transacciones
        const transactionData = file.transacciones.map((transaction) => [
          transaction.fecha,
          transaction.concepto,
          transaction.referencia,
          transaction.importe,
        ])

        XLSX.utils.sheet_add_aoa(worksheet, transactionData, { origin: "A9" })

        // Configurar el ancho de las columnas
        const columnWidths = [
          { wch: 12 }, // Fecha
          { wch: 50 }, // Concepto
          { wch: 20 }, // Referencia
          { wch: 15 }, // Importe
        ]
        worksheet["!cols"] = columnWidths

        // Aplicar estilos
        applyStylesToWorksheet(worksheet, file.transacciones.length, true)
        
        // Agregar la hoja al workbook con nombre descriptivo
        const sheetName = `Resumen_${file.filename.replace('.pdf', '').substring(0, 20)}`
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
      })
    } else {
      // Free/Pro: Un solo archivo
      const singleData = data as ProcessedData
      
      // Crear worksheet vacío
      const worksheet = XLSX.utils.aoa_to_sheet([])

      // Agregar información del banco en columnas separadas (fila 1)
      XLSX.utils.sheet_add_aoa(
        worksheet,
        [
          ["INFORMACIÓN DEL RESUMEN", "", "", ""],
          ["Banco:", singleData.banco, "", ""],
          ["Tipo de Cuenta:", singleData.tipo, "", ""],
          ["Período:", singleData.periodo, "", ""],
          ["", "", "", ""], // Fila vacía para separar
          ["TRANSACCIONES", "", "", ""],
          ["Fecha", "Concepto", "Referencia", "Importe"], // Headers
        ],
        { origin: "A1" },
      )

      // Agregar las transacciones comenzando desde la fila 8
      const transactionData = singleData.transacciones.map((transaction) => [
        transaction.fecha,
        transaction.concepto,
        transaction.referencia,
        transaction.importe,
      ])

      XLSX.utils.sheet_add_aoa(worksheet, transactionData, { origin: "A8" })

      // Configurar el ancho de las columnas
      const columnWidths = [
        { wch: 12 }, // Fecha
        { wch: 50 }, // Concepto
        { wch: 20 }, // Referencia
        { wch: 15 }, // Importe
      ]
      worksheet["!cols"] = columnWidths

      // Aplicar estilos
      applyStylesToWorksheet(worksheet, singleData.transacciones.length, false)
      
      // Agregar el worksheet al workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, "Resumen Bancario")
    }

    // Generar el archivo Excel
    const excelBuffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    })

    // Retornar el archivo como respuesta
    return new Response(excelBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="resumen_${Date.now()}.xlsx"`,
      },
    })
  } catch (error) {
    console.error("Error generating Excel:", error)
    return Response.json({ error: "Error al generar el archivo Excel" }, { status: 500 })
  }
}

// Función auxiliar para aplicar estilos a los worksheets
function applyStylesToWorksheet(worksheet: XLSX.WorkSheet, transactionsCount: number, isPremium: boolean) {
  // Aplicar estilos a los headers de información
  const infoHeaderStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "2563EB" } }, // Azul
    alignment: { horizontal: "center" },
    border: {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    },
  }

  // Aplicar estilo al header "INFORMACIÓN DEL RESUMEN"
  if (worksheet["A1"]) {
    worksheet["A1"].s = infoHeaderStyle
  }

  // Aplicar estilo al header "TRANSACCIONES"
  const transaccionesRow = isPremium ? "A7" : "A6"
  if (worksheet[transaccionesRow]) {
    worksheet[transaccionesRow].s = infoHeaderStyle
  }

  // Aplicar formato a los headers de las columnas
  const columnHeaderStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "1E40AF" } }, // Azul más oscuro
    alignment: { horizontal: "center" },
    border: {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    },
  }

  // Aplicar estilo a los headers de columnas
  const headerRow = isPremium ? 8 : 7
  const headerCells = [`A${headerRow}`, `B${headerRow}`, `C${headerRow}`, `D${headerRow}`]
  headerCells.forEach((cell) => {
    if (worksheet[cell]) {
      worksheet[cell].s = columnHeaderStyle
    }
  })

  // Aplicar estilo a las etiquetas de información
  const labelStyle = {
    font: { bold: true },
    fill: { fgColor: { rgb: "F3F4F6" } }, // Gris claro
  }

  const labelCells = isPremium ? ["A2", "A3", "A4", "A5"] : ["A2", "A3", "A4"]
  labelCells.forEach((cell) => {
    if (worksheet[cell]) {
      worksheet[cell].s = labelStyle
    }
  })

  // Aplicar bordes a todas las celdas con datos
  const startRow = isPremium ? 9 : 8
  const totalRows = startRow + transactionsCount
  for (let row = 1; row <= totalRows; row++) {
    for (let col = 1; col <= 4; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 })
      if (worksheet[cellAddress]) {
        if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {}
        worksheet[cellAddress].s.border = {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        }
      }
    }
  }
}
