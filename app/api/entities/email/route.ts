// app/api/entities/email/route.ts
// Store or update email for a known entity

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

    const body = await req.json() as { entityName: string; email: string };
    const { entityName, email } = body;

    if (!entityName || !email) return NextResponse.json({ ok: false, error: "Missing entityName or email" }, { status: 400 });

    // Upsert entity with email
    const { data: existing } = await supabase
      .from("situation_entities")
      .select("id")
      .eq("user_id", authData.user.id)
      .ilike("entity_text", entityName)
      .maybeSingle();

    if (existing) {
      await supabase.from("situation_entities").update({ email }).eq("id", existing.id);
    } else {
      await supabase.from("situation_entities").insert({
        user_id: authData.user.id,
        entity_text: entityName,
        entity_type: "person",
        email,
        confidence: 1.0,
        occurrence_count: 1,
      });
    }

    return NextResponse.json({ ok: true, entityName, email });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
