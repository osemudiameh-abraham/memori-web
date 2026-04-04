// app/api/patterns/route.ts
// Phase 2D — Pattern scan endpoint
// Called by Vercel cron daily, or manually triggered

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runPatternScan } from "@/lib/cognition/patterns";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // Allow cron secret OR authenticated user
    const cronSecret = req.headers.get("x-cron-secret");
    const isAuthorizedCron = cronSecret && cronSecret === process.env.CRON_SECRET;

    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!isAuthorizedCron && !user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    // If cron — scan all active users
    if (isAuthorizedCron) {
      const { data: users } = await supabase
        .from("decisions")
        .select("user_id")
        .limit(500);

      const uniqueIds = [...new Set((users ?? []).map(r => r.user_id))];
      const results = [];

      for (const uid of uniqueIds) {
        const result = await runPatternScan(uid);
        results.push({ userId: uid, ...result });
      }

      return NextResponse.json({ ok: true, results });
    }

    // If user — scan their own decisions only
    const result = await runPatternScan(user!.id);
    return NextResponse.json({ ok: true, ...result });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Pattern scan error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
