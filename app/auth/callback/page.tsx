"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          console.error("Error in auth callback:", error)
          router.push("/?error=auth_error")
          return
        }

        if (data.session) {
          // Usuario autenticado exitosamente
          router.push("/?auth=success")
        } else {
          // No hay sesión
          router.push("/?error=no_session")
        }
      } catch (error) {
        console.error("Error handling auth callback:", error)
        router.push("/?error=callback_error")
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-[#6dd5fa]/10 to-[#2980b9]/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white/95 backdrop-blur-sm border-[#6dd5fa]/20 shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-xl bg-gradient-to-r from-[#2980b9] to-[#6dd5fa] bg-clip-text text-transparent">
            Completando inicio de sesión...
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-[#2980b9]" />
          <p className="text-gray-600">Por favor espera mientras procesamos tu autenticación.</p>
        </CardContent>
      </Card>
    </div>
  )
}
