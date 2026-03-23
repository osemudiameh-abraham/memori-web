import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { storeFactMemory, upsertCanonicalFact } from "@/lib/memory/store";
import type { CanonicalFactCandidate } from "@/lib/preprocessing/types";

export const runtime = "nodejs";

type OnboardingBody = {
  name?: string;
  city?: string;
  timezone?: string;
  company?: string;
  role?: string;
  relationshipLabel?: string;
  relationshipName?: string;
  petType?: string;
  petName?: string;
  currentGoal?: string;
  importantPreference?: string;
};

function clean(value: unknown, maxLen = 120): string | null {
  const v = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!v) return null;
  if (v.length > maxLen) return null;
  return v;
}

function normalizeRelation(rel: string): string {
  const r = rel.trim().toLowerCase();

  const irregular: Record<string, string> = {
    dogs: "dog",
    cats: "cat",
    friends: "friend",
    sisters: "sister",
    brothers: "brother",
    colleagues: "colleague",
    coworkers: "coworker",
    partners: "partner",
  };

  if (irregular[r]) return irregular[r];
  if (r.endsWith("s") && r.length > 3) return r.slice(0, -1);
  return r;
}

function relationPossessive(rel: string): string {
  const r = normalizeRelation(rel);
  if (r.endsWith("s")) return `${r}'`;
  return `${r}'s`;
}

function makeSelfFact(
  factKey: string,
  attribute: string,
  valueText: string,
  canonicalText: string
): CanonicalFactCandidate {
  return {
    fact_key: factKey,
    subject: "self",
    attribute,
    value_text: valueText,
    canonical_text: canonicalText,
    confidence: 0.95,
  };
}

function makeRelationNameFact(rel: string, name: string): CanonicalFactCandidate {
  const relation = normalizeRelation(rel);
  return {
    fact_key: `${relation}_name`,
    subject: relation,
    attribute: "name",
    value_text: name,
    canonical_text: `My ${relationPossessive(relation)} name is ${name}.`,
    confidence: 0.95,
  };
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData.user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const user = authData.user;
  const body = (await req.json().catch(() => ({}))) as OnboardingBody;

  const name = clean(body.name, 80);
  const city = clean(body.city, 80);
  const timezone = clean(body.timezone, 80);
  const company = clean(body.company, 100);
  const role = clean(body.role, 100);
  const relationshipLabel = clean(body.relationshipLabel, 40);
  const relationshipName = clean(body.relationshipName, 80);
  const petType = clean(body.petType, 40);
  const petName = clean(body.petName, 80);
  const currentGoal = clean(body.currentGoal, 160);
  const importantPreference = clean(body.importantPreference, 160);

  const candidates: CanonicalFactCandidate[] = [];
  const rawFacts: string[] = [];

  if (name) {
    candidates.push({
      fact_key: "self_name",
      subject: "self",
      attribute: "name",
      value_text: name,
      canonical_text: `My name is ${name}.`,
      confidence: 0.95,
    });
    rawFacts.push(`my name: ${name}`);
    rawFacts.push(`My name is ${name}.`);
  }

  if (city) {
    candidates.push(makeSelfFact("self_city", "city", city, `I live in ${city}.`));
    rawFacts.push(`self city: ${city}`);
    rawFacts.push(`I live in ${city}.`);
  }

  if (timezone) {
    candidates.push(
      makeSelfFact("self_timezone", "timezone", timezone, `My timezone is ${timezone}.`)
    );
    rawFacts.push(`self timezone: ${timezone}`);
    rawFacts.push(`My timezone is ${timezone}.`);
  }

  if (company) {
    candidates.push(makeSelfFact("self_company", "company", company, `I work at ${company}.`));
    rawFacts.push(`self company: ${company}`);
    rawFacts.push(`I work at ${company}.`);
  }

  if (role) {
    candidates.push(makeSelfFact("self_role", "role", role, `I work as ${role}.`));
    rawFacts.push(`self role: ${role}`);
    rawFacts.push(`I work as ${role}.`);
  }

  if (relationshipLabel && relationshipName) {
    const relFact = makeRelationNameFact(relationshipLabel, relationshipName);
    candidates.push(relFact);
    rawFacts.push(`${normalizeRelation(relationshipLabel)} name: ${relationshipName}`);
    rawFacts.push(relFact.canonical_text);
  }

  if (petType && petName) {
    const petFact = makeRelationNameFact(petType, petName);
    candidates.push(petFact);
    rawFacts.push(`${normalizeRelation(petType)} name: ${petName}`);
    rawFacts.push(petFact.canonical_text);
  }

  if (currentGoal) {
    rawFacts.push(`Current goal: ${currentGoal}`);
  }

  if (importantPreference) {
    rawFacts.push(`Important preference: ${importantPreference}`);
  }

  const storedFactIds: string[] = [];
  const canonicalFactIds: string[] = [];

  for (const factText of rawFacts) {
    const memoryId = await storeFactMemory({
      userId: user.id,
      factText,
      sourceMessageId: null,
      importance: 0.8,
      certainty: 0.95,
    });

    storedFactIds.push(memoryId);
  }

  const evidenceMemoryId = storedFactIds[0] ?? null;

  if (evidenceMemoryId) {
    for (const candidate of candidates) {
      const canonicalId = await upsertCanonicalFact({
        userId: user.id,
        candidate,
        evidenceMemoryId,
      });

      canonicalFactIds.push(canonicalId);
    }
  }

  return NextResponse.json({
    ok: true,
    stored_raw_fact_count: storedFactIds.length,
    canonical_fact_count: canonicalFactIds.length,
  });
}
