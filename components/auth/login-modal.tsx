"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Mail, Chrome, Loader2, ArrowLeft, X } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { RegistrationModal } from "./registration-modal"

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [step, setStep] = useState<"method" | "email" | "code">("method")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [showOnboarding, setShowOnboarding] = useState(false)

  const { sendOTPCode, verifyOTP, signInWithGoogle } = useAuth()

  const resetModal = () => {
    setStep("method")
    setEmail("")
    setCode("")
    setError("")
    setMessage("")
    setLoading(false)
    setShowOnboarding(false)
  }

  const handleClose = () => {
    resetModal()
    onClose()
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    setError("")

    const result = await sendOTPCode(email)

    if (result.success) {
      setMessage(result.message)
      setStep("code")
    } else {
      setError(result.message)
    }

    setLoading(false)
  }

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return

    setLoading(true)
    setError("")

    const result = await verifyOTP(email, code)

    if (result.success) {
      if (result.needsOnboarding) {
        // Usuario nuevo - mostrar onboarding
        setShowOnboarding(true)
        setLoading(false)
      } else {
        // Usuario existente - cerrar modal
        handleClose()
      }
    } else {
      setError(result.message)
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError("")

    const result = await signInWithGoogle()

    if (!result.success) {
      setError(result.message)
      setLoading(false)
    }
    // Si es exitoso, se redirige automáticamente
  }

  const handleOnboardingComplete = () => {
    setShowOnboarding(false)
    handleClose()
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleClose}>
        <Card className="w-full max-w-md bg-white" onClick={(e) => e.stopPropagation()}>
          <CardHeader className="text-center">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <CardTitle className="text-xl bg-gradient-to-r from-[#2980b9] to-[#6dd5fa] bg-clip-text text-transparent">
                  {step === "method" && "Iniciar Sesión"}
                  {step === "email" && "Ingresa tu Email"}
                  {step === "code" && "Código de Verificación"}
                </CardTitle>
                <CardDescription className="mt-2">
                  {step === "method" && "Elige tu método de inicio de sesión preferido"}
                  {step === "email" && "Te enviaremos un código de 6 dígitos"}
                  {step === "code" && `Ingresa el código enviado a ${email}`}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClose} className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-800">{error}</AlertDescription>
              </Alert>
            )}

            {message && (
              <Alert className="border-green-200 bg-green-50">
                <AlertDescription className="text-green-800">{message}</AlertDescription>
              </Alert>
            )}

            {step === "method" && (
              <div className="space-y-3">
                <Button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                  size="lg"
                >
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Chrome className="h-4 w-4 mr-2" />}
                  Continuar con Google
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-500">O</span>
                  </div>
                </div>

                <Button
                  onClick={() => setStep("email")}
                  variant="outline"
                  className="w-full border-[#2980b9] text-[#2980b9] hover:bg-[#2980b9] hover:text-white"
                  size="lg"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Continuar con Email
                </Button>
              </div>
            )}

            {step === "email" && (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <Input
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full"
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep("method")} className="flex-1">
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Atrás
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || !email.trim()}
                    className="flex-1 bg-[#2980b9] hover:bg-[#1e5f8b]"
                  >
                    {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Enviar Código
                  </Button>
                </div>
              </form>
            )}

            {step === "code" && (
              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <div>
                  <Input
                    type="text"
                    placeholder="12345678"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    required
                    className="w-full text-center text-2xl tracking-widest font-mono"
                    maxLength={8}
                  />
                  <p className="text-xs text-gray-500 mt-1 text-center">Código de 8 dígitos</p>
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep("email")} className="flex-1">
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Atrás
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || code.length !== 8}
                    className="flex-1 bg-[#2980b9] hover:bg-[#1e5f8b]"
                  >
                    {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Verificar Código
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setStep("email")
                    setCode("")
                    setError("")
                    setMessage("")
                  }}
                  className="w-full text-sm text-gray-500"
                >
                  ¿No recibiste el código? Reenviar
                </Button>
              </form>
            )}

            <div className="text-center pt-4 border-t">
              <p className="text-xs text-gray-500">
                Al continuar, aceptas nuestros términos de servicio y política de privacidad
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de onboarding para usuarios nuevos */}
      <RegistrationModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onComplete={handleOnboardingComplete}
        email={email}
      />
    </>
  )
}
