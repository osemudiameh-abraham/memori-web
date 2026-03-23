import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();

  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData.user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const user = authData.user;
  const params = await context.params;
  const traceId = String(params.id ?? "").trim();

  if (!traceId) {
    return NextResponse.json({ ok: false, error: "Missing trace id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("memory_traces")
    .select("id,created_at,query_text,assistant_text,picked_memory_ids,strategy_history")
    .eq("id", traceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ ok: false, error: "Trace not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    trace: data,
  });
}
