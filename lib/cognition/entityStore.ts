// lib/cognition/entityStore.ts
// Phase 2D — Entity persistence layer
// Saves extracted entities to situation_entities table

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ExtractedEntity } from "@/lib/cognition/situations";

export async function upsertEntities(
  userId: string,
  entities: ExtractedEntity[]
): Promise<void> {
  if (!entities.length) return;

  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  for (const entity of entities) {
    // Skip low-confidence or very short entities
    if (entity.confidence < 0.60 || entity.text.length < 2) continue;

    // Try to update existing entity (increment occurrence count)
    const { data: existing } = await supabase
      .from("situation_entities")
      .select("id, occurrence_count")
      .eq("user_id", userId)
      .ilike("entity_text", entity.text)
      .eq("entity_type", entity.type)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("situation_entities")
        .update({
          occurrence_count: (existing.occurrence_count ?? 1) + 1,
          last_seen_at: now,
          context: entity.context ?? null,
        })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("situation_entities")
        .insert({
          user_id: userId,
          entity_text: entity.text,
          entity_type: entity.type,
          confidence: entity.confidence,
          context: entity.context ?? null,
          occurrence_count: 1,
          first_seen_at: now,
          last_seen_at: now,
        });
    }
  }
}

export async function fetchTopEntities(
  userId: string,
  limit = 20
): Promise<{ text: string; type: string; occurrence_count: number }[]> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("situation_entities")
    .select("entity_text, entity_type, occurrence_count")
    .eq("user_id", userId)
    .order("occurrence_count", { ascending: false })
    .limit(limit);

  return (data ?? []).map(r => ({
    text: r.entity_text,
    type: r.entity_type,
    occurrence_count: r.occurrence_count,
  }));
}

export async function fetchEntitiesByType(
  userId: string,
  type: "person" | "company" | "place" | "project"
): Promise<{ text: string; occurrence_count: number; last_seen_at: string }[]> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("situation_entities")
    .select("entity_text, occurrence_count, last_seen_at")
    .eq("user_id", userId)
    .eq("entity_type", type)
    .order("occurrence_count", { ascending: false })
    .limit(50);

  return (data ?? []).map(r => ({
    text: r.entity_text,
    occurrence_count: r.occurrence_count,
    last_seen_at: r.last_seen_at,
  }));
}
