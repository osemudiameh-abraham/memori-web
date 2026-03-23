import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type FactRow = {
  id: string;
  user_id: string;
  fact_key: string;
  subject: string;
  attribute: string;
  value_text: string;
  canonical_text: string;
  confidence: number;
  evidence_count: number;
  status: string;
  supersedes_fact_id: string | null;
  created_at: string;
  updated_at: string;
};

type EvidenceRow = {
  fact_id: string;
  memory_id: string;
  created_at: string;
};

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData.user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const user = authData.user;
  const url = new URL(req.url);

  const status = (url.searchParams.get("status") ?? "").trim().toLowerCase();
  const factKey = (url.searchParams.get("fact_key") ?? "").trim();
  const includeEvidence = (url.searchParams.get("include_evidence") ?? "1").trim() !== "0";

  let factQuery = supabase
    .from("memory_facts")
    .select(
      "id,user_id,fact_key,subject,attribute,value_text,canonical_text,confidence,evidence_count,status,supersedes_fact_id,created_at,updated_at"
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (status === "active" || status === "superseded" || status === "historical" || status === "disputed") {
    factQuery = factQuery.eq("status", status);
  }

  if (factKey) {
    factQuery = factQuery.eq("fact_key", factKey);
  }

  const { data: factsData, error: factsError } = await factQuery;
  if (factsError) {
    return NextResponse.json({ ok: false, error: factsError.message }, { status: 500 });
  }

  const facts = (factsData ?? []) as FactRow[];

  let evidenceByFactId: Record<string, EvidenceRow[]> = {};
  if (includeEvidence && facts.length > 0) {
    const factIds = facts.map((f) => f.id);

    const { data: evidenceData, error: evidenceError } = await supabase
      .from("memory_fact_evidence")
      .select("fact_id,memory_id,created_at")
      .in("fact_id", factIds)
      .order("created_at", { ascending: false });

    if (evidenceError) {
      return NextResponse.json({ ok: false, error: evidenceError.message }, { status: 500 });
    }

    for (const row of (evidenceData ?? []) as EvidenceRow[]) {
      if (!evidenceByFactId[row.fact_id]) evidenceByFactId[row.fact_id] = [];
      evidenceByFactId[row.fact_id].push(row);
    }
  }

  const identitySnapshot = {
    self_name:
      facts.find((f) => f.fact_key === "self_name" && f.status === "active")?.value_text ?? null,
    self_company:
      facts.find((f) => f.fact_key === "self_company" && f.status === "active")?.value_text ?? null,
    self_role:
      facts.find((f) => f.fact_key === "self_role" && f.status === "active")?.value_text ?? null,
    self_city:
      facts.find((f) => f.fact_key === "self_city" && f.status === "active")?.value_text ?? null,
    self_timezone:
      facts.find((f) => f.fact_key === "self_timezone" && f.status === "active")?.value_text ?? null,
  };

  return NextResponse.json({
    ok: true,
    facts: facts.map((fact) => ({
      ...fact,
      evidence: evidenceByFactId[fact.id] ?? [],
    })),
    identitySnapshot,
  });
}
