// FILE: app/api/reminders/proactive/route.ts

import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  return `${days} days ago`
}

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()

    const { data: authData } = await supabase.auth.getUser()
    const user = authData.user

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 }
      )
    }

    // Get recent notes (last 3 days)
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

    const { data: memories } = await supabase
      .from("memories_structured")
      .select("id, text, created_at")
      .eq("user_id", user.id)
      .eq("memory_type", "note")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5)

    if (!memories || memories.length === 0) {
      return NextResponse.json({ ok: true, reminder: null })
    }

    const chosen = memories[0]

    const when = timeAgo(chosen.created_at)

    const message = `You mentioned "${chosen.text}" ${when}. This might still matter. Do you want to update or expand on it?`

    return NextResponse.json({
      ok: true,
      reminder: {
        id: chosen.id,
        text: message,
      },
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Reminder error"

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    )
  }
}