// lib/cognition/selfImprove.ts
// Weekly self-improvement loop
// Analyses what Memori got wrong and surfaces improvement signals

import { createSupabaseServerClient } from "@/lib/supabase/server";

type ImprovementSignal = {
  type: "recall_gap" | "decision_failure" | "pattern_ignored" | "entity_missed";
  description: string;
  severity: "low" | "medium" | "high";
  suggestion: string;
};

type SelfImprovementReport = {
  week: string;
  signals: ImprovementSignal[];
  summary: string;
  recall_accuracy_estimate: number;
  decisions_failed: number;
  decisions_total: number;
  top_missed_entity_types: string[];
};

function getWeekStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
}

function estimateRecallAccuracy(traceCount: number, avgMemoriesUsed: number): number {
  if (traceCount === 0) return 0;
  // Heuristic: if avg memories used >= 3, recall is likely good
  const base = Math.min(avgMemoriesUsed / 5, 1);
  return Math.round(base * 100);
}

export async function runSelfImprovementLoop(userId: string): Promise<SelfImprovementReport> {
  const supabase = await createSupabaseServerClient();
  const since = getWeekStart();
  const signals: ImprovementSignal[] = [];

  // 1. Check failed outcomes this week
  const { data: outcomes } = await supabase
    .from("outcomes")
    .select("outcome_label, text_snapshot, created_at")
    .eq("user_id", userId)
    .gte("created_at", since);

  const allOutcomes = outcomes ?? [];
  const failedOutcomes = allOutcomes.filter(o => o.outcome_label === "failed");
  const partialOutcomes = allOutcomes.filter(o => o.outcome_label === "partial");

  if (failedOutcomes.length >= 2) {
    signals.push({
      type: "decision_failure",
      description: `${failedOutcomes.length} decisions failed this week.`,
      severity: "high",
      suggestion: "Review these decisions together — there may be a common factor causing repeated failure.",
    });
  } else if (failedOutcomes.length === 1) {
    signals.push({
      type: "decision_failure",
      description: "One decision failed this week.",
      severity: "medium",
      suggestion: "Consider what context was missing when this decision was made.",
    });
  }

  if (partialOutcomes.length >= 3) {
    signals.push({
      type: "decision_failure",
      description: `${partialOutcomes.length} decisions only partially worked.`,
      severity: "medium",
      suggestion: "Partial outcomes often signal unclear expected outcomes at decision time. Try being more specific when logging decisions.",
    });
  }

  // 2. Check memory traces for recall quality
  const { data: traces } = await supabase
    .from("memory_traces")
    .select("picked_memory_ids, created_at")
    .eq("user_id", userId)
    .gte("created_at", since);

  const allTraces = traces ?? [];
  const traceCount = allTraces.length;
  const totalMemories = allTraces.reduce((sum, t) => sum + (t.picked_memory_ids?.length ?? 0), 0);
  const avgMemoriesUsed = traceCount > 0 ? totalMemories / traceCount : 0;

  if (traceCount > 0 && avgMemoriesUsed < 2) {
    signals.push({
      type: "recall_gap",
      description: `Average of ${avgMemoriesUsed.toFixed(1)} memories used per response this week — lower than expected.`,
      severity: "medium",
      suggestion: "Share more context in your messages. The more specific you are, the better Memori can recall relevant information.",
    });
  }

  // 3. Check for entities with no follow-up
  const { data: entities } = await supabase
    .from("situation_entities")
    .select("entity_type, entity_text, occurrence_count")
    .eq("user_id", userId)
    .eq("occurrence_count", 1);

  const singleMentionEntities = entities ?? [];
  if (singleMentionEntities.length >= 5) {
    const types = [...new Set(singleMentionEntities.map(e => e.entity_type))];
    signals.push({
      type: "entity_missed",
      description: `${singleMentionEntities.length} people or organisations mentioned only once — Memori may not know enough about them yet.`,
      severity: "low",
      suggestion: "Tell Memori more about the people and organisations that matter to your work. The more context it has, the better.",
    });
  }

  // 4. Check for overdue decisions
  const now = new Date().toISOString();
  const { data: overdueDecisions } = await supabase
    .from("decisions")
    .select("id, text_snapshot, review_due_at")
    .eq("user_id", userId)
    .lt("review_due_at", now)
    .or("archived.is.null,archived.eq.false")
    .limit(20);

  const overdue = overdueDecisions ?? [];
  if (overdue.length >= 3) {
    signals.push({
      type: "pattern_ignored",
      description: `${overdue.length} decisions are overdue for review.`,
      severity: "high",
      suggestion: "Closing the loop on decisions is core to Memori's value. Visit the Reviews page to work through them.",
    });
  }

  // Build summary
  const recallAccuracy = estimateRecallAccuracy(traceCount, avgMemoriesUsed);
  const highSignals = signals.filter(s => s.severity === "high").length;
  const missedTypes = [...new Set(singleMentionEntities.map(e => e.entity_type))];

  let summary = "";
  if (signals.length === 0) {
    summary = "A strong week. Your decisions are on track, recall is working well, and your memory graph is growing.";
  } else if (highSignals >= 2) {
    summary = `${highSignals} high-priority signals this week. Focus on closing overdue reviews and learning from failed decisions.`;
  } else if (highSignals === 1) {
    summary = `One high-priority signal needs your attention. ${signals.find(s => s.severity === "high")?.description ?? ""}`;
  } else {
    summary = `A decent week with ${signals.length} improvement signal${signals.length !== 1 ? "s" : ""} to note.`;
  }

  return {
    week: since,
    signals,
    summary,
    recall_accuracy_estimate: recallAccuracy,
    decisions_failed: failedOutcomes.length,
    decisions_total: allOutcomes.length,
    top_missed_entity_types: missedTypes.slice(0, 3),
  };
}
