"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Loader2, X, AlertCircle } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

interface RegistrationModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
  email: string
}

export function RegistrationModal({ isOpen, onClose, onComplete, email }: RegistrationModalProps) {
  const [fullName, setFullName] = useState("")
  const [selectedPlan, setSelectedPlan] = useState<"free" | "pro" | "premium">("free")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const { completeOnboarding } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) {
      setError("Por favor ingresa tu nombre completo")
      return
    }

    setLoading(true)
    setError("")

    const result = await completeOnboarding(fullName.trim(), selectedPlan)

    if (result.success) {
      onComplete()
    } else {
      setError(result.message)
    }

    setLoading(false)
  }

  if (!isOpen) return null

  const plans = [
    {
      id: "free" as const,
      name: "Gratuito",
      price: "$0",
      period: "siempre",
      description: "Perfecto para probar",
      features: ["3 páginas por día", "Todos los bancos argentinos", "Conversión automática a Excel"],
      limitations: ["Edición de lineas modo prueba"],
      color: "border-gray-200",
      badge: null,
    },
    {
      id: "pro" as const,
      name: "Pro",
      price: "$35.000",
      period: "por mes",
      description: "Para uso regular",
      features: ["120 páginas por mes", "Edición manual completa", "Procesamiento prioritario", "Soporte técnico"],
      limitations: [],
      color: "border-[#2980b9]",
      badge: "Más Popular",
    },
    {
      id: "premium" as const,
      name: "Premium",
      price: "$55.000",
      period: "por mes",
      description: "Funcionalidad completa",
      features: [
        "300 páginas por mes",
        "Múltiples archivos simultáneos",
        "Chat con IA para análisis",
        "Soporte prioritario 24/7",
      ],
      limitations: [],
      color: "border-[#6dd5fa]",
      badge: "Completo",
    },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="w-full max-w-4xl bg-white max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="text-center">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="text-2xl bg-gradient-to-r from-[#2980b9] to-[#6dd5fa] bg-clip-text text-transparent">
                Bienvenido a Conversor de Extractos con IA
              </CardTitle>
              <CardDescription className="mt-2">
                Completa tu registro para comenzar a convertir tus resúmenes bancarios
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Información personal */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[#2980b9]">Información Personal</h3>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <Input id="email" type="email" value={email} disabled className="bg-gray-50" />
              </div>

              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre Completo *
                </label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Tu nombre completo"
                  required
                  className="w-full"
                />
              </div>
            </div>

            {/* Selección de plan */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[#2980b9]">Selecciona tu Plan</h3>

              <div className="grid md:grid-cols-3 gap-4">
                {plans.map((plan) => (
                  <Card
                    key={plan.id}
                    className={`cursor-pointer transition-all ${
                      selectedPlan === plan.id
                        ? `${plan.color} bg-blue-50 ring-2 ring-[#2980b9]`
                        : `${plan.color} hover:shadow-md`
                    } relative`}
                    onClick={() => setSelectedPlan(plan.id)}
                  >
                    {plan.badge && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <Badge className="bg-[#2980b9] text-white">{plan.badge}</Badge>
                      </div>
                    )}

                    <CardHeader className="text-center pb-2">
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      <div className="text-2xl font-bold text-[#2980b9]">{plan.price}</div>
                      <CardDescription>{plan.period}</CardDescription>
                      <p className="text-sm text-gray-600">{plan.description}</p>
                    </CardHeader>

                    <CardContent className="space-y-2">
                      {plan.features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}

                      {plan.limitations.map((limitation, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-[#2980b9] flex-shrink-0" />
                          <span className="text-sm text-gray-500">{limitation}</span>
                        </div>
                      ))}

                      {selectedPlan === plan.id && (
                        <div className="mt-3 p-2 bg-[#2980b9] text-white rounded text-center text-sm font-medium">
                          ✓ Plan Seleccionado
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Información adicional */}
            <div className="bg-[#6dd5fa]/5 border border-[#6dd5fa]/20 rounded-lg p-4">
              <h4 className="font-medium text-[#2980b9] mb-2">💡 ¿No estás seguro?</h4>
              <p className="text-sm text-gray-700">
                Puedes comenzar con el plan gratuito y actualizarlo en cualquier momento. Todos los planes incluyen
                soporte para todos los bancos argentinos y conversión automática a Excel.
              </p>
            </div>

            {/* Botones */}
            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1 bg-transparent"
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading || !fullName.trim()}
                className="flex-1 bg-[#2980b9] hover:bg-[#1e5f8b]"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creando cuenta...
                  </>
                ) : (
                  `Crear cuenta ${selectedPlan !== "free" ? `- Plan ${plans.find((p) => p.id === selectedPlan)?.name}` : ""}`
                )}
              </Button>
            </div>

            <div className="text-center pt-4 border-t">
              <p className="text-xs text-gray-500">
                Al crear tu cuenta, aceptas nuestros términos de servicio y política de privacidad.
                {selectedPlan !== "free" && " Podrás gestionar tu suscripción desde tu panel de usuario."}
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
