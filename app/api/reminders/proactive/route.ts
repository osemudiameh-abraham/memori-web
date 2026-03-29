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

function scoreMemory(m: any): number {
  let score = 0

  // Recency (more recent = higher)
  const ageMs = Date.now() - new Date(m.created_at).getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)

  score += Math.max(0, 5 - ageDays) // decay over ~5 days

  // Importance boost (if exists)
  if (m.importance) {
    score += m.importance * 2
  }

  // If tied to a decision → HIGH priority
  if (m.parent_decision_id) {
    score += 5
  }

  // Longer notes slightly more meaningful
  if (m.text && m.text.length > 40) {
    score += 1
  }

  return score
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

    // Pull recent memories (not just notes anymore)
    const since = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()

    const { data: memories } = await supabase
      .from("memories_structured")
      .select("id, text, created_at, importance, parent_decision_id")
      .eq("user_id", user.id)
      .in("memory_type", ["note", "decision", "outcome"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10)

    if (!memories || memories.length === 0) {
      return NextResponse.json({ ok: true, reminder: null })
    }

    // Score and pick best
    const ranked = memories
      .map(m => ({
        ...m,
        score: scoreMemory(m),
      }))
      .sort((a, b) => b.score - a.score)

    const chosen = ranked[0]

    const when = timeAgo(chosen.created_at)

    const message = `You mentioned "${chosen.text}" ${when}. This might still be important. Do you want to revisit it?`

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