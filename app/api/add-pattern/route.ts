import { NextRequest } from "next/server"
import fs from "fs"
import path from "path"

export async function POST(request: NextRequest) {
  try {
    const { pattern, description, type, regex } = await request.json()

    if (!pattern || !description || !type || !regex) {
      return Response.json({ error: "Faltan campos requeridos" }, { status: 400 })
    }

    if (type !== "debito" && type !== "credito") {
      return Response.json({ error: "Tipo debe ser 'debito' o 'credito'" }, { status: 400 })
    }

    // Leer el archivo actual
    const filePath = path.join(process.cwd(), "data", "transaction-patterns.json")
    const fileContent = fs.readFileSync(filePath, "utf8")
    const patterns = JSON.parse(fileContent)

    // Agregar el nuevo patrón
    const newPattern = {
      pattern,
      description,
      regex,
      case_insensitive: true,
    }

    if (type === "debito") {
      patterns.debitos.push(newPattern)
    } else {
      patterns.creditos.push(newPattern)
    }

    // Guardar el archivo actualizado
    fs.writeFileSync(filePath, JSON.stringify(patterns, null, 2))

    return Response.json({ success: true, message: "Patrón agregado exitosamente" })
  } catch (error) {
    console.error("Error adding pattern:", error)
    return Response.json({ error: "Error al agregar el patrón" }, { status: 500 })
  }
}
