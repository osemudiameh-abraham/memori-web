import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type DigestFact = {
  text: string;
  created_at: string;
};

type DigestDecision = {
  text_snapshot: string;
  created_at: string;
};

type DigestOutcome = {
  text_snapshot: string;
  outcome_label: string;
  created_at: string;
};

type DigestSummary = {
  facts: DigestFact[];
  decisions: DigestDecision[];
  outcomes: DigestOutcome[];
  insight: string;
  counts: {
    facts: number;
    decisions: number;
    outcomes: number;
  };
  window: {
    since: string;
    until: string;
  };
};

function isGovernanceNote(text: string): boolean {
  const t = String(text ?? "").trim().toLowerCase();
  return t.startsWith("fact disputed:") || t.startsWith("fact review needed:");
}

function buildSimpleInsight(params: {
  facts: DigestFact[];
  decisions: DigestDecision[];
  outcomes: DigestOutcome[];
}) {
  const factCount = params.facts.length;
  const decisionCount = params.decisions.length;
  const outcomeCount = params.outcomes.length;

  if (decisionCount === 0 && factCount === 0 && outcomeCount === 0) {
    return "You haven’t added much this week yet. The more you share, the more Seven can help.";
  }

  if (decisionCount > 0 && outcomeCount === 0) {
    return "You made decisions this week. Make sure to review how they play out.";
  }

  if (outcomeCount > 0) {
    return "You are actively closing the loop on your decisions — this is how improvement compounds.";
  }

  if (factCount > 0) {
    return "Seven is learning more about you each day.";
  }

  return "Your week is beginning to take shape in Seven.";
}

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const now = new Date();
    const sinceDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const since = sinceDate.toISOString();
    const until = now.toISOString();

    const [factsResult, decisionsResult, outcomesResult] = await Promise.all([
      supabase
        .from("memories_structured")
        .select("text, created_at")
        .eq("user_id", user.id)
        .eq("memory_type", "note")
        .gte("created_at", since)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(20),

      supabase
        .from("decisions")
        .select("text_snapshot, created_at")
        .eq("user_id", user.id)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10),

      supabase
        .from("outcomes")
        .select("text_snapshot, outcome_label, created_at")
        .eq("user_id", user.id)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    if (factsResult.error) {
      return NextResponse.json(
        { ok: false, error: factsResult.error.message },
        { status: 500 }
      );
    }

    if (decisionsResult.error) {
      return NextResponse.json(
        { ok: false, error: decisionsResult.error.message },
        { status: 500 }
      );
    }

    if (outcomesResult.error) {
      return NextResponse.json(
        { ok: false, error: outcomesResult.error.message },
        { status: 500 }
      );
    }

    const facts = ((factsResult.data ?? []) as DigestFact[]).filter((row) => {
      const text = String(row.text ?? "").trim();
      if (!text) return false;
      if (isGovernanceNote(text)) return false;
      return true;
    });

    const decisions = (decisionsResult.data ?? []) as DigestDecision[];
    const outcomes = (outcomesResult.data ?? []) as DigestOutcome[];

    const summary: DigestSummary = {
      facts,
      decisions,
      outcomes,
      insight: buildSimpleInsight({ facts, decisions, outcomes }),
      counts: {
        facts: facts.length,
        decisions: decisions.length,
        outcomes: outcomes.length,
      },
      window: {
        since,
        until,
      },
    };

    return NextResponse.json({
      ok: true,
      summary,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Digest error";
    console.error("[digest] error:", message);

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}