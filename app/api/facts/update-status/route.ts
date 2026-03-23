import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { storeGovernanceNote } from "@/lib/memory/store";

export const runtime = "nodejs";

const ALLOWED_STATUS = new Set([
  "active",
  "superseded",
  "historical",
  "disputed",
]);

type UpdateBody = {
  factId?: string;
  nextStatus?: string;
  note?: string;
};

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData.user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const user = authData.user;
  const body = (await req.json().catch(() => ({}))) as UpdateBody;

  const factId = String(body.factId ?? "").trim();
  const nextStatus = String(body.nextStatus ?? "").trim().toLowerCase();
  const note = String(body.note ?? "").trim();

  if (!factId) {
    return NextResponse.json({ ok: false, error: "Missing factId" }, { status: 400 });
  }

  if (!ALLOWED_STATUS.has(nextStatus)) {
    return NextResponse.json({ ok: false, error: "Invalid nextStatus" }, { status: 400 });
  }

  const { data: fact, error: factError } = await supabase
    .from("memory_facts")
    .select("id,fact_key,canonical_text,status")
    .eq("id", factId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (factError) {
    return NextResponse.json({ ok: false, error: factError.message }, { status: 500 });
  }

  if (!fact) {
    return NextResponse.json({ ok: false, error: "Fact not found" }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from("memory_facts")
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", factId)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  if (note) {
    const governancePrefix =
      nextStatus === "disputed"
        ? "Fact disputed:"
        : nextStatus === "historical"
        ? "Fact marked historical:"
        : nextStatus === "active"
        ? "Fact restored active:"
        : "Fact status changed:";

    try {
      await storeGovernanceNote({
        userId: user.id,
        text: `${governancePrefix} ${fact.canonical_text} Note: ${note}`,
        sourceMessageId: null,
        importance: 0.8,
        certainty: 0.95,
      });
    } catch {
      // non-blocking
    }
  }

  return NextResponse.json({
    ok: true,
    fact: {
      id: fact.id,
      fact_key: fact.fact_key,
      canonical_text: fact.canonical_text,
      previous_status: fact.status,
      next_status: nextStatus,
    },
  });
}
