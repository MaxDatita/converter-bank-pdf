import { createSupabaseAdminClient } from "@/lib/supabase"
import { PLAN_LIMITS, ANONYMOUS_LIMITS } from "@/lib/supabase"
import { getEffectivePlan } from "@/lib/subscription"

export async function GET(request: Request) {
  try {
    const supabaseAdmin = createSupabaseAdminClient()
    
    // Get user from authorization header
    const authHeader = request.headers.get('authorization')
    let currentUser = null
    let userProfile = null
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      try {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
        if (!error && user) {
          currentUser = user
          
          // Get user profile to know the plan
          const { data: profile } = await supabaseAdmin
            .from("user_profiles")
            .select("*")
            .eq("id", user.id)
            .single()
          
          if (profile) {
            userProfile = profile
          }
        }
      } catch {
        // Token validation failed, continue as anonymous user
      }
    }
    
    // Get client IP address for anonymous tracking
    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     request.headers.get('x-real-ip') || 
                     '127.0.0.1'
    
    const now = new Date()
    const today = now.toISOString().split("T")[0]
    
    // Anonymous user
    if (!currentUser || !userProfile) {
      // Get usage from anonymous_usage table
      const { data: anonymousUsage } = await supabaseAdmin
        .from("anonymous_usage")
        .select("date, pages_processed, updated_at")
        .eq("ip_address", clientIP)
        .order("date", { ascending: false })
        .limit(1)
        .single()
      
      let lastConversionTime: Date | null = null
      
      // Determine last conversion time from anonymous_usage
      if (anonymousUsage?.updated_at) {
        lastConversionTime = new Date(anonymousUsage.updated_at)
      }
      
      const limit = ANONYMOUS_LIMITS.dailyPages
      
      // Check if 24 hours have passed since last conversion
      let canProcess = true
      let resetTime: Date | null = null
      let pagesUsed = 0
      
      if (lastConversionTime) {
        const hoursSinceLastConversion = (now.getTime() - lastConversionTime.getTime()) / (1000 * 60 * 60)
        canProcess = hoursSinceLastConversion >= 24
        
        if (!canProcess) {
          // Si no pasaron 24 horas, mostrar que ya usó su límite (1/1)
          pagesUsed = limit
          // Calculate reset time (24 hours from last conversion)
          resetTime = new Date(lastConversionTime.getTime() + 24 * 60 * 60 * 1000)
        } else {
          // Si pasaron 24 horas, puede procesar (0/1)
          pagesUsed = 0
        }
      } else {
        // No hay conversiones previas, puede procesar
        pagesUsed = 0
      }
      
      // Also check if already used today (backup check)
      if (anonymousUsage && anonymousUsage.date === today && anonymousUsage.pages_processed >= limit) {
        canProcess = false
        pagesUsed = limit
        if (!resetTime) {
          // Reset tomorrow at midnight
          const tomorrow = new Date(now)
          tomorrow.setDate(tomorrow.getDate() + 1)
          tomorrow.setHours(0, 0, 0, 0)
          resetTime = tomorrow
        }
      }
      
      return Response.json({
        canProcess,
        pagesUsed,
        limit,
        limitType: 'daily' as const,
        resetTime: resetTime?.toISOString() || null,
        plan: 'anonymous' as const,
      })
    }
    
    // Authenticated user — verificar que la suscripción MP esté activa
    const { effectivePlan, subscriptionLapsed } = getEffectivePlan({
      plan: userProfile.plan || 'free',
      mp_subscription_status: userProfile.mp_subscription_status ?? null,
      grace_period_until: userProfile.grace_period_until ?? null,
    })
    const plan = effectivePlan
    const planLimits = PLAN_LIMITS[plan]
    
    // Free plan: Check daily limit (24 hours from last conversion)
    if (plan === 'free') {
      // Get last conversion
      const { data: lastConversion } = await supabaseAdmin
        .from("conversion_history")
        .select("created_at")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(1)
      
      // Get today's usage
      const { data: dailyUsage } = await supabaseAdmin
        .from("daily_usage")
        .select("pages_processed")
        .eq("user_id", currentUser.id)
        .eq("date", today)
        .single()
      
      const limit = planLimits.dailyPages || 0
      
      let canProcess = true
      let resetTime: Date | null = null
      let pagesUsed = 0
      
      if (lastConversion && lastConversion.length > 0) {
        const lastConversionTime = new Date(lastConversion[0].created_at)
        const hoursSinceLastConversion = (now.getTime() - lastConversionTime.getTime()) / (1000 * 60 * 60)
        
        // Check if 24 hours have passed
        canProcess = hoursSinceLastConversion >= 24
        
        if (!canProcess) {
          // Si no pasaron 24 horas, mostrar que ya usó su límite
          pagesUsed = limit
          resetTime = new Date(lastConversionTime.getTime() + 24 * 60 * 60 * 1000)
        } else {
          // Si pasaron 24 horas, verificar uso del día actual
          pagesUsed = dailyUsage?.pages_processed || 0
        }
      } else {
        // No hay conversiones previas, usar el uso del día actual
        pagesUsed = dailyUsage?.pages_processed || 0
      }
      
      // Also check daily limit
      if (pagesUsed >= limit) {
        canProcess = false
        pagesUsed = limit
        if (!resetTime) {
          // Reset tomorrow at midnight
          const tomorrow = new Date(now)
          tomorrow.setDate(tomorrow.getDate() + 1)
          tomorrow.setHours(0, 0, 0, 0)
          resetTime = tomorrow
        }
      }
      
      return Response.json({
        canProcess,
        pagesUsed,
        limit,
        limitType: 'daily' as const,
        resetTime: resetTime?.toISOString() || null,
        plan,
        subscriptionLapsed,
      })
    }

    // Pro/Premium plan: Check monthly limit (rolling 30 days from subscription)
    if (plan === 'pro' || plan === 'premium') {
      const limit = planLimits.monthlyPages || 0
      
      // Get subscription start date (created_at from user_profile)
      const subscriptionStartDate = new Date(userProfile.created_at)
      
      // Calculate rolling 30-day window
      // Count conversions in the last 30 days from today
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      
      const { data: recentConversions } = await supabaseAdmin
        .from("conversion_history")
        .select("pages_count, created_at")
        .eq("user_id", currentUser.id)
        .gte("created_at", thirtyDaysAgo.toISOString())
      
      const pagesUsed = recentConversions?.reduce((sum, conv) => sum + (conv.pages_count || 0), 0) || 0
      
      const canProcess = pagesUsed < limit
      let resetTime: Date | null = null
      
      if (!canProcess) {
        // Find the oldest conversion in the last 30 days
        if (recentConversions && recentConversions.length > 0) {
          const oldestConversion = recentConversions.reduce((oldest, conv) => {
            const convDate = new Date(conv.created_at)
            return convDate < oldest ? convDate : oldest
          }, new Date(recentConversions[0].created_at))
          
          // Reset time is 30 days from the oldest conversion
          resetTime = new Date(oldestConversion.getTime() + 30 * 24 * 60 * 60 * 1000)
        } else {
          // If no conversions, reset is 30 days from subscription start
          resetTime = new Date(subscriptionStartDate.getTime() + 30 * 24 * 60 * 60 * 1000)
        }
      }
      
      return Response.json({
        canProcess,
        pagesUsed,
        limit,
        limitType: 'monthly' as const,
        resetTime: resetTime?.toISOString() || null,
        plan,
        subscriptionLapsed,
      })
    }
    
    // Default response
    return Response.json({
      canProcess: true,
      pagesUsed: 0,
      limit: 0,
      limitType: 'daily' as const,
      resetTime: null,
      plan: 'free' as const,
    })
  } catch (error) {
    console.error("Error checking usage limit:", error)
    // On error, allow processing (fail open)
    return Response.json({
      canProcess: true,
      pagesUsed: 0,
      limit: 0,
      limitType: 'daily' as const,
      resetTime: null,
      plan: 'anonymous' as const,
    })
  }
}

