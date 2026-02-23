"use client"

import { X, FileText, Crown, User, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface AnonymousRegistrationModalProps {
  isOpen: boolean
  onClose: () => void
  onRegister: () => void
  fileName: string
  pageCount: number
}

export function AnonymousRegistrationModal({ 
  isOpen, 
  onClose, 
  onRegister, 
  fileName, 
  pageCount 
}: AnonymousRegistrationModalProps) {
  if (!isOpen) return null

  const isMultiPage = pageCount > 1

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md bg-white shadow-xl">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2 text-[#2980b9]">
              <FileText className="h-5 w-5" />
              <span className="text-sm font-medium">Archivo Detectado</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <CardTitle className="text-lg text-[#2980b9]">
            {isMultiPage ? "PDF de Múltiples Páginas" : "PDF de Una Página"}
          </CardTitle>
          
          <CardDescription className="text-gray-600">
            {fileName} - {pageCount} página{pageCount > 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Información del archivo */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Detalles del Archivo</span>
            </div>
            <p className="text-sm text-blue-700">
              <strong>Nombre:</strong> {fileName}
            </p>
            <p className="text-sm text-blue-700">
              <strong>Páginas:</strong> {pageCount} página{pageCount > 1 ? "s" : ""}
            </p>
          </div>

          {/* Mensaje personalizado según el número de páginas */}
          {isMultiPage ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">Procesamiento Limitado</span>
              </div>
              <p className="text-sm text-yellow-700">
                Como usuario no registrado, solo podemos procesar la <strong>primera página</strong> de tu PDF.
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                <strong>Páginas sin procesar:</strong> {pageCount - 1}
              </p>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">PDF Procesable</span>
              </div>
              <p className="text-sm text-green-700">
                Tu PDF de 1 página se puede procesar completamente.
              </p>
            </div>
          )}

          {/* Beneficios del registro */}
          <div className="bg-gradient-to-r from-[#2980b9]/10 to-[#6dd5fa]/10 border border-[#2980b9]/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="h-4 w-4 text-[#2980b9]" />
              <span className="text-sm font-medium text-[#2980b9]">¿Por qué registrarse?</span>
            </div>
            <ul className="text-sm text-[#2980b9] space-y-1">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3" />
                <span>Hasta <strong>3 páginas por día</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3" />
                <span>Editar las primeras <strong>3 líneas</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3" />
                <span>Procesar PDFs <strong>completos</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3" />
                <span><strong>Totalmente gratis</strong></span>
              </li>
            </ul>
          </div>

          {/* Información del registro */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Registro Rápido y Fácil</span>
            </div>
            <p className="text-sm text-gray-600">
              Solo necesitas tu <strong>nombre</strong> y <strong>correo electrónico</strong>.
            </p>
            <p className="text-sm text-gray-600 mt-1">
              No requiere contraseña ni verificación compleja.
            </p>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Continuar Sin Registro
            </Button>
            <Button
              onClick={onRegister}
              className="flex-1 bg-[#2980b9] hover:bg-[#1e5f8b] text-white"
            >
              <Crown className="h-4 w-4 mr-2" />
              Registrarme Gratis
            </Button>
          </div>

          {/* Mensaje adicional */}
          <p className="text-xs text-gray-500 text-center">
            Al continuar sin registro, solo se procesará la primera página de tu PDF.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
