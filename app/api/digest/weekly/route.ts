// FILE: app/api/digest/weekly/route.ts

import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

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

    // 📅 Time window: last 7 days
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // ─────────────────────────────────────────
    // 1. FACTS (memories_structured - notes)
    // ─────────────────────────────────────────
    const { data: facts } = await supabase
      .from("memories_structured")
      .select("text, created_at")
      .eq("user_id", user.id)
      .eq("memory_type", "note")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20)

    // ─────────────────────────────────────────
    // 2. DECISIONS
    // ─────────────────────────────────────────
    const { data: decisions } = await supabase
      .from("decisions")
      .select("text_snapshot, created_at")
      .eq("user_id", user.id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10)

    // ─────────────────────────────────────────
    // 3. OUTCOMES
    // ─────────────────────────────────────────
    const { data: outcomes } = await supabase
      .from("outcomes")
      .select("text_snapshot, outcome_label, created_at")
      .eq("user_id", user.id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10)

    // ─────────────────────────────────────────
    // 4. SIMPLE INSIGHT
    // ─────────────────────────────────────────
    const insight = buildSimpleInsight({
      facts: facts ?? [],
      decisions: decisions ?? [],
      outcomes: outcomes ?? [],
    })

    return NextResponse.json({
      ok: true,
      summary: {
        facts: facts ?? [],
        decisions: decisions ?? [],
        outcomes: outcomes ?? [],
        insight,
      },
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Digest error"
    console.error("[digest] error:", message)

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    )
  }
}

// ─────────────────────────────────────────
// INSIGHT BUILDER (simple version for MVP)
// ─────────────────────────────────────────
function buildSimpleInsight(params: {
  facts: { text: string }[]
  decisions: { text_snapshot: string }[]
  outcomes: { outcome_label: string }[]
}) {
  const factCount = params.facts.length
  const decisionCount = params.decisions.length
  const outcomeCount = params.outcomes.length

  if (decisionCount === 0 && factCount === 0) {
    return "You haven’t added much this week yet. The more you share, the more Memori can help."
  }

  if (decisionCount > 0 && outcomeCount === 0) {
    return "You made decisions this week. Make sure to review how they play out."
  }

  if (outcomeCount > 0) {
    return "You are actively closing the loop on your decisions — this is how improvement compounds."
  }

  return "Memori is learning more about you each day."
}