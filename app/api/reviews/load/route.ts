import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData.user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const user = authData.user;
  const url = new URL(req.url);
  const focus = (url.searchParams.get("focus") ?? "").trim();
  const nowIso = new Date().toISOString();

  let query = supabase
    .from("memories_structured")
    .select("id,text,review_due_at,expected_outcome")
    .eq("user_id", user.id)
    .eq("memory_type", "decision")
    .is("archived_at", null);

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
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    decision: data
      ? {
          id: data.id,
          text: data.text,
          review_due_at: data.review_due_at,
          expected_outcome: data.expected_outcome,
        }
      : null,
  });
}
