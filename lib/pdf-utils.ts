export async function countPDFPages(file: File): Promise<number> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    
    // Convertir a string para buscar patrones
    const pdfText = Array.from(uint8Array)
      .map(byte => String.fromCharCode(byte))
      .join('')
    
    // Buscar el patrón /Count en el PDF
    const countMatch = pdfText.match(/\/Count\s+(\d+)/)
    if (countMatch) {
      return parseInt(countMatch[1], 10)
    }
    
    // Método alternativo: contar objetos de página
    const pageMatches = pdfText.match(/\/Type\s*\/Page[^s]/g)
    if (pageMatches) {
      return pageMatches.length
    }
    
    // Si no se puede determinar, asumir 1 página
    return 1
  } catch (error) {
    console.error('Error counting PDF pages:', error)
    return 1 // Valor por defecto
  }
}

/**
 * Extrae solo la primera página de un PDF
 * @param file - Archivo PDF
 * @returns Promise<File> - PDF con solo la primera página
 */
export async function extractFirstPage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer
        
        // Usar PDF-lib para extraer la primera página
        const { PDFDocument } = await import('pdf-lib')
        const pdfDoc = await PDFDocument.load(arrayBuffer)
        
        // Crear nuevo documento con solo la primera página
        const newPdfDoc = await PDFDocument.create()
        const [firstPage] = await newPdfDoc.copyPages(pdfDoc, [0])
        newPdfDoc.addPage(firstPage)
        
        // Convertir a bytes
        const pdfBytes = await newPdfDoc.save()
        
        // Crear nuevo archivo
        const newFile = new File([pdfBytes], file.name, {
          type: 'application/pdf',
          lastModified: Date.now()
        })
        
        resolve(newFile)
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = () => reject(new Error('Error reading file'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Verifica si un PDF tiene más de una página
 * @param file - Archivo PDF
 * @returns Promise<boolean> - true si tiene más de una página
 */
export async function hasMultiplePages(file: File): Promise<boolean> {
  const pages = await countPDFPages(file)
  return pages > 1
}
