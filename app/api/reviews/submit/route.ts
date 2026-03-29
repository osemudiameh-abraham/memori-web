import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Body = {
  decisionId?: string;
  outcomeLabel?: "worked" | "failed" | "partial";
  note?: string;
};

function outcomeText(label: "worked" | "failed" | "partial", note: string) {
  const base =
    label === "worked"
      ? "Outcome: Worked as expected."
      : label === "failed"
      ? "Outcome: Failed."
      : "Outcome: Partial.";

  const cleanNote = String(note ?? "").trim();
  return cleanNote ? `${base} ${cleanNote}` : base;
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData.user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const user = authData.user;
  const body = (await req.json().catch(() => ({}))) as Body;

  const decisionId = String(body.decisionId ?? "").trim();
  const outcomeLabel = body.outcomeLabel;
  const note = String(body.note ?? "").trim();

  if (!decisionId) {
    return NextResponse.json({ ok: false, error: "Missing decisionId" }, { status: 400 });
  }

  if (!outcomeLabel || !["worked", "failed", "partial"].includes(outcomeLabel)) {
    return NextResponse.json({ ok: false, error: "Invalid outcomeLabel" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const nextReviewIso = new Date(Date.now() + 7 * 86400000).toISOString();

  const { data: decision, error: decisionError } = await supabase
    .from("memories_structured")
    .select("id,text")
    .eq("id", decisionId)
    .eq("user_id", user.id)
    .eq("memory_type", "decision")
    .maybeSingle();

  if (decisionError) {
    return NextResponse.json({ ok: false, error: decisionError.message }, { status: 500 });
  }

  if (!decision) {
    return NextResponse.json({ ok: false, error: "Decision not found" }, { status: 404 });
  }

  const { data: outcomeRow, error: outcomeError } = await supabase
    .from("memories_structured")
    .insert({
      user_id: user.id,
      source_message_id: null,
      text: outcomeText(outcomeLabel, note),
      memory_type: "outcome",
      importance: 0.75,
      certainty: 0.9,
      parent_decision_id: decisionId,
      last_seen_at: nowIso,
      times_recalled: 0,
      archived_at: null,
      archived: null,
    })
    .select("id")
    .single();

  if (outcomeError) {
    return NextResponse.json({ ok: false, error: outcomeError.message }, { status: 500 });
  }

  const outcomeId = String((outcomeRow as any)?.id ?? "");

  const { error: updateError } = await supabase
    .from("memories_structured")
    .update({
      review_due_at: nextReviewIso,
      last_seen_at: nowIso,
    })
    .eq("id", decisionId)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  await supabase.from("decision_events").insert({
    user_id: user.id,
    decision_id: decisionId,
    event_type: "reviewed",
    event_data: {
      outcome_label: outcomeLabel,
      note,
      outcome_id: outcomeId,
    },
    created_at: nowIso,
  });

  return NextResponse.json({
    ok: true,
    outcome_id: outcomeId || null,
  });
}
