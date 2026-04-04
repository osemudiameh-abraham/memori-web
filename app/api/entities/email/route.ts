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

    const body = await req.json() as { entityName: string; email?: string; phone?: string };
    const { entityName, email, phone } = body;

    if (!entityName || (!email && !phone)) {
      return NextResponse.json({ ok: false, error: "Missing entityName and email or phone" }, { status: 400 });
    }

    // Find existing entity row for this person
    const { data: rows } = await supabase
      .from("situation_entities")
      .select("id, entity_type")
      .eq("user_id", authData.user.id)
      .ilike("entity_text", entityName);

    const existing = rows?.find(r => r.entity_type === "person") ?? rows?.[0] ?? null;

    const updates: Record<string, string> = {};
    if (email) updates.email = email;
    if (phone) updates.phone = phone;

    if (existing) {
      await supabase.from("situation_entities").update(updates).eq("id", existing.id);
    } else {
      await supabase.from("situation_entities").insert({
        user_id: authData.user.id,
        entity_text: entityName,
        entity_type: "person",
        ...updates,
        confidence: 1.0,
        occurrence_count: 1,
      });
    }

    return NextResponse.json({ ok: true, entityName, ...updates });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
