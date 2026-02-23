import { type NextRequest, NextResponse } from "next/server"
import { createSupabaseClient, createSupabaseAdminClient } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseClient()
    const supabaseAdmin = createSupabaseAdminClient()

    // Get user from authorization header
    const authHeader = request.headers.get('authorization')
    
    let user = null
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      
      try {
        const { data: { user: currentUser }, error } = await supabase.auth.getUser(token)
        if (!error && currentUser) {
          user = currentUser
        } else {
          console.error("Auth error:", error)
        }
      } catch (authError) {
        console.error("Error getting user from token:", authError)
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Try the normal Supabase query first
    const { data: conversions, error } = await supabase
      .from("conversion_history")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
    
    // If no results, try the SQL function
    if (!conversions || conversions.length === 0) {
      try {
        const { data: functionConversions, error: functionError } = await supabaseAdmin
          .rpc('debug_conversion_history', { user_uuid: user.id })
        
        if (!functionError && functionConversions && functionConversions.length > 0) {
          return NextResponse.json(functionConversions)
        }
      } catch {
        // SQL function not available, continue with normal results
      }
    }

    if (error) {
      console.error("Error fetching conversion history:", error)
      return NextResponse.json({ error: "Failed to fetch conversion history" }, { status: 500 })
    }

    return NextResponse.json(conversions || [])
  } catch (error) {
    console.error("Error in conversion history API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
