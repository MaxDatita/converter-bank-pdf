"use client"

import type React from "react"

import { useState, useEffect, createContext, useContext } from "react"
import { supabase } from "@/lib/supabase"
import { authService, type UserProfile } from "@/lib/auth"
import type { User } from "@supabase/supabase-js"

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  sendOTPCode: (email: string) => Promise<{ success: boolean; message: string }>
  verifyOTP: (email: string, code: string) => Promise<{ success: boolean; message: string; needsOnboarding?: boolean }>
  signInWithGoogle: () => Promise<{ success: boolean; message: string }>
  completeOnboarding: (name: string, plan: "free" | "pro" | "premium") => Promise<{ success: boolean; message: string }>
  signOut: () => Promise<void>
  updateUsage: (pages: number, files?: number) => Promise<boolean>
  getUserUsage: () => Promise<{
    dailyUsage: number
    monthlyUsage: number
    currentMonth: number
    currentYear: number
  }>
  refreshProfile: () => Promise<void>
  updateUserName: (name: string) => Promise<{ success: boolean; message: string }>
  updateUserEmail: (email: string) => Promise<{ success: boolean; message: string }>
  updateUserPlan: (plan: "free" | "pro" | "premium") => Promise<{ success: boolean; message: string }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Obtener sesión inicial
    const getInitialSession = async () => {
      const { user: currentUser, profile: currentProfile } = await authService.getCurrentUser()
      setUser(currentUser)
      setProfile(currentProfile)
      setLoading(false)
    }

    getInitialSession()

    // Escuchar cambios de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setUser(session.user)

        // Obtener perfil del usuario
        const { data: userProfile } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", session.user.id)
          .single()

        setProfile(userProfile as UserProfile)
      } else if (event === "SIGNED_OUT") {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const sendOTPCode = async (email: string) => {
    return await authService.sendOTPCode(email)
  }

  const verifyOTP = async (email: string, code: string) => {
    return await authService.verifyOTP(email, code)
  }

  const signInWithGoogle = async () => {
    return await authService.signInWithGoogle()
  }

  const completeOnboarding = async (name: string, plan: "free" | "pro" | "premium") => {
    if (!user) return { success: false, message: "No hay usuario autenticado" }

    const result = await authService.completeOnboarding(user.id, name, plan)
    if (result.success && result.profile) {
      setProfile(result.profile)
    }
    return result
  }

  const signOut = async () => {
    await authService.signOut()
    setUser(null)
    setProfile(null)
  }

  const updateUsage = async (pages: number, files = 1): Promise<boolean> => {
    if (!user) return false
    return await authService.updateUserUsage(user.id, pages, files)
  }

  const getUserUsage = async () => {
    if (!user) {
      return {
        dailyUsage: 0,
        monthlyUsage: 0,
        currentMonth: new Date().getMonth() + 1,
        currentYear: new Date().getFullYear(),
      }
    }
    return await authService.getUserUsage(user.id)
  }

  const refreshProfile = async () => {
    if (!user) return

    const { data: userProfile } = await supabase.from("user_profiles").select("*").eq("id", user.id).single()

    if (userProfile) {
      setProfile(userProfile as UserProfile)
    }
  }

  const updateUserName = async (name: string) => {
    if (!user) return { success: false, message: "No hay usuario autenticado" }

    const result = await authService.updateUserName(user.id, name)
    if (result.success && result.profile) {
      setProfile(result.profile)
    }
    return result
  }

  const updateUserEmail = async (email: string) => {
    if (!user) return { success: false, message: "No hay usuario autenticado" }

    const result = await authService.updateUserEmail(email)
    if (result.success) {
      // Refrescar el perfil después de actualizar el email
      await refreshProfile()
    }
    return result
  }

  const updateUserPlan = async (plan: "free" | "pro" | "premium") => {
    if (!user) return { success: false, message: "No hay usuario autenticado" }

    const result = await authService.updateUserPlan(user.id, plan)
    if (result.success && result.profile) {
      setProfile(result.profile)
    }
    return result
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        sendOTPCode,
        verifyOTP,
        signInWithGoogle,
        completeOnboarding,
        signOut,
        updateUsage,
        getUserUsage,
        refreshProfile,
        updateUserName,
        updateUserEmail,
        updateUserPlan,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
