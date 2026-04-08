import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CanonicalFact,
  CanonicalFactCandidate,
  MemoryCandidate,
  MemorySnippet,
} from "@/lib/preprocessing/types";

export async function fetchSevenesForUser(userId: string): Promise<MemorySnippet[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("memories_structured")
    .select(
      "id,user_id,text,memory_type,importance,created_at,last_seen_at,times_recalled,certainty,related_goal,expected_outcome,review_due_at,parent_decision_id,archived_at,source_message_id"
    )
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("importance", { ascending: false })
    .limit(200);

  if (error) throw error;
  return (data ?? []) as MemorySnippet[];
}

export async function fetchCanonicalFactsForUser(userId: string): Promise<CanonicalFact[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("memory_facts")
    .select(
      "id,user_id,fact_key,subject,attribute,value_text,canonical_text,confidence,evidence_count,status,supersedes_fact_id,created_at,updated_at"
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data ?? []) as CanonicalFact[];
}

export function canonicalFactsToMemorySnippets(facts: CanonicalFact[]): MemorySnippet[] {
  return facts.map((f) => ({
    id: `fact:${f.id}`,
    user_id: f.user_id,
    text: f.canonical_text,
    memory_type: "note",
    importance: 0.95,
    created_at: f.created_at,
    last_seen_at: f.updated_at,
    times_recalled: 0,
    certainty: f.confidence,
    archived_at: null,
    influence: 1.25,
  }));
}

export async function bumpSevenesRecalled(ids: string[]): Promise<void> {
  if (!ids.length) return;

  const realIds = ids.filter((id) => !String(id).startsWith("fact:"));
  if (!realIds.length) return;

  const supabase = await createSupabaseServerClient();

  try {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("memories_structured")
      .select("id,times_recalled")
      .in("id", realIds);

    if (error) return;

    const current = new Map<string, number>();
    for (const row of data ?? []) {
      const tr = Number((row as any)?.times_recalled ?? 0);
      current.set(String((row as any)?.id), Number.isFinite(tr) ? tr : 0);
    }

    for (const id of realIds) {
      const nextCount = (current.get(id) ?? 0) + 1;
      await supabase
        .from("memories_structured")
        .update({ times_recalled: nextCount, last_seen_at: now })
        .eq("id", id);
    }
  } catch {
    // non-blocking
  }
}

export async function storeStructuredMemory(args: {
  userId: string;
  sourceMessageId?: string | null;
  memory: MemoryCandidate;
}): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const mem = args.memory;

  const imp = Math.max(0, Math.min(1, Number.isFinite(mem.importance) ? mem.importance : 0.5));
  const cert = Math.max(0, Math.min(1, Number.isFinite(mem.certainty) ? mem.certainty : 0.5));

  const { error } = await supabase.from("memories_structured").insert({
    user_id: args.userId,
    source_message_id: args.sourceMessageId ?? null,
    text: mem.text,
    memory_type: mem.memory_type,
    importance: imp,
    certainty: cert,
    related_goal: mem.related_goal ?? null,
    expected_outcome: mem.expected_outcome ?? null,
    review_due_at: mem.review_due_at ?? null,
    archived_at: null,
  });

  if (error) throw error;
}

export async function findRecentFactMemory(args: {
  userId: string;
  factText: string;
  lookbackDays?: number;
}): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const lookbackDays = Number.isFinite(args.lookbackDays) ? Number(args.lookbackDays) : 30;

  const since = new Date(Date.now() - lookbackDays * 86400000).toISOString();

  const { data, error } = await supabase
    .from("memories_structured")
    .select("id")
    .eq("user_id", args.userId)
    .eq("memory_type", "note")
    .eq("text", args.factText.trim())
    .gte("created_at", since)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`findRecentFactMemory failed: ${error.message}`);
  return data ? String((data as any).id) : null;
}

export async function storeFactMemory(args: {
  userId: string;
  factText: string;
  sourceMessageId: string | null;
  importance?: number;
  certainty?: number;
}): Promise<string> {
  const supabase = await createSupabaseServerClient();

  const fact = String(args.factText ?? "").trim();
  if (!fact) throw new Error("storeFactMemory: missing factText");

  const existingId = await findRecentFactMemory({
    userId: args.userId,
    factText: fact,
    lookbackDays: 30,
  });

  if (existingId) {
    return existingId;
  }

  const imp = Math.max(0, Math.min(1, Number.isFinite(args.importance) ? (args.importance as number) : 0.75));
  const cert = Math.max(0, Math.min(1, Number.isFinite(args.certainty) ? (args.certainty as number) : 0.95));
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("memories_structured")
    .insert({
      user_id: args.userId,
      source_message_id: args.sourceMessageId ?? null,
      text: fact,
      memory_type: "note",
      importance: imp,
      certainty: cert,
      last_seen_at: nowIso,
      times_recalled: 0,
      archived_at: null,
    })
    .select("id")
    .single();

  if (error) throw new Error(`storeFactMemory insert failed: ${error.message}`);
  return String((data as any)?.id ?? "");
}

export async function storeGovernanceNote(args: {
  userId: string;
  text: string;
  sourceMessageId?: string | null;
  importance?: number;
  certainty?: number;
}): Promise<string> {
  const supabase = await createSupabaseServerClient();

  const noteText = String(args.text ?? "").trim();
  if (!noteText) throw new Error("storeGovernanceNote: missing text");

  const imp = Math.max(0, Math.min(1, Number.isFinite(args.importance) ? (args.importance as number) : 0.8));
  const cert = Math.max(0, Math.min(1, Number.isFinite(args.certainty) ? (args.certainty as number) : 0.95));
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("memories_structured")
    .insert({
      user_id: args.userId,
      source_message_id: args.sourceMessageId ?? null,
      text: noteText,
      memory_type: "note",
      importance: imp,
      certainty: cert,
      last_seen_at: nowIso,
      times_recalled: 0,
      archived_at: null,
    })
    .select("id")
    .single();

  if (error) throw new Error(`storeGovernanceNote insert failed: ${error.message}`);
  return String((data as any)?.id ?? "");
}

export async function upsertCanonicalFact(args: {
  userId: string;
  candidate: CanonicalFactCandidate;
  evidenceMemoryId: string;
}): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const c = args.candidate;

  const { data: existingRows, error: existingError } = await supabase
    .from("memory_facts")
    .select(
      "id,user_id,fact_key,subject,attribute,value_text,canonical_text,confidence,evidence_count,status,supersedes_fact_id,created_at,updated_at"
    )
    .eq("user_id", args.userId)
    .eq("fact_key", c.fact_key)
    .eq("status", "active")
    .limit(1);

  if (existingError) throw new Error(`upsertCanonicalFact lookup failed: ${existingError.message}`);

  const existing = (existingRows?.[0] ?? null) as CanonicalFact | null;

  let factId: string;

  if (!existing) {
    const { data, error } = await supabase
      .from("memory_facts")
      .insert({
        user_id: args.userId,
        fact_key: c.fact_key,
        subject: c.subject,
        attribute: c.attribute,
        value_text: c.value_text,
        canonical_text: c.canonical_text,
        confidence: c.confidence,
        evidence_count: 1,
        status: "active",
      })
      .select("id")
      .single();

    if (error) throw new Error(`upsertCanonicalFact insert failed: ${error.message}`);
    factId = String((data as any)?.id ?? "");
  } else if (existing.value_text === c.value_text) {
    const nextConfidence = Math.max(existing.confidence, c.confidence);
    const { error } = await supabase
      .from("memory_facts")
      .update({
        canonical_text: c.canonical_text,
        confidence: nextConfidence,
        evidence_count: Number(existing.evidence_count ?? 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) throw new Error(`upsertCanonicalFact update failed: ${error.message}`);
    factId = existing.id;
  } else {
    const { error: supersedeError } = await supabase
      .from("memory_facts")
      .update({
        status: "superseded",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (supersedeError) {
      throw new Error(`upsertCanonicalFact supersede failed: ${supersedeError.message}`);
    }

    const { data, error } = await supabase
      .from("memory_facts")
      .insert({
        user_id: args.userId,
        fact_key: c.fact_key,
        subject: c.subject,
        attribute: c.attribute,
        value_text: c.value_text,
        canonical_text: c.canonical_text,
        confidence: c.confidence,
        evidence_count: 1,
        status: "active",
        supersedes_fact_id: existing.id,
      })
      .select("id")
      .single();

    if (error) throw new Error(`upsertCanonicalFact replacement insert failed: ${error.message}`);
    factId = String((data as any)?.id ?? "");
  }

  const { error: evidenceError } = await supabase
    .from("memory_fact_evidence")
    .upsert(
      {
        user_id: args.userId,
        fact_id: factId,
        memory_id: args.evidenceMemoryId,
      },
      { onConflict: "fact_id,memory_id" }
    );

  if (evidenceError) {
    throw new Error(`upsertCanonicalFact evidence link failed: ${evidenceError.message}`);
  }

  return factId;
}

export async function archiveMemory(args: { userId: string; memoryId: string }): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("memories_structured")
    .update({
      archived: true,
      archived_at: new Date().toISOString(),
    })
    .eq("id", args.memoryId)
    .eq("user_id", args.userId);

  if (error) throw new Error(`Archive failed: ${error.message}`);
  return true;
}
