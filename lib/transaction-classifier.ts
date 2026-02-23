import transactionPatterns from '../data/transaction-patterns.json'

interface TransactionPattern {
  pattern: string
  description: string
  regex: string
  case_insensitive: boolean
}

interface PatternData {
  debitos: TransactionPattern[]
  creditos: TransactionPattern[]
}

export class TransactionClassifier {
  private patterns: PatternData

  constructor() {
    this.patterns = transactionPatterns as PatternData
  }

  /**
   * Clasifica una transacción como débito o crédito basado en el concepto
   */
  classifyTransaction(concepto: string): 'debito' | 'credito' | 'unknown' {
    // Primero verificar débitos
    for (const pattern of this.patterns.debitos) {
      const regex = new RegExp(pattern.regex, pattern.case_insensitive ? 'i' : '')
      if (regex.test(concepto)) {
        return 'debito'
      }
    }

    // Luego verificar créditos
    for (const pattern of this.patterns.creditos) {
      const regex = new RegExp(pattern.regex, pattern.case_insensitive ? 'i' : '')
      if (regex.test(concepto)) {
        return 'credito'
      }
    }

    return 'unknown'
  }

  /**
   * Obtiene la descripción del patrón que coincidió
   */
  getMatchingPattern(concepto: string): string | null {
    // Verificar débitos
    for (const pattern of this.patterns.debitos) {
      const regex = new RegExp(pattern.regex, pattern.case_insensitive ? 'i' : '')
      if (regex.test(concepto)) {
        return `${pattern.description} (Débito)`
      }
    }

    // Verificar créditos
    for (const pattern of this.patterns.creditos) {
      const regex = new RegExp(pattern.regex, pattern.case_insensitive ? 'i' : '')
      if (regex.test(concepto)) {
        return `${pattern.description} (Crédito)`
      }
    }

    return null
  }

  /**
   * Genera el prompt con todos los patrones conocidos
   */
  generatePatternsPrompt(): string {
    let prompt = "\nPATRONES DE TRANSACCIONES CONOCIDOS:\n\n"
    
    prompt += "DÉBITOS (SIEMPRE NEGATIVO -):\n"
    this.patterns.debitos.forEach(pattern => {
      prompt += `- ${pattern.pattern}: ${pattern.description}\n`
    })
    
    prompt += "\nCRÉDITOS (SIEMPRE POSITIVO +):\n"
    this.patterns.creditos.forEach(pattern => {
      prompt += `- ${pattern.pattern}: ${pattern.description}\n`
    })
    
    prompt += "\nUSA ESTOS PATRONES PARA IDENTIFICAR CORRECTAMENTE CADA TRANSACCIÓN.\n"
    
    return prompt
  }

  /**
   * Aplica la clasificación automática a una lista de transacciones
   */
  applyClassification(transacciones: Array<{concepto: string, importe: string}>): Array<{concepto: string, importe: string}> {
    return transacciones.map(transaccion => {
      const classification = this.classifyTransaction(transaccion.concepto)
      let importe = transaccion.importe.replace(/[+\-]/g, '') // Remover signos existentes
      
      if (classification === 'debito') {
        importe = `-${importe}`
      } else if (classification === 'credito') {
        importe = `+${importe}`
      }
      // Si es 'unknown', mantener el importe como está
      
      return {
        ...transaccion,
        importe
      }
    })
  }
}
