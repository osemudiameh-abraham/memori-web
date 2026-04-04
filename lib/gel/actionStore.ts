// lib/gel/actionStore.ts
// Phase 3 — GEL Action persistence

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DetectedIntent } from "@/lib/gel/intentParser";

export async function storePendingAction(
  userId: string,
  intent: DetectedIntent,
  description: string
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pending_actions")
    .insert({
      user_id: userId,
      kind: intent.type,
      payload: {
        params: intent.params,
        description,
        raw_text: intent.rawText,
        confidence: intent.confidence,
      },
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to store action");
  return String(data.id);
}

export async function approveAction(userId: string, actionId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("pending_actions")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", actionId)
    .eq("user_id", userId);
}

export async function rejectAction(userId: string, actionId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("pending_actions")
    .update({ status: "rejected", rejected_at: new Date().toISOString() })
    .eq("id", actionId)
    .eq("user_id", userId);
}

export async function fetchPendingActions(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("pending_actions")
    .select("id, kind, payload, status, created_at")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}
