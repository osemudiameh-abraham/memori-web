import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type DecisionRow = {
  id: string;
};

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData.user) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  const user = authData.user;
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("decisions")
    .select("id")
    .eq("user_id", user.id)
    .or("archived.is.null,archived.eq.false")
    .not("review_due_at", "is", null)
    .lte("review_due_at", nowIso)
    .order("review_due_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  const decision = data as DecisionRow | null;

  return NextResponse.json({
    ok: true,
    decision_id: decision?.id ?? null,
  });
}