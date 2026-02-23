"use client"

import { useState, useEffect } from "react"
import { ANONYMOUS_LIMITS } from "@/lib/supabase"

interface AnonymousUsage {
  dailyUsage: number
  lastReset: string
}

export function useAnonymousUsage() {
  const [anonymousUsage, setAnonymousUsage] = useState<AnonymousUsage>({ dailyUsage: 0, lastReset: "" })

  // Obtener uso anónimo desde cookies
  const getAnonymousUsage = (): AnonymousUsage => {
    if (typeof window === "undefined") return { dailyUsage: 0, lastReset: "" }

    try {
      const cookie = document.cookie
        .split("; ")
        .find(row => row.startsWith("anonymous_usage="))
      
      if (cookie) {
        const usageData = JSON.parse(decodeURIComponent(cookie.split("=")[1]))
        return usageData
      }
    } catch (error) {
      console.error("Error parsing anonymous usage cookie:", error)
    }

    return { dailyUsage: 0, lastReset: "" }
  }

  // Actualizar uso anónimo en cookies
  const updateAnonymousUsage = (pages: number): boolean => {
    if (typeof window === "undefined") return false

    try {
      const today = new Date().toISOString().split("T")[0]
      const currentUsage = getAnonymousUsage()
      
      // Verificar si es un nuevo día
      if (currentUsage.lastReset !== today) {
        currentUsage.dailyUsage = 0
        currentUsage.lastReset = today
      }

      // Para usuarios anónimos, siempre permitir 1 página por día
      if (pages > ANONYMOUS_LIMITS.dailyPages) {
        // Si intentan procesar más de 1 página, solo contar 1
        pages = ANONYMOUS_LIMITS.dailyPages
      }

      // Verificar límite antes de actualizar
      if (currentUsage.dailyUsage + pages > ANONYMOUS_LIMITS.dailyPages) {
        return false
      }

      // Actualizar uso
      currentUsage.dailyUsage += pages

      // Guardar en cookie con expiración de 24 horas
      const expires = new Date()
      expires.setTime(expires.getTime() + 24 * 60 * 60 * 1000)
      
      document.cookie = `anonymous_usage=${encodeURIComponent(JSON.stringify(currentUsage))}; expires=${expires.toUTCString()}; path=/; SameSite=Strict`

      // Actualizar estado local
      setAnonymousUsage(currentUsage)
      return true
    } catch (error) {
      console.error("Error updating anonymous usage:", error)
      return false
    }
  }

  // Verificar si se puede procesar más páginas
  const canProcessPages = (pages: number): boolean => {
    const currentUsage = getAnonymousUsage()
    const today = new Date().toISOString().split("T")[0]
    
    // Si es un nuevo día, resetear contador
    if (currentUsage.lastReset !== today) {
      return true // Siempre permitir al menos 1 página por día
    }
    
    // Para usuarios anónimos, siempre permitir 1 página por día
    if (currentUsage.dailyUsage === 0) {
      return true
    }
    
    return false // Solo 1 página por día
  }

  // Obtener uso actual
  const getCurrentUsage = (): number => {
    const currentUsage = getAnonymousUsage()
    const today = new Date().toISOString().split("T")[0]
    
    // Si es un nuevo día, retornar 0
    if (currentUsage.lastReset !== today) {
      return 0
    }
    
    return currentUsage.dailyUsage
  }

  // Cargar uso inicial
  useEffect(() => {
    const usage = getAnonymousUsage()
    setAnonymousUsage(usage)
  }, [])

  return {
    anonymousUsage,
    updateAnonymousUsage,
    canProcessPages,
    getCurrentUsage,
    dailyLimit: ANONYMOUS_LIMITS.dailyPages,
  }
}
