import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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

  const { count, error } = await supabase
    .from("decisions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("archived", false)
    .not("review_due_at", "is", null)
    .lte("review_due_at", nowIso);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    due_count: Number(count ?? 0),
  });
}