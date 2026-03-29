import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ReminderMemoryRow = {
  id: string;
  text: string;
  created_at: string;
  memory_type?: string | null;
};

function isGovernanceNote(text: string): boolean {
  const t = String(text ?? "").trim().toLowerCase();
  return t.startsWith("fact disputed:") || t.startsWith("fact review needed:");
}

function isLowSignalNote(text: string): boolean {
  const t = String(text ?? "").trim().toLowerCase();
  if (!t) return true;

  const lowSignal = new Set([
    "ok",
    "okay",
    "thanks",
    "thank you",
    "cool",
    "great",
    "nice",
    "yes",
    "no",
    "sure",
    "got it",
  ]);

  return lowSignal.has(t);
}

function buildReminderMessage(text: string): string {
  const trimmed = String(text ?? "").trim();
  return `You mentioned: "${trimmed}". Do you want to update or expand on this?`;
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

    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("memories_structured")
      .select("id, text, created_at, memory_type")
      .eq("user_id", user.id)
      .eq("memory_type", "note")
      .gte("created_at", since)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const memories = ((data ?? []) as ReminderMemoryRow[]).filter((row) => {
      const text = String(row.text ?? "").trim();
      if (!text) return false;
      if (isGovernanceNote(text)) return false;
      if (isLowSignalNote(text)) return false;
      return true;
    });

    if (memories.length === 0) {
      return NextResponse.json({ ok: true, reminder: null });
    }

    const chosen = memories[0];

    return NextResponse.json({
      ok: true,
      reminder: {
        id: chosen.id,
        source_text: chosen.text,
        created_at: chosen.created_at,
        text: buildReminderMessage(chosen.text),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Reminder error";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}