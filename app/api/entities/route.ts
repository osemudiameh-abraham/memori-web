// app/api/entities/route.ts
// Phase 2D — Entity graph API

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchTopEntities, fetchEntitiesByType } from "@/lib/cognition/entityStore";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const url = new URL(req.url);
    const type = url.searchParams.get("type") as "person" | "company" | "place" | "project" | null;

    if (type && ["person", "company", "place", "project"].includes(type)) {
      const entities = await fetchEntitiesByType(authData.user.id, type);
      return NextResponse.json({ ok: true, type, entities });
    }

    const entities = await fetchTopEntities(authData.user.id);
    return NextResponse.json({ ok: true, entities });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Entity fetch error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
