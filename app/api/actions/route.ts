// app/api/actions/route.ts
// Phase 3 — GEL Actions API

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { approveAction, rejectAction, fetchPendingActions } from "@/lib/gel/actionStore";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    const actions = await fetchPendingActions(authData.user.id);
    return NextResponse.json({ ok: true, actions });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

    const body = await req.json() as { action: string; actionId: string };
    const { action, actionId } = body;

    if (!actionId) return NextResponse.json({ ok: false, error: "Missing actionId" }, { status: 400 });

    if (action === "approve") {
      await approveAction(authData.user.id, actionId);
      return NextResponse.json({ ok: true, status: "approved" });
    }

    if (action === "reject") {
      await rejectAction(authData.user.id, actionId);
      return NextResponse.json({ ok: true, status: "rejected" });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
