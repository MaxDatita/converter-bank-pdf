import { supabase } from "./supabase"
import type { User } from "@supabase/supabase-js"

export interface UserProfile {
  id: string
  email: string
  name?: string
  avatar_url?: string
  plan: "free" | "pro" | "premium"
  onboarding_completed: boolean
  mp_subscription_id?: string | null
  mp_subscription_status?: "authorized" | "paused" | "cancelled" | "pending" | null
  subscription_updated_at?: string | null
  grace_period_until?: string | null
  created_at: string
  updated_at: string
}

export class AuthService {
  // Enviar código OTP por email usando Supabase Auth
  async sendOTPCode(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // No incluir emailRedirectTo para que use OTP en lugar de magic link
          shouldCreateUser: true,
        },
      })

      if (error) {
        console.error("Error sending OTP code:", error)
        return { success: false, message: error.message }
      }

      return {
        success: true,
        message: `Código de verificación enviado a ${email}. Revisa tu bandeja de entrada.`,
      }
    } catch (error) {
      console.error("Error sending OTP code:", error)
      return { success: false, message: "Error al enviar el código de verificación" }
    }
  }

  // Verificar código OTP
  async verifyOTP(
    email: string,
    token: string,
  ): Promise<{ success: boolean; message: string; needsOnboarding?: boolean }> {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      })

      if (error) {
        console.error("Error verifying OTP:", error)
        return { success: false, message: error.message }
      }

      if (!data.user) {
        return { success: false, message: "Error en la verificación" }
      }

      // Verificar si el usuario necesita completar onboarding
      const { data: profile } = await supabase.from("user_profiles").select("*").eq("id", data.user.id).single()

      const needsOnboarding = !profile?.onboarding_completed

      return {
        success: true,
        message: "Código verificado exitosamente",
        needsOnboarding,
      }
    } catch (error) {
      console.error("Error verifying OTP:", error)
      return { success: false, message: "Error al verificar el código" }
    }
  }

  // Iniciar sesión con Google usando Supabase Auth
  async signInWithGoogle(): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        console.error("Error signing in with Google:", error)
        return { success: false, message: error.message }
      }

      return { success: true, message: "Redirigiendo a Google..." }
    } catch (error) {
      console.error("Error signing in with Google:", error)
      return { success: false, message: "Error al iniciar sesión con Google" }
    }
  }

  // Obtener el usuario actual
  async getCurrentUser(): Promise<{ user: User | null; profile: UserProfile | null }> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return { user: null, profile: null }
      }

      // Obtener perfil del usuario
      const { data: profile, error } = await supabase.from("user_profiles").select("*").eq("id", user.id).single()

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching user profile:", error)
      }

      return { user, profile: profile as UserProfile }
    } catch (error) {
      console.error("Error getting current user:", error)
      return { user: null, profile: null }
    }
  }

  // Completar onboarding (nombre y plan)
  async completeOnboarding(
    userId: string,
    name: string,
    plan: "free" | "pro" | "premium",
  ): Promise<{ success: boolean; profile?: UserProfile; message: string }> {
    try {
      const { data: profile, error } = await supabase
        .from("user_profiles")
        .update({
          name,
          plan,
          onboarding_completed: true,
        })
        .eq("id", userId)
        .select()
        .single()

      if (error) {
        console.error("Error completing onboarding:", error)
        return { success: false, message: "Error al completar el registro" }
      }

      return {
        success: true,
        profile: profile as UserProfile,
        message: "Registro completado exitosamente",
      }
    } catch (error) {
      console.error("Error completing onboarding:", error)
      return { success: false, message: "Error al completar el registro" }
    }
  }

  // Cerrar sesión
  async signOut(): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error("Error signing out:", error)
        return { success: false, message: error.message }
      }

      return { success: true, message: "Sesión cerrada exitosamente" }
    } catch (error) {
      console.error("Error signing out:", error)
      return { success: false, message: "Error al cerrar sesión" }
    }
  }

  // Obtener uso actual del usuario
  async getUserUsage(userId: string): Promise<{
    dailyUsage: number
    monthlyUsage: number
    totalUsage: number
    currentMonth: number
    currentYear: number
  }> {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    const today = now.toISOString().split("T")[0]

    try {
      // Obtener uso diario
      const { data: dailyData } = await supabase
        .from("daily_usage")
        .select("pages_processed")
        .eq("user_id", userId)
        .eq("date", today)
        .single()

      // Obtener uso mensual
      const { data: monthlyData } = await supabase
        .from("monthly_usage")
        .select("pages_processed")
        .eq("user_id", userId)
        .eq("year", currentYear)
        .eq("month", currentMonth)
        .single()

      // Obtener total acumulado del usuario (todas las conversiones)
      const { data: totalData } = await supabase
        .from("conversion_history")
        .select("pages_count")
        .eq("user_id", userId)

      const totalUsage = totalData?.reduce((sum, record) => sum + (record.pages_count || 0), 0) || 0

      return {
        dailyUsage: dailyData?.pages_processed || 0,
        monthlyUsage: monthlyData?.pages_processed || 0,
        totalUsage,
        currentMonth,
        currentYear,
      }
    } catch (error) {
      console.error("Error getting user usage:", error)
      return {
        dailyUsage: 0,
        monthlyUsage: 0,
        totalUsage: 0,
        currentMonth,
        currentYear,
      }
    }
  }

  // Actualizar uso del usuario
  async updateUserUsage(userId: string, pagesProcessed: number, filesProcessed = 1): Promise<boolean> {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    const today = now.toISOString().split("T")[0]

    try {
      // Obtener uso actual diario
      const { data: currentDaily } = await supabase
        .from("daily_usage")
        .select("pages_processed, files_processed")
        .eq("user_id", userId)
        .eq("date", today)
        .single()

      // Obtener uso actual mensual
      const { data: currentMonthly } = await supabase
        .from("monthly_usage")
        .select("pages_processed, files_processed")
        .eq("user_id", userId)
        .eq("year", currentYear)
        .eq("month", currentMonth)
        .single()

      // Calcular nuevos totales
      const newDailyPages = (currentDaily?.pages_processed || 0) + pagesProcessed
      const newDailyFiles = (currentDaily?.files_processed || 0) + filesProcessed
      const newMonthlyPages = (currentMonthly?.pages_processed || 0) + pagesProcessed
      const newMonthlyFiles = (currentMonthly?.files_processed || 0) + filesProcessed

      // Actualizar uso diario
      await supabase.from("daily_usage").upsert(
        {
          user_id: userId,
          date: today,
          pages_processed: newDailyPages,
          files_processed: newDailyFiles,
        },
        {
          onConflict: "user_id,date",
          ignoreDuplicates: false,
        },
      )

      // Actualizar uso mensual
      await supabase.from("monthly_usage").upsert(
        {
          user_id: userId,
          year: currentYear,
          month: currentMonth,
          pages_processed: newMonthlyPages,
          files_processed: newMonthlyFiles,
        },
        {
          onConflict: "user_id,year,month",
          ignoreDuplicates: false,
        },
      )

      return true
    } catch (error) {
      console.error("Error updating user usage:", error)
      return false
    }
  }

  // Guardar historial de conversión
  async saveConversionHistory(
    userId: string,
    filename: string,
    bankName: string,
    accountType: string,
    period: string,
    pagesCount: number,
    transactionsCount: number,
  ): Promise<boolean> {
    try {
      const { error } = await supabase.from("conversion_history").insert({
        user_id: userId,
        filename,
        bank_name: bankName,
        account_type: accountType,
        period,
        pages_count: pagesCount,
        transactions_count: transactionsCount,
      })

      if (error) {
        console.error("Error saving conversion history:", error)
        return false
      }

      return true
    } catch (error) {
      console.error("Error saving conversion history:", error)
      return false
    }
  }

  // Actualizar nombre del usuario
  async updateUserName(userId: string, name: string): Promise<{ success: boolean; profile?: UserProfile; message: string }> {
    try {
      const { data: profile, error } = await supabase
        .from("user_profiles")
        .update({ name })
        .eq("id", userId)
        .select()
        .single()

      if (error) {
        console.error("Error updating user name:", error)
        return { success: false, message: "Error al actualizar el nombre" }
      }

      return {
        success: true,
        profile: profile as UserProfile,
        message: "Nombre actualizado exitosamente",
      }
    } catch (error) {
      console.error("Error updating user name:", error)
      return { success: false, message: "Error al actualizar el nombre" }
    }
  }

  // Actualizar email del usuario
  async updateUserEmail(newEmail: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail })

      if (error) {
        console.error("Error updating user email:", error)
        return { success: false, message: error.message }
      }

      // Actualizar email en el perfil también
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        await supabase.from("user_profiles").update({ email: newEmail }).eq("id", user.id)
      }

      return {
        success: true,
        message: "Se ha enviado un correo de confirmación a tu nuevo email",
      }
    } catch (error) {
      console.error("Error updating user email:", error)
      return { success: false, message: "Error al actualizar el email" }
    }
  }

  // Actualizar plan del usuario
  async updateUserPlan(userId: string, plan: "free" | "pro" | "premium"): Promise<{ success: boolean; profile?: UserProfile; message: string }> {
    try {
      const { data: profile, error } = await supabase
        .from("user_profiles")
        .update({ plan })
        .eq("id", userId)
        .select()
        .single()

      if (error) {
        console.error("Error updating user plan:", error)
        return { success: false, message: "Error al actualizar el plan" }
      }

      return {
        success: true,
        profile: profile as UserProfile,
        message: "Plan actualizado exitosamente",
      }
    } catch (error) {
      console.error("Error updating user plan:", error)
      return { success: false, message: "Error al actualizar el plan" }
    }
  }
}

export const authService = new AuthService()

export const getCurrentUser = () => authService.getCurrentUser()
