import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  DueDecisionReview,
  MemorySnippet,
  RhetoricalMode,
} from "@/lib/preprocessing/types";

export function pickRelevantMemories(
  all: MemorySnippet[],
  userText: string,
  limit = 6
): MemorySnippet[] {
  const t = (userText || "").toLowerCase();

  const tokens = new Set(
    t.split(/[^a-z0-9]+/g).filter((x) => x.length >= 3).slice(0, 40)
  );

  const isNameQuestion =
    /\b(what('?s)?|who('?s)?)\b/.test(t) &&
    /\b(name|called|named)\b/.test(t) &&
    (/\bmy\b/.test(t) ||
      /\b(friend|sister|brother|partner|dog|cat|colleague|coworker)\b/.test(
        t
      ));

  const isIdentityQuestion =
    /\b(what('?s)?|who('?s)?)\b/.test(t) &&
    /\b(my|friend|sister|brother|partner|dog|cat|colleague|coworker)\b/.test(
      t
    );

  const scored = all.map((m) => {
    const mt = (m.text || "").toLowerCase();
    let overlap = 0;
    for (const tok of tokens) {
      if (mt.includes(tok)) overlap += 1;
    }

    const influence = Number.isFinite(m.influence as number)
      ? (m.influence as number)
      : 1.0;
    const importance = Number.isFinite(m.importance) ? m.importance : 0.5;
    const recalled = Number.isFinite(m.times_recalled) ? m.times_recalled : 0;

    const isNote = String(m.memory_type ?? "").toLowerCase() === "note";
    const isCanonicalFact = String(m.id).startsWith("fact:");

    let score =
      influence * 2.0 +
      overlap * 0.9 +
      importance * 0.4 +
      Math.min(0.4, recalled * 0.04);

    if (isNote) score += 0.35;
    if (isNote && isNameQuestion) score += 1.1;
    if (isNote && isIdentityQuestion) score += 0.6;
    if (isCanonicalFact) score += 1.5;

    return { m, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.m);
}

export function decideIfNeedsReview(
  memories: MemorySnippet[]
): DueDecisionReview {
  const now = Date.now();

  for (const m of memories) {
    if ((m.memory_type || "").toLowerCase() !== "decision") continue;
    if (!m.review_due_at) continue;

    const due = Date.parse(m.review_due_at);
    if (Number.isFinite(due) && due <= now) {
      return {
        shouldReview: true,
        memory_type: "decision",
        reason: "A prior decision is due for review (review_due_at passed).",
      };
    }
  }

  return { shouldReview: false };
}

export async function getLatestDecision(
  userId: string
): Promise<MemorySnippet | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("memories_structured")
    .select(
      "id,user_id,text,memory_type,importance,created_at,last_seen_at,times_recalled,certainty,related_goal,expected_outcome,review_due_at,parent_decision_id,archived_at,source_message_id"
    )
    .eq("user_id", userId)
    .eq("memory_type", "decision")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as MemorySnippet | null;
}

export async function getDueDecisionReview(
  userId: string
): Promise<MemorySnippet | null> {
  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("memories_structured")
    .select(
      "id,user_id,text,memory_type,importance,created_at,last_seen_at,times_recalled,certainty,related_goal,expected_outcome,review_due_at,parent_decision_id,archived_at,source_message_id"
    )
    .eq("user_id", userId)
    .eq("memory_type", "decision")
    .is("archived_at", null)
    .not("review_due_at", "is", null)
    .lte("review_due_at", nowIso)
    .order("review_due_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as MemorySnippet | null;
}

export async function getRecentAssistantModes(
  _userId: string,
  _limit = 8
): Promise<RhetoricalMode[]> {
  return [];
}