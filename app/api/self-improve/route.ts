// app/api/self-improve/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runSelfImprovementLoop } from "@/lib/cognition/selfImprove";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const cronSecret = req.headers.get("x-cron-secret");
    const isAuthorizedCron = cronSecret && cronSecret === process.env.CRON_SECRET;

    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!isAuthorizedCron && !user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    if (isAuthorizedCron) {
      // Run for all users
      const { data: users } = await supabase
        .from("decisions")
        .select("user_id")
        .limit(500);

      const uniqueIds = [...new Set((users ?? []).map(r => r.user_id))];
      const results = [];
      for (const uid of uniqueIds) {
        const report = await runSelfImprovementLoop(uid);
        results.push({ userId: uid, ...report });
      }
      return NextResponse.json({ ok: true, results });
    }

    const report = await runSelfImprovementLoop(user!.id);
    return NextResponse.json({ ok: true, report });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Self-improvement error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
