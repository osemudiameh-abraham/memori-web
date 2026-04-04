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
  const insertData = {
    user_id: userId,
    kind: intent.type,
    payload: {
      params: intent.params,
      description,
      raw_text: intent.rawText,
      confidence: intent.confidence,
    },
    status: "pending",
  };

  const { data, error } = await supabase
    .from("pending_actions")
    .insert(insertData)
    .select("id, created_at")
    .maybeSingle();

  if (error) throw new Error(error.message);
  // Return id if available, otherwise use timestamp
  return String(data?.id ?? data?.created_at ?? Date.now());
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
