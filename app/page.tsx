"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import {
  Upload,
  FileText,
  Download,
  CheckCircle,
  Edit2,
  Save,
  X,
  Eye,
  EyeOff,
  Crown,
  Zap,
  Brain,
  Lock,
  Target,
  MessageCircle,
  Layers,
  Mail,
  Building,
  Send,
  Trash2,
  ChevronDown,
  ChevronUp,
  LogIn,
  LogOut,
  Loader2,
  History,
  User,
  AlertCircle,
  Settings,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ProgressGradient } from "@/components/ui/progress-gradient"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { countPDFPages, extractFirstPage } from "@/lib/pdf-utils"
import { useAuth } from "@/hooks/use-auth"
import { useAnonymousUsage } from "@/hooks/use-anonymous-usage"
import { LoginModal } from "@/components/auth/login-modal"
import { AnonymousRegistrationModal } from "@/components/anonymous-registration-modal"
import { getPlanLimits } from "@/lib/supabase"
import { supabase } from "@/lib/supabase"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

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
  totalPages: number
}

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface UploadedFile {
  id: string
  file: File
  pages: number
  processedData?: ProcessedData
  expanded?: boolean
}

interface ConversionHistoryItem {
  id: string
  created_at: string
  filename: string
  bank_name: string
  account_type: string
  period: string
  pages_count: number
  transactions_count: number
}

export default function BankStatementConverter() {
  const [step, setStep] = useState(1)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingFileId, setEditingFileId] = useState<string | null>(null)
  const [editedTransaction, setEditedTransaction] = useState<Transaction | null>(null)
  const [forceUpdate, setForceUpdate] = useState(0)
  const [showAllTransactions, setShowAllTransactions] = useState(false)
  const [showPricing, setShowPricing] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  
  // Controlar hidratación
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Forzar re-render cuando cambie forceUpdate
  useEffect(() => {
    // Este useEffect se ejecuta cada vez que forceUpdate cambia
    // forzando un re-render de la tabla
  }, [forceUpdate])
  const [pdfPages, setPdfPages] = useState<number>(0)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showAnonymousModal, setShowAnonymousModal] = useState(false)
  const [anonymousFileInfo, setAnonymousFileInfo] = useState({ fileName: "", pageCount: 0 })

  // Premium features
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const chatMessagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll automático al último mensaje del chat
  useEffect(() => {
    if (showChat && chatMessagesEndRef.current) {
      // Pequeño delay para asegurar que el DOM se haya actualizado
      setTimeout(() => {
        chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      }, 100)
    }
  }, [chatMessages, chatLoading, showChat])

  // Estado para el uso real del usuario (se actualiza dinámicamente)
  const {
    user,
    profile,
    updateUserName,
    updateUserEmail,
    refreshProfile,
    signOut,
    updateUsage,
    getUserUsage,
  } = useAuth()
  
  // Hook para tracking de usuarios anónimos
  const {
    updateAnonymousUsage,
    canProcessPages,
    getCurrentUsage,
    dailyLimit: anonymousDailyLimit,
  } = useAnonymousUsage()
  
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [realUsage, setRealUsage] = useState({ dailyUsage: 0, monthlyUsage: 0 })
  const currentPlan = user ? (profile?.plan || "free") : "anonymous"
  const planLimits = getPlanLimits(currentPlan)
  
  // Estado para validación de límites desde el backend
  const [backendLimitCheck, setBackendLimitCheck] = useState<{
    canProcess: boolean
    pagesUsed: number
    limit: number
    limitType: 'daily' | 'monthly'
    resetTime: string | null
    plan: string
  } | null>(null)
  const [limitCheckLoading, setLimitCheckLoading] = useState(false)

  // Función para verificar límites desde el backend
  const checkUsageLimit = async () => {
    setLimitCheckLoading(true)
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      
      // Agregar token de autenticación si existe
      if (user) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`
        }
      }
      
      const response = await fetch('/api/check-usage-limit', {
        method: 'GET',
        headers,
      })
      
      if (response.ok) {
        const data = await response.json()
        setBackendLimitCheck(data)
      } else {
        console.error('Error checking usage limit:', response.statusText)
        // En caso de error, permitir procesar (fail open)
        setBackendLimitCheck({
          canProcess: true,
          pagesUsed: 0,
          limit: 0,
          limitType: 'daily',
          resetTime: null,
          plan: currentPlan,
        })
      }
    } catch (error) {
      console.error('Error checking usage limit:', error)
      // En caso de error, permitir procesar (fail open)
      setBackendLimitCheck({
        canProcess: true,
        pagesUsed: 0,
        limit: 0,
        limitType: 'daily',
        resetTime: null,
        plan: currentPlan,
      })
    } finally {
      setLimitCheckLoading(false)
    }
  }

  // Cargar el uso real del usuario cuando se autentique
  useEffect(() => {
    if (user) {
      // Cargar uso diario y mensual
      getUserUsage().then((usage) => {
        if (usage) {
          setRealUsage(prev => ({
            ...prev,
            dailyUsage: usage.dailyUsage || 0
          }))
        }
      })
      
      // Cargar total acumulado desde conversion_history
      const loadTotalUsage = async () => {
        try {
          const { data: conversions } = await supabase
            .from("conversion_history")
            .select("pages_count")
            .eq("user_id", user.id)
          
          const totalPages = conversions?.reduce((sum, conv) => sum + (conv.pages_count || 0), 0) || 0
          
          setRealUsage(prev => ({
            ...prev,
            monthlyUsage: totalPages // Usar total acumulado
          }))
        } catch (error) {
          console.error("Error loading total usage:", error)
        }
      }
      
      loadTotalUsage()
    }
  }, [user, getUserUsage])

  // Verificar límites al cargar la página y cuando cambia el usuario
  useEffect(() => {
    if (isMounted) {
      checkUsageLimit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, user?.id, currentPlan])

  // Verificar límites cada 24 horas
  useEffect(() => {
    if (!isMounted) return
    
    const interval = setInterval(() => {
      checkUsageLimit()
    }, 24 * 60 * 60 * 1000) // 24 horas en milisegundos
    
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, user?.id, currentPlan])

  // Estado para vinculación de suscripción de Mercado Pago
  const [subscriptionLinkStatus, setSubscriptionLinkStatus] = useState<'idle' | 'linking' | 'success' | 'error'>('idle')
  const [subscriptionLinkMessage, setSubscriptionLinkMessage] = useState<string | null>(null)

  // Capturar redirect de Mercado Pago con preapproval_id en la URL
  useEffect(() => {
    if (!isMounted) return

    const params = new URLSearchParams(window.location.search)
    const preapprovalId = params.get("preapproval_id")

    if (!preapprovalId) return

    // Limpiar el query param de la URL inmediatamente
    const cleanUrl = window.location.pathname
    window.history.replaceState({}, "", cleanUrl)

    const linkSubscription = async () => {
      if (!user) {
        setSubscriptionLinkMessage("Iniciá sesión para activar tu suscripción.")
        setSubscriptionLinkStatus("error")
        return
      }

      setSubscriptionLinkStatus("linking")
      setSubscriptionLinkMessage("Activando tu suscripción...")

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          setSubscriptionLinkStatus("error")
          setSubscriptionLinkMessage("No se pudo obtener tu sesión. Intentá recargar la página.")
          return
        }

        const response = await fetch("/api/link-subscription", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ preapprovalId }),
        })

        const result = await response.json()

        if (response.ok) {
          setSubscriptionLinkStatus("success")
          setSubscriptionLinkMessage(`¡Suscripción ${result.plan === "premium" ? "Premium" : "Pro"} activada exitosamente!`)
          // Refrescar el perfil para que la UI refleje el nuevo plan
          await refreshProfile()
        } else {
          setSubscriptionLinkStatus("error")
          setSubscriptionLinkMessage(result.error || "No se pudo activar la suscripción.")
        }
      } catch {
        setSubscriptionLinkStatus("error")
        setSubscriptionLinkMessage("Error al conectar con el servidor.")
      }
    }

    linkSubscription()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, user?.id])

  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [conversionHistory, setConversionHistory] = useState<ConversionHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyOpenedFromAccount, setHistoryOpenedFromAccount] = useState(false)
  const [pricingOpenedFromAccount, setPricingOpenedFromAccount] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [editingEmail, setEditingEmail] = useState(false)
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [updatingProfile, setUpdatingProfile] = useState(false)
  const [profileError, setProfileError] = useState("")
  const [profileSuccess, setProfileSuccess] = useState("")

  const fetchConversionHistory = async () => {
    if (!user) return

    setHistoryLoading(true)
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      
      if (!token) {
        return
      }

      const response = await fetch("/api/conversion-history", {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setConversionHistory(data)
      } else {
        // Handle error silently
      }
    } catch {
      // Handle error silently
    } finally {
      setHistoryLoading(false)
    }
  }

  // Función helper para verificar si se puede editar
  const canEditTransaction = (index: number): boolean => {
    if (planLimits.canEdit) return true
    if (currentPlan === "free" || currentPlan === "anonymous") {
      return index < 3 // Solo las primeras 3 líneas
    }
    return false
  }

  const handleLogout = async () => {
    try {
      await signOut()
      // Reset any local state if needed
      setRealUsage({ dailyUsage: 0, monthlyUsage: 0 })
    } catch (error) {
      console.error("Error logging out:", error)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files
    if (!selectedFiles) return

    if (currentPlan === "premium") {
      // Premium: Múltiples archivos
      const newFiles: UploadedFile[] = []
      for (let i = 0; i < selectedFiles.length; i++) {
        const selectedFile = selectedFiles[i]
        if (selectedFile.type === "application/pdf") {
          const pages = await countPDFPages(selectedFile)
          newFiles.push({
            id: Date.now() + i + Math.random() + "",
            file: selectedFile,
            pages,
            expanded: false,
          })
        }
      }
      setUploadedFiles((prev) => [...prev, ...newFiles])
      setError(null)
    } else {
      // Free/Pro/Anonymous: Un solo archivo (reemplazar)
      const selectedFile = selectedFiles[0]
      if (selectedFile && selectedFile.type === "application/pdf") {
        const pages = await countPDFPages(selectedFile)
        
        // Verificar límite antes de permitir la subida (usando validación del backend)
        const limitReached = backendLimitCheck ? !backendLimitCheck.canProcess : false
        
        // Para usuarios anónimos, también verificar cookies como backup
        if (currentPlan === "anonymous") {
          const cookieLimitReached = !canProcessPages(1)
          if (limitReached || cookieLimitReached) {
            const limitType = backendLimitCheck?.limitType === 'monthly' ? 'mensual' : 'diario'
            setError(`Has alcanzado tu límite ${limitType}. Regístrate gratis para obtener hasta 3 páginas por día.`)
            return
          }
          
          // Mostrar modal de registro anónimo
          setAnonymousFileInfo({ fileName: selectedFile.name, pageCount: pages })
          setShowAnonymousModal(true)
          
          // Si el PDF tiene más de una página, extraer solo la primera
          if (pages > 1) {
            try {
              const singlePageFile = await extractFirstPage(selectedFile)
              setFile(singlePageFile)
              setPdfPages(1)
            } catch {
              setError("Error al procesar el PDF. Por favor intenta nuevamente.")
              return
            }
          } else {
            setFile(selectedFile)
            setPdfPages(pages)
          }
        } else {
          // Para usuarios registrados, usar validación del backend
          if (limitReached) {
            const limitType = backendLimitCheck?.limitType === 'monthly' ? 'mensual' : 'diario'
            setError(`Has alcanzado tu límite ${limitType} de ${backendLimitCheck?.limit || 0} páginas.`)
            return
          }
          
          // Usuarios registrados
          setFile(selectedFile)
          setPdfPages(pages)
          setError(null)
        }
      } else {
        setError("Por favor selecciona un archivo PDF válido")
      }
    }

    // Reset input
    event.target.value = ""
  }

  const removeUploadedFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const toggleFileExpansion = (id: string) => {
    setUploadedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, expanded: !f.expanded } : f)))
  }

  const processFile = async () => {
    if (!file && uploadedFiles.length === 0) return

    // Verificar límites según el plan
    const totalPages = currentPlan === "premium" ? uploadedFiles.reduce((sum, f) => sum + f.pages, 0) : pdfPages

    if (currentPlan === "anonymous") {
      // Usuario anónimo - siempre puede procesar 1 página (que es lo que se extrajo)
      // No necesitamos verificar límites aquí porque ya se extrajo solo la primera página
    } else if (currentPlan === "free") {
      // Usuario registrado free - verificar límite diario
      if (planLimits.dailyPages && realUsage.dailyUsage + totalPages > planLimits.dailyPages) {
        setShowPricing(true)
        setError(
          `Este PDF tiene ${totalPages} páginas. Has usado ${realUsage.dailyUsage} de ${planLimits.dailyPages} páginas diarias. Suscríbete para procesar más páginas.`,
        )
        return
      }
    } else {
      // Usuarios pro/premium - verificar límite mensual
      const monthlyLimit = planLimits.monthlyPages
      if (monthlyLimit && realUsage.monthlyUsage + totalPages > monthlyLimit) {
        setError(
          `Los PDFs tienen ${totalPages} páginas en total. Has usado ${realUsage.monthlyUsage} de ${monthlyLimit} páginas este mes.`,
        )
        return
      }
    }

    setLoading(true)
    setError(null)

    try {
      if (currentPlan === "premium" && uploadedFiles.length > 0) {
        // Procesar múltiples archivos
        const processedFiles = []
        for (const uploadedFile of uploadedFiles) {
          const formData = new FormData()
          formData.append("pdf", uploadedFile.file)

          const session = await supabase.auth.getSession()
          const token = session.data.session?.access_token
          
          const response = await fetch("/api/process-statement", {
            method: "POST",
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData,
          })

          if (response.ok) {
            const data = await response.json()
            processedFiles.push({
              ...uploadedFile,
              processedData: { ...data, totalPages: uploadedFile.pages },
            })
          }
        }

        setUploadedFiles(processedFiles)
        
        // Actualizar contador de páginas usadas
        const totalPagesProcessed = processedFiles.reduce((sum, f) => sum + f.pages, 0)
        if (user) {
          await updateUsage(totalPagesProcessed)
          // Actualizar estado local
          setRealUsage(prev => {
            const newUsage = {
              ...prev,
              monthlyUsage: prev.monthlyUsage + totalPagesProcessed
            }
            console.log("Updated monthly usage:", newUsage.monthlyUsage)
            return newUsage
          })
        }
        
        setStep(2)
      } else {
        // Procesar un solo archivo
        const formData = new FormData()
        formData.append("pdf", file!)

        const session = await supabase.auth.getSession()
        const token = session.data.session?.access_token
        
        const response = await fetch("/api/process-statement", {
          method: "POST",
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData,
        })

        if (!response.ok) {
          throw new Error("Error al procesar el archivo")
        }

        const data = await response.json()
        setProcessedData({
          ...data,
          totalPages: pdfPages,
        })
        
        // Actualizar contador de páginas usadas
        if (user) {
          // Usuario registrado
          await updateUsage(pdfPages)
          // Actualizar estado local
          setRealUsage(prev => {
            const newUsage = {
              ...prev,
              monthlyUsage: prev.monthlyUsage + pdfPages
            }
            console.log("Updated monthly usage:", newUsage.monthlyUsage)
            return newUsage
          })
        } else {
          // Usuario anónimo - actualizar uso en cookies
          updateAnonymousUsage(pdfPages)
        }
        
        setStep(2)
      }
    } catch {
      setError("Error al procesar el archivo. Verifica que sea un resumen bancario válido.")
    } finally {
      setLoading(false)
    }
  }

  const handleRestrictedAction = () => {
    if (currentPlan === "free") {
      setShowUpgradeModal(true)
    }
  }

  const startEditing = (index: number, transaction: Transaction, fileId?: string) => {
    // Verificar si se puede editar según el plan
    if (!planLimits.canEdit) {
      // Para usuarios free y anónimos, permitir editar solo las primeras 3 líneas
      if (currentPlan === "free" || currentPlan === "anonymous") {
        if (index >= 3) {
          setError("Solo puedes editar las primeras 3 líneas. Suscríbete al plan Pro para editar todas las transacciones.")
          return
        }
      } else {
        handleRestrictedAction()
        return
      }
    }
    
    setEditingIndex(index)
    setEditingFileId(fileId || null)
    setEditedTransaction({ ...transaction })
  }

  const toggleSign = (index: number, fileId?: string) => {
    // Verificar si se puede editar según el plan
    if (!planLimits.canEdit) {
      // Para usuarios free y anónimos, permitir editar solo las primeras 3 líneas
      if (currentPlan === "free" || currentPlan === "anonymous") {
        if (index >= 3) {
          setError("Solo puedes editar las primeras 3 líneas. Suscríbete al plan Pro para editar todas las transacciones.")
          return
        }
      } else {
        handleRestrictedAction()
        return
      }
    }

    if (fileId && currentPlan === "premium") {
      // Premium: editar en archivo específico
      setUploadedFiles((prev) => {
        return prev.map((f) => {
          if (f.id === fileId && f.processedData) {
            // Crear una COPIA COMPLETA del archivo para forzar re-render
            const updatedFile = {
              ...f,
              processedData: {
                ...f.processedData,
                transacciones: f.processedData.transacciones.map((t, i) => {
                  if (i === index) {
                    const currentImporte = t.importe
                    
                    let newImporte = currentImporte
                    if (currentImporte.startsWith("-")) {
                      newImporte = currentImporte.substring(1)
                    } else if (currentImporte.startsWith("+")) {
                      newImporte = "-" + currentImporte.substring(1)
                    } else {
                      newImporte = "-" + currentImporte
                    }
                    
                    return { ...t, importe: newImporte }
                  }
                  return t
                })
              }
            }
            
            return updatedFile
          }
          return f
        })
      })
      
      // Forzar re-render
      setForceUpdate(prev => prev + 1)

      // Si estamos editando, también actualizar el editedTransaction
      if (editingIndex === index && editingFileId === fileId && editedTransaction) {
        const currentImporte = editedTransaction.importe
        let newImporte = currentImporte

        if (currentImporte.startsWith("-")) {
          newImporte = currentImporte.substring(1)
        } else if (currentImporte.startsWith("+")) {
          newImporte = "-" + currentImporte.substring(1)
        } else {
          newImporte = "-" + currentImporte
        }

        setEditedTransaction({
          ...editedTransaction,
          importe: newImporte,
        })
      }
    } else if (processedData) {
      // Free/Pro/Anonymous: editar archivo único
      const updatedTransactions = [...processedData.transacciones]
      const currentImporte = updatedTransactions[index].importe

      if (currentImporte.startsWith("-")) {
        updatedTransactions[index].importe = currentImporte.substring(1)
      } else if (currentImporte.startsWith("+")) {
        updatedTransactions[index].importe = "-" + currentImporte.substring(1)
      } else {
        updatedTransactions[index].importe = "-" + currentImporte
      }

      setProcessedData({
        ...processedData,
        transacciones: updatedTransactions,
      })
      
      // Forzar re-render
      setForceUpdate(prev => prev + 1)
    }
  }

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return
    if (currentPlan !== "premium") {
      setShowPricing(true)
      return
    }

    const userMessage: ChatMessage = {
      role: "user",
      content: chatInput,
      timestamp: new Date(),
    }

    setChatMessages((prev) => [...prev, userMessage])
    setChatInput("")
    setChatLoading(true)

    try {
      // Verificar que hay archivos procesados
      const processedFiles = uploadedFiles.filter((f) => f.processedData)

      if (processedFiles.length === 0) {
        const aiResponse: ChatMessage = {
          role: "assistant",
          content:
            "Aún no has subido ningún resumen bancario. Una vez que subas y proceses tus PDFs, podré ayudarte con análisis detallados de tus transacciones, patrones de gasto, identificación de ingresos recurrentes, y mucho más.",
          timestamp: new Date(),
        }
        setChatMessages((prev) => [...prev, aiResponse])
        setChatLoading(false)
        return
      }

      // Llamar a la API de chat con IA
      const response = await fetch("/api/chat-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: chatInput,
          processedFiles: processedFiles,
        }),
      })

      if (!response.ok) {
        throw new Error("Error en la API de chat")
      }

      const data = await response.json()

      const aiMessage: ChatMessage = {
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      }

      setChatMessages((prev) => [...prev, aiMessage])
    } catch (error) {
      console.error("Error sending message:", error)
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: "Disculpa, hubo un error al procesar tu consulta. Por favor intenta nuevamente.",
        timestamp: new Date(),
      }
      setChatMessages((prev) => [...prev, errorMessage])
    } finally {
      setChatLoading(false)
    }
  }

  const cancelEditing = () => {
    setEditingIndex(null)
    setEditingFileId(null)
    setEditedTransaction(null)
  }

  const saveEdit = () => {
    if (editingIndex !== null && editedTransaction) {
      if (currentPlan === "premium" && editingFileId) {
        // Premium: editar en archivo específico
        setUploadedFiles((prev) =>
          prev.map((f) => {
            if (f.id === editingFileId && f.processedData) {
              // Crear una COPIA COMPLETA para forzar re-render
              return {
                ...f,
                processedData: {
                  ...f.processedData,
                  transacciones: f.processedData.transacciones.map((t, i) => 
                    i === editingIndex ? editedTransaction : t
                  ),
                },
              }
            }
            return f
          }),
        )
      } else if (processedData) {
        // Free/Pro: editar archivo único
        const updatedTransactions = [...processedData.transacciones]
        updatedTransactions[editingIndex] = editedTransaction

        setProcessedData({
          ...processedData,
          transacciones: updatedTransactions,
        })
      }

      setEditingIndex(null)
      setEditingFileId(null)
      setEditedTransaction(null)
    }
  }

  const downloadExcel = async () => {
    if (!processedData && uploadedFiles.length === 0) return

    try {
      if (currentPlan === "premium" && uploadedFiles.length > 0) {
        // Premium: Generar un solo Excel con múltiples hojas
        const allData = {
          files: uploadedFiles
            .filter(f => f.processedData)
            .map(f => ({
              filename: f.file.name,
              ...f.processedData
            }))
        }
        
        const response = await fetch("/api/generate-excel", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(allData),
        })

        if (response.ok) {
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.style.display = "none"
          a.href = url
          a.download = `resumenes_multiple_${Date.now()}.xlsx`
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
        }
      } else {
        // Free/Pro: Descargar un solo archivo
        const response = await fetch("/api/generate-excel", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(processedData),
        })

        if (!response.ok) {
          throw new Error("Error al generar el archivo Excel")
        }

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.style.display = "none"
        a.href = url
        a.download = `resumen_${processedData!.banco.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.xlsx`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }

      setStep(3)
    } catch {
      setError("Error al descargar el archivo Excel")
    }
  }

  const resetProcess = () => {
    setStep(1)
    setFile(null)
    setProcessedData(null)
    setError(null)
    setEditingIndex(null)
    setEditedTransaction(null)
    setShowAllTransactions(false)
    setShowPricing(false)
    setPdfPages(0)
    setUploadedFiles([])
    setChatMessages([])
    setShowChat(false)
  }

  const displayedTransactions = processedData?.transacciones
    ? showAllTransactions
      ? processedData.transacciones
      : processedData.transacciones.slice(0, 10)
    : []

  // Para el plan Premium, crear displayedTransactions para cada archivo
  const getDisplayedTransactionsForFile = (file: UploadedFile, showAll: boolean = false): Transaction[] => {
    if (!file.processedData?.transacciones) return []
    return showAll 
      ? file.processedData.transacciones 
      : file.processedData.transacciones.slice(0, 5)
  }

  const getNextPlanFeatures = () => {
    if (currentPlan === "free") {
      return {
        title: "🔒 Funciones Bloqueadas",
        subtitle: "Desbloquea estas funciones con el Plan Pro:",
        features: ["120 páginas por mes", "Edición manual completa", "Procesamiento prioritario", "Soporte técnico"],
        buttonText: "Upgrade a Pro",
      }
    } else if (currentPlan === "pro") {
      return {
        title: "🚀 Funciones Premium",
        subtitle: "Desbloquea funciones avanzadas con el Plan Premium:",
        features: [
          "300 páginas por mes",
          "Subir múltiples resúmenes",
          "Chat con IA para análisis",
          "Soporte prioritario 24/7",
        ],
        buttonText: "Upgrade a Premium",
      }
    }
    return null
  }

  // Funciones para manejar el modal anónimo
  const handleAnonymousModalClose = () => {
    setShowAnonymousModal(false)
    setAnonymousFileInfo({ fileName: "", pageCount: 0 })
  }

  const handleAnonymousRegister = () => {
    setShowAnonymousModal(false)
    setShowLoginModal(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-[#6dd5fa]/10 to-[#2980b9]/5 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8 relative">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#2980b9] via-[#1e5f8b] to-[#2980b9] bg-clip-text text-transparent mb-2">
            Conversor de Resúmenes Bancarios
          </h1>
          <p className="text-lg text-[#2980b9] font-medium">
            Convierte tus resúmenes bancarios PDF a Excel con IA
          </p>
        </div>

        {/* Usage Indicator */}
        <Card className="mb-6 bg-white/95 backdrop-blur-sm border-[#6dd5fa]/20 shadow-lg">
          <CardContent className="pt-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              {user ? (
                // Usuario logueado - Nombre + Plan arriba, páginas abajo
                <div className="flex flex-col items-start gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-[#2980b9] rounded-full flex items-center justify-center text-white text-xs font-medium">
                      <User className="h-3 w-3" />
                    </div>
                    <span className="text-sm font-medium text-[#2980b9]">
                      {profile?.name || user?.email?.split("@")[0] || "Usuario"}
                    </span>
                    <span className="text-xs text-[#2980b9]/80 bg-[#2980b9]/10 px-2 py-0.5 rounded-full uppercase">
                      {currentPlan === "free" ? "FREE" : currentPlan === "pro" ? "PRO" : "PREMIUM"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {currentPlan === "free" ? (
                      <>
                        <div className="flex gap-1">
                          {planLimits.dailyPages && Array.from({ length: planLimits.dailyPages }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-3 h-3 rounded-full ${i < realUsage.dailyUsage ? "bg-[#2980b9]" : "bg-gray-300"}`}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-gray-600">
                          {realUsage.dailyUsage}/{planLimits.dailyPages} páginas hoy
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-gray-600">
                        <strong>
                          {realUsage.monthlyUsage}/{planLimits.monthlyPages}
                        </strong>{" "}
                        páginas este mes
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                // Usuario anónimo - Mostrar círculos de páginas diarias
                <div className="flex items-center justify-between md:justify-start md:gap-4">
                  {currentPlan === "anonymous" ? (
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {Array.from({ length: anonymousDailyLimit }).map((_, i) => {
                          // Usar información del backend si está disponible, sino usar cookies
                          const pagesUsed = backendLimitCheck?.pagesUsed ?? (isMounted ? getCurrentUsage() : 0)
                          return (
                            <div
                              key={i}
                              className={`w-3 h-3 rounded-full ${i < pagesUsed ? "bg-[#2980b9]" : "bg-gray-300"}`}
                            />
                          )
                        })}
                      </div>
                      <span className="text-sm text-gray-600">
                        {backendLimitCheck 
                          ? `${backendLimitCheck.pagesUsed}/${backendLimitCheck.limit}` 
                          : (isMounted ? `${getCurrentUsage()}/${anonymousDailyLimit}` : '0/1')} página hoy
                      </span>
                    </div>
                  ) : null}
                </div>
              )}

              <div className="flex items-center gap-3 justify-center md:justify-end">
                {user ? (
                  <>
                    {currentPlan === "free" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPricing(true)}
                        className="border-[#2980b9] text-[#2980b9] hover:bg-[#2980b9] hover:text-white"
                      >
                        Suscribirse
                      </Button>
                    )}

                    {currentPlan === "premium" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowChat(true)}
                        className="border-[#2980b9] text-[#2980b9] hover:bg-[#2980b9] hover:text-white"
                      >
                        <MessageCircle className="h-4 w-4 mr-1" />
                        Chat IA
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAccountModal(true)}
                      className="border-[#2980b9] text-[#2980b9] hover:bg-[#2980b9] hover:text-white"
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Mi Cuenta
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPricing(true)}
                      className="border-[#2980b9] text-[#2980b9] hover:bg-[#2980b9] hover:text-white"
                    >
                      <Crown className="h-4 w-4 mr-1" />
                      Suscribirse
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowLoginModal(true)}
                      className="border-[#2980b9] text-[#2980b9] hover:bg-[#2980b9] hover:text-white"
                    >
                      <LogIn className="h-4 w-4 mr-1" />
                      Registrarse
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>



        {/* Incentive Message - Simplified */}
        {currentPlan === "anonymous" ? (
          <div className="mb-6 bg-gradient-to-r from-[#2980b9] to-[#6dd5fa] rounded-lg px-4 py-3">
            <p className="text-sm text-white font-medium text-center">
              💡 <strong>¡Regístrate gratis!</strong> Solo necesitas tu nombre y correo para obtener hasta 3 páginas por día.
            </p>
          </div>
        ) : currentPlan === "free" ? (
          <div className="mb-6 bg-gradient-to-r from-[#2980b9] to-[#6dd5fa] rounded-lg px-4 py-3">
            <p className="text-sm text-white font-medium text-center">
              💡 <strong>¿Necesitas procesar más páginas?</strong> Con el plan Pro puedes procesar hasta 120 páginas por
              mes y editar manualmente todas tus transacciones.
            </p>
          </div>
        ) : currentPlan === "pro" ? (
          <div className="mb-6 bg-gradient-to-r from-[#2980b9] to-[#6dd5fa] rounded-lg px-4 py-3">
            <p className="text-sm text-white font-medium text-center">
            🚀 <strong>Sube de niviel!</strong> Hasta 300 paginas por mes, procesa multiples resúmenes al mismo tiempo y chat de IA con tus resúmenes en el Plan Premium.
            </p>
          </div>
        ) : null}

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-[#2980b9]">Paso {step} de 3</span>
            <span className="text-sm text-gray-600">
              {step === 1 && "Subir PDF"}
              {step === 2 && "Vista previa y edición"}
              {step === 3 && "Completado"}
            </span>
          </div>
          <ProgressGradient value={(step / 3) * 100} className="h-3" />
        </div>

        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50 backdrop-blur-sm">
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* Notificación de vinculación de suscripción MP */}
        {subscriptionLinkStatus === 'linking' && (
          <Alert className="mb-6 border-blue-200 bg-blue-50 backdrop-blur-sm">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <AlertDescription className="text-blue-800 ml-2">{subscriptionLinkMessage}</AlertDescription>
          </Alert>
        )}
        {subscriptionLinkStatus === 'success' && (
          <Alert className="mb-6 border-green-200 bg-green-50 backdrop-blur-sm">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 ml-2">{subscriptionLinkMessage}</AlertDescription>
          </Alert>
        )}
        {subscriptionLinkStatus === 'error' && subscriptionLinkMessage && (
          <Alert className="mb-6 border-red-200 bg-red-50 backdrop-blur-sm">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 ml-2">{subscriptionLinkMessage}</AlertDescription>
          </Alert>
        )}

        {/* Step 1: Upload PDF */}
        {step === 1 && (
          <Card className="mb-6 bg-white/95 backdrop-blur-sm border-[#6dd5fa]/20 shadow-lg">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2 text-[#2980b9]">
                <Upload className="h-6 w-6" />
                Paso 1: Subir Resumen{currentPlan === "premium" ? "es" : ""} Bancario
                {currentPlan === "premium" ? "s" : ""}
              </CardTitle>
              <CardDescription className="text-gray-600">
                {currentPlan === "premium"
                  ? "Sube uno o múltiples resúmenes de cuenta bancaria o tarjeta de crédito en formato PDF"
                  : "Sube tu resumen de cuenta bancaria o tarjeta de crédito en formato PDF"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Upload Area - Mostrar para todos los planes */}
              {(!file && (currentPlan === "free" || currentPlan === "pro" || currentPlan === "anonymous")) && uploadedFiles.length === 0 && (
                <div className="border-2 border-dashed border-[#6dd5fa]/50 rounded-lg p-8 text-center hover:border-[#2980b9]/50 transition-colors bg-white/80">
                  <FileText className="h-12 w-12 text-[#6dd5fa] mx-auto mb-4" />
                  <div className="space-y-2">
                    <p className="text-lg font-medium text-[#2980b9]">
                      Selecciona tu archivo PDF
                    </p>
                    <p className="text-sm text-gray-600">
                      Bancos soportados: Nación, BBVA, Galicia, Santander, ICBC, Macro, y más
                    </p>
                    {/* Información sobre límites para usuarios no registrados */}
                    {currentPlan === "anonymous" && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
                        <p className="text-sm text-blue-800 font-medium">
                          📋 <strong>Límites sin registro:</strong>
                        </p>
                        <ul className="text-xs text-gray-500 mt-1 space-y-1 text-left">
                          <li>• Solo 1 página por día</li>
                          <li>• Si tu PDF tiene más páginas, solo se procesará la primera</li>
                          <li>• Edición de lineas en version prueba, puedes editar las primeras 3 líneas</li>
                          <li>• Regístrate gratis para obtener hasta 3 páginas por día</li>
                        </ul>
                        
                        {/* Mostrar límite actual */}
                        {isMounted && getCurrentUsage() > 0 && (
                          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-xs text-yellow-800">
                              ⚠️ <strong>Límite alcanzado:</strong> Ya has usado tu 1 página diaria. 
                              Regístrate gratis para obtener hasta 3 páginas por día.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Este bloque solo se muestra para Free/Pro, no para Premium */}
                    {pdfPages > 0 && (
                      <p className="text-sm text-[#2980b9] font-medium">
                        📄 Este PDF tiene {pdfPages} página{pdfPages > 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex justify-center mt-4">
                    {(() => {
                      // Determinar si está deshabilitado basado en la validación del backend
                      const isDisabled = backendLimitCheck 
                        ? !backendLimitCheck.canProcess 
                        : (currentPlan === "anonymous" && isMounted && getCurrentUsage() > 0)
                      
                      // Mensaje a mostrar
                      const buttonText = isDisabled 
                        ? (backendLimitCheck?.limitType === 'monthly' 
                            ? "Límite Mensual Alcanzado" 
                            : "Límite Diario Alcanzado")
                        : "Seleccionar Archivo"
                      
                      return (
                        <label className={`cursor-pointer ${isDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
                          <input
                            type="file"
                            accept=".pdf"
                            multiple={false}
                            onChange={handleFileUpload}
                            className="hidden"
                            disabled={isDisabled || limitCheckLoading}
                          />
                          <div className={`inline-flex items-center px-6 py-3 bg-[#6dd5fa]/20 hover:bg-[#6dd5fa]/30 text-[#2980b9] font-semibold rounded-full border-2 border-[#6dd5fa]/30 hover:border-[#2980b9]/50 transition-all ${
                            isDisabled 
                              ? 'bg-gray-200 text-gray-500 border-gray-300 cursor-not-allowed' 
                              : ''
                          }`}>
                            <Upload className="h-4 w-4 mr-2" />
                            {limitCheckLoading ? "Verificando..." : buttonText}
                          </div>
                        </label>
                      )
                    })()}
                  </div>
                </div>
              )}

              {/* Premium: Upload Area - Siempre visible */}
              {currentPlan === "premium" && (
                <div className="space-y-4">
                  {uploadedFiles.length === 0 ? (
                    // Mostrar área de upload cuando no hay archivos
                    <div className="border-2 border-dashed border-[#6dd5fa]/50 rounded-lg p-8 text-center hover:border-[#2980b9]/50 transition-colors bg-white/80">
                      <FileText className="h-12 w-12 text-[#6dd5fa] mx-auto mb-4" />
                      <div className="space-y-2">
                        <p className="text-lg font-medium text-[#2980b9]">
                          Selecciona tus archivos PDF
                        </p>
                        <p className="text-sm text-gray-600">
                          Bancos soportados: Nación, BBVA, Galicia, Santander, ICBC, Macro, y más
                        </p>
                        <p className="text-sm text-[#2980b9] font-medium">
                          ✨ Plan Premium: Puedes subir múltiples archivos a la vez
                        </p>
                      </div>
                      <div className="flex justify-center mt-4">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept=".pdf"
                            multiple
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                          <div className="inline-flex items-center px-6 py-3 bg-[#6dd5fa]/20 hover:bg-[#6dd5fa]/30 text-[#2980b9] font-semibold rounded-full border-2 border-[#6dd5fa]/30 hover:border-[#2980b9]/50 transition-all">
                            <Upload className="h-4 w-4 mr-2" />
                            Seleccionar Archivos
                          </div>
                        </label>
                      </div>
                    </div>
                  ) : (
                    // Mostrar archivos seleccionados
                    <>
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-[#2980b9]">Archivos seleccionados:</h4>
                      </div>

                      {uploadedFiles.map((uploadedFile) => (
                        <div key={uploadedFile.id} className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="text-sm font-medium text-green-800">
                                {uploadedFile.file.name} ({uploadedFile.pages} página{uploadedFile.pages > 1 ? "s" : ""})
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeUploadedFile(uploadedFile.id)}
                              className="h-6 w-6 p-0 border-red-300 text-red-600 hover:bg-red-500 hover:text-white hover:border-red-500"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}

                      <div className="text-sm text-[#2980b9] font-medium">
                        Total: {uploadedFiles.reduce((sum, f) => sum + f.pages, 0)} páginas
                      </div>

                      {/* Botón Agregar Más */}
                      <div className="flex justify-center">
                        <label className="cursor-pointer">
                          <input type="file" accept=".pdf" multiple onChange={handleFileUpload} className="hidden" />
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-[#6dd5fa] text-[#2980b9] hover:bg-[#6dd5fa] hover:text-white bg-transparent"
                            asChild
                          >
                            <div>
                              <Upload className="h-4 w-4 mr-1" />
                              Agregar Más Archivos
                            </div>
                          </Button>
                        </label>
                      </div>
                    </>
                  )}
                </div>
              )}



              {/* Single File Display - Free/Pro/Anonymous */}
              {currentPlan !== "premium" && file && (
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-800">
                        Archivo seleccionado: {file.name} ({pdfPages} página{pdfPages > 1 ? "s" : ""})
                      </span>
                    </div>
                    
                    {/* Mensaje simple para usuarios anónimos */}
                    {currentPlan === "anonymous" && (
                      <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800">
                          Regístrate gratis para obtener hasta 3 páginas por día.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Botón para reemplazar archivo */}
                  <div className="flex justify-center">
                    <label className="cursor-pointer">
                      <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-[#6dd5fa] text-[#2980b9] hover:bg-[#6dd5fa] hover:text-white bg-transparent"
                        asChild
                      >
                        <div>
                          <Upload className="h-4 w-4 mr-1" />
                          Reemplazar Archivo
                        </div>
                      </Button>
                    </label>
                  </div>
                </div>
              )}

              <div className="flex justify-center">
                <Button
                  onClick={processFile}
                  disabled={(!file && uploadedFiles.length === 0) || loading}
                  className="bg-[#2980b9] hover:bg-[#1e5f8b] px-8"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    `Procesar Resumen${currentPlan === "premium" && uploadedFiles.length > 1 ? "es" : ""}`
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Features Section */}
        <Card className="mb-6 bg-white/90 backdrop-blur-sm border-[#6dd5fa]/20">
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-3 gap-6 text-center">
              <div className="flex flex-col items-center space-y-2">
                <div className="w-12 h-12 bg-[#2980b9]/10 rounded-full flex items-center justify-center">
                  <Brain className="h-6 w-6 text-[#2980b9]" />
                </div>
                <h3 className="font-semibold text-[#2980b9]">Inteligente</h3>
                <p className="text-sm text-gray-600">
                  IA avanzada que reconoce automáticamente el formato de cada banco argentino
                </p>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <div className="w-12 h-12 bg-[#2980b9]/10 rounded-full flex items-center justify-center">
                  <Lock className="h-6 w-6 text-[#2980b9]" />
                </div>
                <h3 className="font-semibold text-[#2980b9]">Seguro</h3>
                <p className="text-sm text-gray-600">
                  Tus datos se procesan de forma segura y no se almacenan en nuestros servidores
                </p>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <div className="w-12 h-12 bg-[#2980b9]/10 rounded-full flex items-center justify-center">
                  <Target className="h-6 w-6 text-[#2980b9]" />
                </div>
                <h3 className="font-semibold text-[#2980b9]">Preciso</h3>
                <p className="text-sm text-gray-600">
                  Extracción precisa de datos con identificación correcta de débitos y créditos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Preview and Edit */}
        {step === 2 && (processedData || uploadedFiles.some((f) => f.processedData)) && (
          <Card className="mb-6 bg-white/95 backdrop-blur-sm border-[#6dd5fa]/20 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center justify-center gap-2 text-[#2980b9]">
                <FileText className="h-6 w-6" />
                Paso 2: Vista Previa y Edición
              </CardTitle>
              <CardDescription className="text-center text-gray-600">
                {planLimits.canEdit
                  ? "Revisa y edita los datos extraídos antes de descargar. Haz clic en cualquier transacción para editarla."
                  : currentPlan === "free" || currentPlan === "anonymous"
                  ? "Revisa los datos extraídos. Puedes editar las primeras 3 líneas. Suscríbete al plan Pro para editar todas las transacciones."
                  : "Revisa los datos extraídos. La edición manual requiere un plan Pro o Premium."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Display processed data */}
              {currentPlan === "premium" && uploadedFiles.length > 0 ? (
                // Premium: Multiple files
                <div className="space-y-6">
                  {uploadedFiles.map(
                    (uploadedFile, fileIndex) =>
                      uploadedFile.processedData && (
                        <div key={uploadedFile.id} className="border rounded-lg p-4 bg-gray-50">
                          <div className="flex flex-wrap gap-4 justify-center mb-4">
                            <Badge variant="secondary" className="text-sm px-3 py-1 bg-[#2980b9] text-white">
                              {uploadedFile.processedData.banco}
                            </Badge>
                            <Badge variant="outline" className="text-sm px-3 py-1 border-[#2980b9] text-[#2980b9]">
                              {uploadedFile.processedData.tipo}
                            </Badge>
                            <Badge variant="outline" className="text-sm px-3 py-1 border-[#2980b9] text-[#2980b9]">
                              {uploadedFile.processedData.periodo}
                            </Badge>
                            <Badge variant="outline" className="text-sm px-3 py-1 border-[#6dd5fa] text-[#2980b9]">
                              <Layers className="h-3 w-3 mr-1" />
                              {uploadedFile.pages} página{uploadedFile.pages > 1 ? "s" : ""}
                            </Badge>
                          </div>

                          <div className="mb-4">
                            <div className="text-sm text-gray-600">
                              Archivo {fileIndex + 1}: {uploadedFile.file.name} -{" "}
                              {uploadedFile.processedData.transacciones.length} transacciones
                            </div>
                          </div>

                          {/* Transactions Table for this file */}
                          <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-[#2980b9]/5">
                                  <TableHead className="text-[#2980b9] font-semibold">Fecha</TableHead>
                                  <TableHead className="text-[#2980b9] font-semibold">Concepto</TableHead>
                                  <TableHead className="text-[#2980b9] font-semibold">Referencia</TableHead>
                                  <TableHead className="text-right text-[#2980b9] font-semibold">Importe</TableHead>
                                  {planLimits.canEdit && (
                                    <TableHead className="text-center text-[#2980b9] font-semibold">Acciones</TableHead>
                                  )}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {getDisplayedTransactionsForFile(uploadedFile, uploadedFile.expanded).map((transaction, index) => (
                                  <TableRow key={index} className="hover:bg-[#6dd5fa]/5">
                                    {/* Fecha */}
                                    <TableCell>
                                      {editingIndex === index && editingFileId === uploadedFile.id ? (
                                        <Input
                                          value={editedTransaction?.fecha || ""}
                                          onChange={(e) =>
                                            setEditedTransaction((prev) =>
                                              prev ? { ...prev, fecha: e.target.value } : null,
                                            )
                                          }
                                          className="w-full text-sm"
                                        />
                                      ) : (
                                        <span className="font-medium text-gray-900">{transaction.fecha}</span>
                                      )}
                                    </TableCell>
                                    
                                    {/* Concepto */}
                                    <TableCell>
                                      {editingIndex === index && editingFileId === uploadedFile.id ? (
                                        <Input
                                          value={editedTransaction?.concepto || ""}
                                          onChange={(e) =>
                                            setEditedTransaction((prev) =>
                                              prev ? { ...prev, concepto: e.target.value } : null,
                                            )
                                          }
                                          className="w-full text-sm"
                                        />
                                      ) : (
                                        <span className="text-gray-900">{transaction.concepto}</span>
                                      )}
                                    </TableCell>
                                    
                                    {/* Referencia */}
                                    <TableCell>
                                      {editingIndex === index && editingFileId === uploadedFile.id ? (
                                        <Input
                                          value={editedTransaction?.referencia || ""}
                                          onChange={(e) =>
                                            setEditedTransaction((prev) =>
                                              prev ? { ...prev, referencia: e.target.value } : null,
                                            )
                                          }
                                          className="w-full text-sm"
                                        />
                                      ) : (
                                        <span className="text-gray-700">{transaction.referencia}</span>
                                      )}
                                    </TableCell>
                                    
                                    {/* Importe */}
                                    <TableCell className="text-right">
                                      {editingIndex === index && editingFileId === uploadedFile.id ? (
                                        <Input
                                          value={editedTransaction?.importe || ""}
                                          onChange={(e) =>
                                            setEditedTransaction((prev) =>
                                              prev ? { ...prev, importe: e.target.value } : null,
                                            )
                                          }
                                          className="w-full text-sm text-right font-mono"
                                        />
                                      ) : (
                                        <span
                                          className={`font-mono ${
                                            transaction.importe.startsWith("-") ? "text-red-600" : "text-green-600"
                                          }`}
                                        >
                                          {transaction.importe}
                                        </span>
                                      )}
                                    </TableCell>
                                    
                                    {/* Acciones */}
                                    <TableCell className="text-center">
                                      {editingIndex === index && editingFileId === uploadedFile.id ? (
                                        // Modo edición
                                        <div className="flex gap-1 justify-center">
                                          <Button
                                            size="sm"
                                            onClick={() => saveEdit()}
                                            className="h-8 w-8 p-0 bg-[#2980b9] hover:bg-[#1e5f8b]"
                                          >
                                            <Save className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => cancelEditing()}
                                            className="h-8 w-8 p-0 bg-transparent"
                                          >
                                            <X className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      ) : (
                                        // Modo visual
                                        <div className="flex gap-1 justify-center">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => startEditing(index, transaction, uploadedFile.id)}
                                            className="h-8 w-8 p-0"
                                            title={
                                              canEditTransaction(index) 
                                                ? "Editar transacción" 
                                                : "Requiere plan Pro o Premium"
                                            }
                                            disabled={!canEditTransaction(index)}
                                          >
                                            <Edit2 className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant={transaction.importe.startsWith("-") ? "destructive" : "default"}
                                            onClick={() => toggleSign(index, uploadedFile.id)}
                                            className="h-8 px-2 text-xs"
                                            title={
                                              canEditTransaction(index)
                                                ? "Cambiar entre débito/crédito"
                                                : "Requiere plan Pro o Premium"
                                            }
                                            disabled={!canEditTransaction(index)}
                                          >
                                            {transaction.importe.startsWith("-") ? "D" : "C"}
                                          </Button>
                                        </div>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>

                          {uploadedFile.processedData.transacciones.length > 5 && (
                            <div className="mt-2 flex flex-col items-center gap-2">
                              {!uploadedFile.expanded && (
                                <p className="text-sm text-gray-600 text-center">
                                  Mostrando 5 de {uploadedFile.processedData.transacciones.length} transacciones.
                                </p>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => toggleFileExpansion(uploadedFile.id)}
                                className="border-[#2980b9] text-[#2980b9] hover:bg-[#2980b9] hover:text-white"
                              >
                                {uploadedFile.expanded ? (
                                  <>
                                    <ChevronUp className="h-4 w-4 mr-1" />
                                    Contraer
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-4 w-4 mr-1" />
                                    Expandir
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      ),
                  )}
                </div>
              ) : (
                // Single file display (Free/Pro plans)
                processedData && (
                  <>
                    {/* Bank Info */}
                    <div className="flex flex-wrap gap-4 justify-center">
                      <Badge variant="secondary" className="text-sm px-3 py-1 bg-[#2980b9] text-white">
                        {processedData.banco}
                      </Badge>
                      <Badge variant="outline" className="text-sm px-3 py-1 border-[#2980b9] text-[#2980b9]">
                        {processedData.tipo}
                      </Badge>
                      <Badge variant="outline" className="text-sm px-3 py-1 border-[#2980b9] text-[#2980b9]">
                        {processedData.periodo}
                      </Badge>
                      <Badge variant="outline" className="text-sm px-3 py-1 border-[#6dd5fa] text-[#2980b9]">
                        <Layers className="h-3 w-3 mr-1" />
                        {processedData.totalPages} página{processedData.totalPages > 1 ? "s" : ""}
                      </Badge>
                    </div>

                    {/* Show All Toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Switch id="show-all" checked={showAllTransactions} onCheckedChange={setShowAllTransactions} />
                        <label htmlFor="show-all" className="text-sm font-medium cursor-pointer text-gray-700">
                          {showAllTransactions ? (
                            <>
                              <EyeOff className="h-4 w-4 inline mr-1" />
                              Mostrar solo 10
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4 inline mr-1" />
                              Mostrar todas ({processedData.transacciones.length})
                            </>
                          )}
                        </label>
                      </div>
                      <div className="text-sm text-gray-600">
                        Total: {processedData.transacciones.length} transacciones
                      </div>
                    </div>

                    {/* Transactions Table */}
                    <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-[#2980b9]/5">
                            <TableHead className="text-[#2980b9] font-semibold">Fecha</TableHead>
                            <TableHead className="text-[#2980b9] font-semibold">Concepto</TableHead>
                            <TableHead className="text-[#2980b9] font-semibold">Referencia</TableHead>
                            <TableHead className="text-right text-[#2980b9] font-semibold">Importe</TableHead>
                            <TableHead className="text-center text-[#2980b9] font-semibold">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {displayedTransactions.map((transaction, index) => (
                            <TableRow key={index} className="hover:bg-[#6dd5fa]/5">
                              {editingIndex === index ? (
                                // Editing mode
                                <>
                                  <TableCell>
                                    <Input
                                      value={editedTransaction?.fecha || ""}
                                      onChange={(e) =>
                                        setEditedTransaction((prev) =>
                                          prev ? { ...prev, fecha: e.target.value } : null,
                                        )
                                      }
                                      className="w-full"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      value={editedTransaction?.concepto || ""}
                                      onChange={(e) =>
                                        setEditedTransaction((prev) =>
                                          prev ? { ...prev, concepto: e.target.value } : null,
                                        )
                                      }
                                      className="w-full"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      value={editedTransaction?.referencia || ""}
                                      onChange={(e) =>
                                        setEditedTransaction((prev) =>
                                          prev ? { ...prev, referencia: e.target.value } : null,
                                        )
                                      }
                                      className="w-full"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      value={editedTransaction?.importe || ""}
                                      onChange={(e) =>
                                        setEditedTransaction((prev) =>
                                          prev ? { ...prev, importe: e.target.value } : null,
                                        )
                                      }
                                      className="w-full text-right font-mono"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex gap-1 justify-center">
                                      <Button
                                        size="sm"
                                        onClick={saveEdit}
                                        className="h-8 w-8 p-0 bg-[#2980b9] hover:bg-[#1e5f8b]"
                                      >
                                        <Save className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={cancelEditing}
                                        className="h-8 w-8 p-0 bg-transparent"
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </>
                              ) : (
                                // Display mode
                                <>
                                  <TableCell className="font-medium text-gray-900">{transaction.fecha}</TableCell>
                                  <TableCell className="text-gray-900">{transaction.concepto}</TableCell>
                                  <TableCell className="text-gray-700">{transaction.referencia}</TableCell>
                                  <TableCell
                                    className={`text-right font-mono ${
                                      transaction.importe.startsWith("-") ? "text-red-600" : "text-green-600"
                                    }`}
                                  >
                                    {transaction.importe}
                                  </TableCell>
                                  {editingIndex === index ? (
                                    // En modo de edición, mostrar celda vacía pero mantener el estilo
                                    <TableCell className="text-center">
                                      <div className="h-8"></div>
                                    </TableCell>
                                  ) : (
                                    // Modo visual normal
                                    <TableCell>
                                      <div className="flex gap-1 justify-center">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => startEditing(index, transaction)}
                                          className="h-8 w-8 p-0"
                                          title={
                                            canEditTransaction(index) 
                                              ? "Editar transacción" 
                                              : "Requiere plan Pro o Premium"
                                          }
                                          disabled={!canEditTransaction(index)}
                                        >
                                          <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant={transaction.importe.startsWith("-") ? "destructive" : "default"}
                                          onClick={() => toggleSign(index)}
                                          className="h-8 px-2 text-xs"
                                          title={
                                            canEditTransaction(index)
                                              ? "Cambiar entre débito/crédito"
                                              : "Requiere plan Pro o Premium"
                                          }
                                          disabled={!canEditTransaction(index)}
                                        >
                                          {transaction.importe.startsWith("-") ? "D" : "C"}
                                        </Button>
                                      </div>
                                    </TableCell>
                                  )}
                                </>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {!showAllTransactions && processedData.transacciones.length > 10 && (
                      <p className="text-sm text-gray-600 text-center">
                        Mostrando 10 de {processedData.transacciones.length} transacciones. Activa el interruptor arriba
                        para ver todas.
                      </p>
                    )}
                  </>
                )
              )}

              {(planLimits.canEdit || currentPlan === "free" || currentPlan === "anonymous") && (
                <div className="bg-[#6dd5fa]/5 border border-[#6dd5fa]/20 rounded-lg p-4">
                  <h4 className="font-medium text-[#2980b9] mb-2">💡 Cómo editar:</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>
                      • <strong>Editar:</strong> Haz clic en el ícono de lápiz para editar cualquier campo
                      {currentPlan === "free" && " (solo las primeras 3 líneas)"}
                      {currentPlan === "anonymous" && " (solo las primeras 3 líneas)"}
                    </li>
                    <li>
                      • <strong>Cambiar signo:</strong> Haz clic en &quot;D&quot; (débito) o &quot;C&quot; (crédito) para cambiar el signo
                      {currentPlan === "free" && " (solo las primeras 3 líneas)"}
                      {currentPlan === "anonymous" && " (solo las primeras 3 líneas)"}
                    </li>
                    {currentPlan === "premium" && (
                      <li>
                        • <strong>Expandir:</strong> Haz clic en &quot;Expandir&quot; para ver todas las transacciones de un
                        archivo
                      </li>
                    )}
                    {currentPlan !== "premium" && (
                      <li>
                        • <strong>Ver todas:</strong> Activa el interruptor para ver todas las transacciones
                      </li>
                    )}
                    {(currentPlan === "free" || currentPlan === "anonymous") && (
                      <li>
                        • <strong>Limitación:</strong> Solo puedes editar las primeras 3 líneas. Suscríbete al plan Pro para editar todas las transacciones.
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Plan Upgrade Section */}
              {currentPlan !== "premium" &&
                (() => {
                  const nextPlan = getNextPlanFeatures()
                  return nextPlan ? (
                    <div className="bg-[#6dd5fa]/5 border border-[#6dd5fa]/20 rounded-lg p-4">
                      <h4 className="font-medium text-[#2980b9] mb-2">{nextPlan.title}</h4>
                      <p className="text-sm text-gray-700 mb-3">{nextPlan.subtitle}</p>
                      <ul className="text-sm text-gray-700 space-y-1 mb-3">
                        {nextPlan.features.map((feature, index) => (
                          <li key={index}>• {feature}</li>
                        ))}
                      </ul>
                      <Button
                        size="sm"
                        onClick={() => setShowPricing(true)}
                        className="bg-[#2980b9] hover:bg-[#1e5f8b]"
                      >
                        {nextPlan.buttonText}
                      </Button>
                    </div>
                  ) : null
                })()}

              {/* Premium Enterprise Section */}
              {currentPlan === "premium" && (
                <div className="bg-gradient-to-r from-[#2980b9]/5 to-[#6dd5fa]/5 border border-[#2980b9]/20 rounded-lg p-4">
                  <h4 className="font-medium text-[#2980b9] mb-2 flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    ¿Necesitas más capacidad?
                  </h4>
                  <p className="text-sm text-gray-700 mb-3">
                    Para empresas con necesidades de procesamiento masivo, ofrecemos planes Enterprise personalizados.
                  </p>
                  <ul className="text-sm text-gray-700 space-y-1 mb-3">
                    <li>• Páginas ilimitadas</li>
                    <li>• API dedicada</li>
                    <li>• Integración personalizada</li>
                    <li>• Soporte 24/7 dedicado</li>
                  </ul>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#2980b9] text-[#2980b9] hover:bg-[#2980b9] hover:text-white bg-transparent"
                  >
                    <Mail className="h-4 w-4 mr-1" />
                    Contactar Ventas
                  </Button>
                </div>
              )}

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={resetProcess}
                  className="flex-1 border-[#2980b9] text-[#2980b9] hover:bg-[#2980b9] hover:text-white bg-transparent"
                >
                  Subir Otro Archivo
                </Button>
                <Button onClick={downloadExcel} className="flex-1 bg-[#2980b9] hover:bg-[#1e5f8b]">
                  <Download className="h-4 w-4 mr-2" />
                  {currentPlan === "premium" && uploadedFiles.length > 1 
                    ? "Descargar - Múltiples Hojas "
                    : "Descargar "
                  }(
                  {currentPlan === "premium" && uploadedFiles.length > 0
                    ? uploadedFiles.reduce((sum, f) => sum + (f.processedData?.transacciones.length || 0), 0)
                    : processedData?.transacciones.length || 0}{" "}
                  transacciones)
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <Card className="mb-6 bg-white/95 backdrop-blur-sm border-[#6dd5fa]/20 shadow-lg">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle className="h-6 w-6" />
                ¡Conversión Completada!
              </CardTitle>
              <CardDescription className="text-gray-600">
                Tu{currentPlan === "premium" && uploadedFiles.length > 1 ? "s" : ""} archivo
                {currentPlan === "premium" && uploadedFiles.length > 1 ? "s" : ""} Excel
                {currentPlan === "premium" && uploadedFiles.length > 1 ? " han" : " ha"} sido generado
                {currentPlan === "premium" && uploadedFiles.length > 1 ? "s" : ""} y descargado
                {currentPlan === "premium" && uploadedFiles.length > 1 ? "s" : ""} exitosamente
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                {currentPlan === "premium" && uploadedFiles.length > 0 ? (
                  <div>
                    <p className="text-green-800 font-medium">
                      Se procesaron {uploadedFiles.length} archivo{uploadedFiles.length > 1 ? "s" : ""} con un total de{" "}
                      {uploadedFiles.reduce((sum, f) => sum + (f.processedData?.transacciones.length || 0), 0)}{" "}
                      transacciones
                    </p>
                    <p className="text-sm text-green-600 mt-2">
                      Páginas procesadas: {uploadedFiles.reduce((sum, f) => sum + f.pages, 0)}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-green-800 font-medium">
                      El archivo Excel contiene {processedData?.transacciones.length} transacciones de{" "}
                      {processedData?.totalPages} página
                      {processedData?.totalPages && processedData.totalPages > 1 ? "s" : ""}
                    </p>
                    <p className="text-sm text-green-600 mt-2">Banco detectado: {processedData?.banco}</p>
                  </div>
                )}
              </div>

              <Button onClick={resetProcess} size="lg" className="bg-[#2980b9] hover:bg-[#1e5f8b]">
                Convertir Otro{currentPlan === "premium" ? "s" : ""} Resumen{currentPlan === "premium" ? "es" : ""}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card className="bg-white/90 backdrop-blur-sm border-[#6dd5fa]/20">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-[#2980b9] mb-2">Bancos Argentinos Soportados:</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-700">
              <span>• Banco Nación</span>
              <span>• BBVA</span>
              <span>• Banco Galicia</span>
              <span>• Santander</span>
              <span>• ICBC</span>
              <span>• Banco Macro</span>
              <span>• Banco Ciudad</span>
              <span>• Y más...</span>
            </div>
          </CardContent>
        </Card>

        {/* Upgrade Modal for Free Plan */}
        {showUpgradeModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowUpgradeModal(false)}
          >
            <Card className="w-full max-w-md bg-white" onClick={(e) => e.stopPropagation()}>
              <CardHeader className="text-center">
                <CardTitle className="text-xl text-[#2980b9] flex items-center justify-center gap-2">
                  <Lock className="h-5 w-5" />
                  Función Bloqueada
                </CardTitle>
                <CardDescription>Esta función requiere el Plan Pro</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-[#6dd5fa]/5 border border-[#6dd5fa]/20 rounded-lg p-4">
                  <h4 className="font-medium text-[#2980b9] mb-2">Con el Plan Pro obtienes:</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• ✏️ Edición manual completa</li>
                    <li>• 📄 120 páginas por mes</li>
                    <li>• ⚡ Procesamiento prioritario</li>
                    <li>• 🛠️ Soporte técnico</li>
                  </ul>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setShowUpgradeModal(false)} className="flex-1">
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => {
                      setShowUpgradeModal(false)
                      setShowPricing(true)
                    }}
                    className="flex-1 bg-[#2980b9] hover:bg-[#1e5f8b]"
                  >
                    <Crown className="h-4 w-4 mr-1" />
                    Actualizar a Pro
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Pricing Modal */}
        {showPricing && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowPricing(false)
              if (pricingOpenedFromAccount) {
                setPricingOpenedFromAccount(false)
                setShowAccountModal(true)
              }
            }}
          >
            <Card
              className="w-full max-w-5xl bg-white max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <CardHeader className="text-center">
                <CardTitle className="text-2xl bg-gradient-to-r from-[#2980b9] to-[#6dd5fa] bg-clip-text text-transparent">
                  Planes y Precios
                </CardTitle>
                <CardDescription>Elige el plan que mejor se adapte a tus necesidades de procesamiento</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6 items-stretch">
                  {/* Plan Gratuito */}
                  <Card
                    className={`border-2 ${currentPlan === "free" ? "border-[#2980b9] bg-[#2980b9]/5" : "border-gray-200"} relative flex flex-col h-full`}
                  >
                    {currentPlan === "free" && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <Badge className="bg-[#2980b9] text-white">Plan Actual</Badge>
                      </div>
                    )}
                    <CardHeader className="text-center">
                      <CardTitle className="text-lg">Gratuito</CardTitle>
                      <div className="text-3xl font-bold text-gray-900">$0</div>
                      <CardDescription>Para uso básico</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col flex-1 p-6">
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm">3 páginas por día</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm">Todos los bancos argentinos</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-[#2980b9]" />
                          <span className="text-sm">Edición de lineas modo prueba</span>
                        </div>
                      </div>
                      <Button className="w-full bg-transparent mt-6" variant="outline" disabled={currentPlan === "free"}>
                        {currentPlan === "free" ? "Plan Actual" : "Seleccionar"}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Plan Pro */}
                  <Card
                    className={`border-2 ${currentPlan === "pro" ? "border-[#2980b9] bg-[#2980b9]/5" : "border-[#2980b9]"} relative flex flex-col h-full`}
                  >
                    {currentPlan === "pro" ? (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <Badge className="bg-[#2980b9] text-white">Plan Actual</Badge>
                      </div>
                    ) : currentPlan === "free" ? (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <Badge className="bg-[#2980b9] text-white">Más Popular</Badge>
                      </div>
                    ) : null}
                    <CardHeader className="text-center">
                      <CardTitle className="text-lg text-[#2980b9]">Pro</CardTitle>
                      <div className="text-3xl font-bold text-[#2980b9]">$35.000</div>
                      <CardDescription>por mes</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col flex-1 p-6">
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm">120 páginas por mes</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm">Edición manual completa</span>
                        </div>
                       
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-[#2980b9]" />
                          <span className="text-sm">Procesamiento prioritario</span>
                        </div>
                      </div>
                      <Button className="w-full bg-[#2980b9] hover:bg-[#1e5f8b] mt-6" disabled={currentPlan === "pro"}>
                        {currentPlan === "pro" ? "Plan Actual" : "Suscribirse Pro"}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Plan Premium */}
                  <Card
                    className={`border-2 ${currentPlan === "premium" ? "border-[#2980b9] bg-[#2980b9]/5" : "border-[#6dd5fa]"} relative flex flex-col h-full`}
                  >
                    {currentPlan === "premium" && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <Badge className="bg-[#2980b9] text-white">Plan Actual</Badge>
                      </div>
                    )}
                    <CardHeader className="text-center">
                      <CardTitle className="text-lg text-[#2980b9]">Premium</CardTitle>
                      <div className="text-3xl font-bold text-[#2980b9]">$55.000</div>
                      <CardDescription>por mes</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col flex-1 p-6">
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm">300 páginas por mes</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm">Subir múltiples resúmenes</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4 text-[#2980b9]" />
                          <span className="text-sm">Chat con IA</span>
                        </div>
                        <p className="text-xs text-gray-500 pt-1 italic">
                          + todas las funcionalidades del Plan Pro
                        </p>
                      </div>
                  
                      <Button
                        className="w-full bg-gradient-to-r from-[#2980b9] to-[#6dd5fa] hover:from-[#1e5f8b] hover:to-[#5bc3e8] mt-6"
                        disabled={currentPlan === "premium"}
                      >
                        {currentPlan === "premium" ? "Plan Actual" : "Suscribirse Premium"}
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex justify-center mt-6">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowPricing(false)
                      if (pricingOpenedFromAccount) {
                        setPricingOpenedFromAccount(false)
                        setShowAccountModal(true)
                      }
                    }}
                  >
                    Cerrar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Login Modal */}
        <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />

        <Dialog 
          open={showHistoryModal} 
          onOpenChange={(open) => {
            setShowHistoryModal(open)
            if (!open && historyOpenedFromAccount) {
              setHistoryOpenedFromAccount(false)
              setShowAccountModal(true)
            }
          }}
        >
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-[#2980b9]">
                <History className="h-5 w-5" />
                Historial de Conversiones
              </DialogTitle>
            </DialogHeader>

            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2980b9]"></div>
              </div>
            ) : conversionHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No tienes conversiones registradas aún.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Archivo</TableHead>
                    <TableHead>Banco</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Páginas</TableHead>
                    <TableHead>Transacciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conversionHistory.map((conversion) => (
                    <TableRow key={conversion.id}>
                      <TableCell>
                        {new Date(conversion.created_at).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="font-medium">{conversion.filename}</TableCell>
                      <TableCell>{conversion.bank_name}</TableCell>
                      <TableCell>{conversion.account_type}</TableCell>
                      <TableCell>{conversion.period}</TableCell>
                      <TableCell>{conversion.pages_count}</TableCell>
                      <TableCell>{conversion.transactions_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DialogContent>
        </Dialog>

        {/* Mi Cuenta Modal */}
        <Dialog 
          open={showAccountModal} 
          onOpenChange={(open) => {
            setShowAccountModal(open)
            if (!open) {
              setEditingName(false)
              setEditingEmail(false)
              setProfileError("")
              setProfileSuccess("")
              setHistoryOpenedFromAccount(false)
              setPricingOpenedFromAccount(false)
            } else {
              setNewName(profile?.name || "")
              setNewEmail(user?.email || "")
            }
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-[#2980b9]">
                <User className="h-5 w-5" />
                Mi Cuenta
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Información del Usuario */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[#2980b9]">Información Personal</h3>
                
                {profileError && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertDescription className="text-red-800">{profileError}</AlertDescription>
                  </Alert>
                )}

                {profileSuccess && (
                  <Alert className="border-green-200 bg-green-50">
                    <AlertDescription className="text-green-800">{profileSuccess}</AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-[#2980b9] rounded-full flex items-center justify-center text-white flex-shrink-0">
                      <User className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-[#2980b9] text-white uppercase">
                          {currentPlan === "free" ? "FREE" : currentPlan === "pro" ? "PRO" : "PREMIUM"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Nombre */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Nombre</label>
                    {editingName ? (
                      <div className="flex gap-2">
                        <Input
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="Tu nombre completo"
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={async () => {
                            if (!newName.trim()) {
                              setProfileError("El nombre no puede estar vacío")
                              return
                            }
                            setUpdatingProfile(true)
                            setProfileError("")
                            setProfileSuccess("")
                            const result = await updateUserName(newName.trim())
                            if (result.success) {
                              setEditingName(false)
                              setProfileSuccess("Nombre actualizado exitosamente")
                              await refreshProfile()
                            } else {
                              setProfileError(result.message)
                            }
                            setUpdatingProfile(false)
                          }}
                          disabled={updatingProfile}
                          className="bg-[#2980b9] hover:bg-[#1e5f8b]"
                        >
                          {updatingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingName(false)
                            setNewName(profile?.name || "")
                            setProfileError("")
                          }}
                          disabled={updatingProfile}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-2 bg-white rounded border">
                        <span className="text-gray-900">
                          {profile?.name || user?.email?.split("@")[0] || "Usuario"}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingName(true)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Email</label>
                    {editingEmail ? (
                      <div className="flex gap-2">
                        <Input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="tu@email.com"
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={async () => {
                            if (!newEmail.trim() || !newEmail.includes("@")) {
                              setProfileError("Por favor ingresa un email válido")
                              return
                            }
                            setUpdatingProfile(true)
                            setProfileError("")
                            setProfileSuccess("")
                            const result = await updateUserEmail(newEmail.trim())
                            if (result.success) {
                              setEditingEmail(false)
                              setProfileSuccess(result.message)
                              await refreshProfile()
                            } else {
                              setProfileError(result.message)
                            }
                            setUpdatingProfile(false)
                          }}
                          disabled={updatingProfile}
                          className="bg-[#2980b9] hover:bg-[#1e5f8b]"
                        >
                          {updatingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingEmail(false)
                            setNewEmail(user?.email || "")
                            setProfileError("")
                          }}
                          disabled={updatingProfile}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-2 bg-white rounded border">
                        <span className="text-gray-900">{user?.email}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingEmail(true)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Plan y Suscripción */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[#2980b9]">Plan y Suscripción</h3>
                  {(currentPlan === "pro" || currentPlan === "premium") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowAccountModal(false)
                        setPricingOpenedFromAccount(true)
                        setShowPricing(true)
                      }}
                      className="border-[#2980b9] text-[#2980b9] hover:bg-[#2980b9] hover:text-white"
                    >
                      <Crown className="h-4 w-4 mr-1" />
                      Cambiar Plan
                    </Button>
                  )}
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Plan Actual</span>
                    <Badge className="bg-[#2980b9] text-white uppercase">
                      {currentPlan === "free" ? "FREE" : currentPlan === "pro" ? "PRO" : "PREMIUM"}
                    </Badge>
                  </div>

                  {currentPlan === "free" && (
                    <Button
                      variant="outline"
                      className="w-full border-[#2980b9] text-[#2980b9] hover:bg-[#2980b9] hover:text-white"
                      onClick={() => {
                        setShowAccountModal(false)
                        setPricingOpenedFromAccount(true)
                        setShowPricing(true)
                      }}
                    >
                      <Crown className="h-4 w-4 mr-2" />
                      Suscribirse a un Plan
                    </Button>
                  )}

                  {/* Uso del Plan */}
                  <div className="pt-2 border-t">
                    {currentPlan === "free" ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Páginas usadas hoy</span>
                          <span className="text-sm font-medium text-gray-900">
                            {realUsage.dailyUsage}/{planLimits.dailyPages || 0}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-[#2980b9] h-2 rounded-full transition-all"
                            style={{ width: `${planLimits.dailyPages ? (realUsage.dailyUsage / planLimits.dailyPages) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Páginas usadas este mes</span>
                          <span className="text-sm font-medium text-gray-900">
                            {realUsage.monthlyUsage}/{planLimits.monthlyPages || 0}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-[#2980b9] h-2 rounded-full transition-all"
                            style={{ width: `${planLimits.monthlyPages ? (realUsage.monthlyUsage / planLimits.monthlyPages) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  className="flex-1 border-[#2980b9] text-[#2980b9] hover:bg-[#2980b9] hover:text-white"
                  onClick={() => {
                    setShowAccountModal(false)
                    setHistoryOpenedFromAccount(true)
                    setShowHistoryModal(true)
                    fetchConversionHistory()
                  }}
                >
                  <History className="h-4 w-4 mr-2" />
                  Historial
                </Button>

                <Button
                  variant="outline"
                  className="flex-1 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                  onClick={() => {
                    setShowAccountModal(false)
                    handleLogout()
                  }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Salir
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Anonymous Registration Modal */}
        <AnonymousRegistrationModal
          isOpen={showAnonymousModal}
          onClose={handleAnonymousModalClose}
          onRegister={handleAnonymousRegister}
          fileName={anonymousFileInfo.fileName}
          pageCount={anonymousFileInfo.pageCount}
        />

        {/* Chat IA Floating Button - Premium Feature */}
        {currentPlan === "premium" && (
          <>
            {/* Floating Chat Button - Solo visible cuando el chat está cerrado */}
            {!showChat && (
              <div className="fixed bottom-6 right-6 z-50">
                <div className="flex flex-col items-center gap-2">
                  <Button
                    onClick={() => setShowChat(true)}
                    className="h-16 w-16 rounded-full bg-gradient-to-r from-[#2980b9] to-[#6dd5fa] hover:from-[#1e5f8b] hover:to-[#5bc3e8] shadow-2xl border-0 text-white flex items-center justify-center transition-all duration-300 hover:scale-110"
                  >
                    <MessageCircle className="h-8 w-8" />
                  </Button>
                  <span className="text-sm font-medium text-[#2980b9]">Chat IA</span>
                </div>
              </div>
            )}

            {/* Chat Window - Floating */}
            {showChat && (
              <div className="fixed bottom-6 right-6 z-40 w-96 h-[420px] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                {/* Chat Header - Altura fija */}
                <div className="bg-gradient-to-r from-[#2980b9] to-[#6dd5fa] p-3 text-white h-14 flex items-center">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-5 w-5" />
                      <h3 className="font-semibold">Chat con IA</h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowChat(false)}
                      className="text-white hover:bg-white/20 h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Chat Content - Altura calculada */}
                <div className="flex flex-col h-[calc(420px-56px)]">
                  {/* Messages Area - Altura fija con scroll */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
                    {chatMessages.length === 0 ? (
                      <div className="text-center text-gray-500 py-4">
                        <MessageCircle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                        <h4 className="font-medium mb-2">¡Hola! Soy tu asistente IA</h4>
                        <p className="text-sm">
                          {uploadedFiles.filter((f) => f.processedData).length > 0
                            ? "Pregúntame sobre tus resúmenes bancarios procesados"
                            : "Primero sube y procesa tus resúmenes bancarios para poder analizarlos"}
                        </p>
                        {uploadedFiles.filter((f) => f.processedData).length === 0 && (
                          <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-xs text-blue-800">
                              💡 <strong>Tip:</strong> Ve al Paso 1, sube tus PDFs y luego al Paso 2 para procesarlos. 
                              Una vez procesados, podrás chatear conmigo sobre tus transacciones.
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {chatMessages.map((message, index) => (
                          <div
                            key={index}
                            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[320px] px-3 py-2 rounded-xl text-sm ${
                                message.role === "user" 
                                  ? "bg-[#2980b9] text-white" 
                                  : "bg-gray-100 border border-gray-200"
                              }`}
                            >
                              <div 
                                className="leading-relaxed chat-ai-content"
                                dangerouslySetInnerHTML={{ __html: message.content }}
                              />
                              <p className={`text-xs mt-1 ${message.role === "user" ? "text-blue-100" : "text-gray-500"}`}>
                                {message.timestamp.toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        ))}
                        {chatLoading && (
                          <div className="flex justify-start">
                            <div className="bg-gray-100 border border-gray-200 px-3 py-2 rounded-xl">
                              <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                <div
                                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                                  style={{ animationDelay: "0.1s" }}
                                ></div>
                                <div
                                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                                  style={{ animationDelay: "0.2s" }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        )}
                        {/* Elemento invisible para hacer scroll automático */}
                        <div ref={chatMessagesEndRef} />
                      </div>
                    )}
                  </div>

                  {/* Input Area - Altura fija siempre visible */}
                  <div className="border-t p-3 bg-gray-50 flex-shrink-0">
                    <div className="flex gap-3">
                      <Textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder={
                          uploadedFiles.filter((f) => f.processedData).length > 0
                            ? "Pregunta sobre tus transacciones..."
                            : "Primero procesa tus resúmenes..."
                        }
                        className="flex-1 min-h-[40px] max-h-[80px] resize-none rounded-lg border-gray-300 focus:border-[#2980b9] focus:ring-[#2980b9] text-sm shadow-sm"
                        disabled={uploadedFiles.filter((f) => f.processedData).length === 0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault()
                            sendChatMessage()
                          }
                        }}
                      />
                      <Button
                        onClick={sendChatMessage}
                        disabled={!chatInput.trim() || chatLoading || uploadedFiles.filter((f) => f.processedData).length === 0}
                        className="bg-[#2980b9] hover:bg-[#1e5f8b] px-3 rounded-lg h-[40px] min-w-[40px] shadow-sm"
                      >
                        {chatLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    
                    {uploadedFiles.filter((f) => f.processedData).length > 0 && (
                      <div className="mt-2 text-xs text-gray-500 text-center">
                        💡 Pregúntame sobre gastos, ingresos, patrones, etc.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
