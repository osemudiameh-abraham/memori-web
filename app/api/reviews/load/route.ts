import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type DecisionRow = {
  id: string;
  text_snapshot: string;
  review_due_at: string | null;
  expected_outcome: string | null;
  reviewed_at: string | null;
  outcome_count: number | null;
};

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData.user) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  const user = authData.user;
  const url = new URL(req.url);
  const focus = (url.searchParams.get("focus") ?? "").trim();
  const nowIso = new Date().toISOString();

  let query = supabase
    .from("decisions")
    .select("id,text_snapshot,review_due_at,expected_outcome,reviewed_at,outcome_count")
    .eq("user_id", user.id)
    .eq("archived", false);

  if (focus) {
    query = query.eq("id", focus).limit(1);
  } else {
    query = query
      .not("review_due_at", "is", null)
      .lte("review_due_at", nowIso)
      .order("review_due_at", { ascending: true })
      .limit(1);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  const decision = data as DecisionRow | null;

  return NextResponse.json({
    ok: true,
    decision: decision
      ? {
          id: decision.id,
          text: decision.text_snapshot,
          review_due_at: decision.review_due_at,
          expected_outcome: decision.expected_outcome,
          reviewed_at: decision.reviewed_at,
          outcome_count: decision.outcome_count ?? 0,
        }
      : null,
  });
}