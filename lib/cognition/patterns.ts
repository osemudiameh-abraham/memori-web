// lib/cognition/patterns.ts
// Pattern detection engine for Phase 2D
// Scans decisions + outcomes and produces human-readable pattern signals

import { createSupabaseServerClient } from "@/lib/supabase/server";

type OutcomeRow = {
  decision_id: string;
  outcome_label: string;
  created_at: string;
};

type DecisionRow = {
  id: string;
  text_snapshot: string;
  review_count: number;
  outcome_count: number;
  last_reviewed_at: string | null;
  created_at: string;
  pattern_signal: string | null;
};

type PatternResult = {
  decisionId: string;
  signal: string | null;
};

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24);
}

function detectDecisionPattern(
  decision: DecisionRow,
  outcomes: OutcomeRow[]
): string | null {
  const decisionOutcomes = outcomes.filter(o => o.decision_id === decision.id);
  const reviewCount = decision.review_count ?? 0;
  const outcomeCount = decisionOutcomes.length;

  // Pattern 1: Never reviewed despite being old
  if (reviewCount === 0 && outcomeCount === 0) {
    const agedays = daysBetween(decision.created_at, new Date().toISOString());
    if (agedays > 14) {
      return "This decision has not been reviewed in over 2 weeks. Consider closing the loop.";
    }
    return null;
  }

  // Pattern 2: Repeatedly reviewed — recurring decision
  if (reviewCount >= 5) {
    return `Reviewed ${reviewCount} times. This may be a recurring decision worth systematising.`;
  }

  if (reviewCount >= 3) {
    return `Reviewed ${reviewCount} times. This decision keeps coming up — worth a deeper look.`;
  }

  // Pattern 3: Consistent failure
  const failCount = decisionOutcomes.filter(o => o.outcome_label === "failed").length;
  const partialCount = decisionOutcomes.filter(o => o.outcome_label === "partial").length;
  const workCount = decisionOutcomes.filter(o => o.outcome_label === "worked").length;

  if (outcomeCount >= 2 && failCount === outcomeCount) {
    return "This decision has failed every time it has been reviewed. Consider a different approach.";
  }

  if (outcomeCount >= 3 && failCount + partialCount === outcomeCount) {
    return "This decision has not fully worked yet. Consider revisiting your approach.";
  }

  // Pattern 4: Consistent success
  if (outcomeCount >= 2 && workCount === outcomeCount) {
    return `Worked every time (${workCount}/${outcomeCount}). This is a reliable pattern for you.`;
  }

  // Pattern 5: Mixed outcomes
  if (outcomeCount >= 3 && workCount > 0 && failCount > 0) {
    return `Mixed results: ${workCount} worked, ${failCount} failed. Results are inconsistent — context may matter.`;
  }

  return null;
}

export async function runPatternScan(userId: string): Promise<{
  scanned: number;
  updated: number;
  signals: PatternResult[];
}> {
  const supabase = await createSupabaseServerClient();

  // Fetch all decisions for this user
  const { data: decisions, error: dErr } = await supabase
    .from("decisions")
    .select("id, text_snapshot, review_count, outcome_count, last_reviewed_at, created_at, pattern_signal")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (dErr || !decisions) {
    throw new Error(dErr?.message ?? "Failed to fetch decisions");
  }

  // Fetch all outcomes for this user
  const { data: outcomes, error: oErr } = await supabase
    .from("outcomes")
    .select("decision_id, outcome_label, created_at")
    .eq("user_id", userId);

  if (oErr) {
    throw new Error(oErr?.message ?? "Failed to fetch outcomes");
  }

  const outcomeRows: OutcomeRow[] = outcomes ?? [];
  const signals: PatternResult[] = [];
  let updated = 0;

  for (const decision of decisions) {
    const signal = detectDecisionPattern(decision as DecisionRow, outcomeRows);
    signals.push({ decisionId: decision.id, signal });

    // Only update if signal changed
    if (signal !== decision.pattern_signal) {
      await supabase
        .from("decisions")
        .update({ pattern_signal: signal })
        .eq("id", decision.id)
        .eq("user_id", userId);
      updated++;
    }
  }

  return {
    scanned: decisions.length,
    updated,
    signals,
  };
}
