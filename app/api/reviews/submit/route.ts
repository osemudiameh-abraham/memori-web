import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Body = {
  decisionId?: string;
  outcomeLabel?: "worked" | "failed" | "partial";
  note?: string;
};

type DecisionRow = {
  id: string;
  text_snapshot: string;
  outcome_count: number | null;
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

function nextReviewFromOutcome(label: "worked" | "failed" | "partial") {
  const days =
    label === "worked"
      ? 30
      : label === "failed"
      ? 7
      : 3;

  return new Date(Date.now() + days * 86400000).toISOString();
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData.user) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  const user = authData.user;
  const body = (await req.json().catch(() => ({}))) as Body;

  const decisionId = String(body.decisionId ?? "").trim();
  const outcomeLabel = body.outcomeLabel;
  const note = String(body.note ?? "").trim();

  if (!decisionId) {
    return NextResponse.json(
      { ok: false, error: "Missing decisionId" },
      { status: 400 }
    );
  }

  if (!outcomeLabel || !["worked", "failed", "partial"].includes(outcomeLabel)) {
    return NextResponse.json(
      { ok: false, error: "Invalid outcomeLabel" },
      { status: 400 }
    );
  }

  const nowIso = new Date().toISOString();
  const nextReviewIso = nextReviewFromOutcome(outcomeLabel);

  const { data: decision, error: decisionError } = await supabase
    .from("decisions")
    .select("id, text_snapshot, outcome_count")
    .eq("id", decisionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (decisionError) {
    return NextResponse.json(
      { ok: false, error: decisionError.message },
      { status: 500 }
    );
  }

  if (!decision) {
    return NextResponse.json(
      { ok: false, error: "Decision not found" },
      { status: 404 }
    );
  }

  const typedDecision = decision as DecisionRow;

  const idempotencyKey = randomUUID();

  const { data: outcomeRow, error: outcomeError } = await supabase
    .from("outcomes")
    .insert({
      user_id: user.id,
      decision_id: decisionId,
      memory_id: null,
      text_snapshot: outcomeText(outcomeLabel, note),
      outcome_label: outcomeLabel,
      idempotency_key: idempotencyKey,
      created_at: nowIso,
    })
    .select("id")
    .single();

  if (outcomeError) {
    return NextResponse.json(
      { ok: false, error: outcomeError.message },
      { status: 500 }
    );
  }

  const outcomeId = String((outcomeRow as { id?: string } | null)?.id ?? "");

  const nextOutcomeCount = Math.max(
    0,
    Number.isFinite(typedDecision.outcome_count as number)
      ? Number(typedDecision.outcome_count)
      : 0
  ) + 1;

  const { error: updateError } = await supabase
    .from("decisions")
    .update({
      outcome_count: nextOutcomeCount,
      reviewed_at: nowIso,
      last_outcome_at: nowIso,
      review_due_at: nextReviewIso,
    })
    .eq("id", decisionId)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json(
      { ok: false, error: updateError.message },
      { status: 500 }
    );
  }

  try {
    await supabase.from("decision_events").insert({
      user_id: user.id,
      decision_id: decisionId,
      event_type: "reviewed",
      event_data: {
        outcome_label: outcomeLabel,
        note,
        outcome_id: outcomeId || null,
        decision_text: typedDecision.text_snapshot,
      },
      created_at: nowIso,
    });
  } catch {
    // non-blocking
  }

  return NextResponse.json({
    ok: true,
    outcome_id: outcomeId || null,
    next_review_due_at: nextReviewIso,
  });
}