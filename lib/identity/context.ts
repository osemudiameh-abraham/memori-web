import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { IdentityContext } from "@/lib/preprocessing/types";

type IdentityProfileRow = {
  user_id: string;
  display_name: string | null;
};

type CanonicalFactRow = {
  fact_key: string;
  value_text: string;
};

function cleanValue(value: string | null | undefined): string | null {
  const v = String(value ?? "").trim();
  return v ? v : null;
}

export async function loadIdentityContext(userId: string): Promise<IdentityContext | null> {
  const supabase = await createSupabaseServerClient();

  const [profileRes, factsRes] = await Promise.all([
    supabase
      .from("identity_profiles")
      .select("user_id, display_name")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("memory_facts")
      .select("fact_key, value_text")
      .eq("user_id", userId)
      .eq("status", "active")
      .in("fact_key", ["self_name", "self_company", "self_role", "self_city", "self_timezone"]),
  ]);

  const profile = !profileRes.error
    ? ((profileRes.data ?? null) as IdentityProfileRow | null)
    : null;

  const factRows = !factsRes.error
    ? ((factsRes.data ?? []) as CanonicalFactRow[])
    : [];

  const factMap: Record<string, string> = {};
  for (const row of factRows) {
    const key = cleanValue(row?.fact_key);
    const value = cleanValue(row?.value_text);
    if (key && value) {
      factMap[key] = value;
    }
  }

  const displayName = cleanValue(profile?.display_name);
  const selfName = cleanValue(factMap.self_name) ?? displayName ?? null;

  return {
    userId,
    displayName,
    selfName,
    company: cleanValue(factMap.self_company),
    role: cleanValue(factMap.self_role),
    city: cleanValue(factMap.self_city),
    timezone: cleanValue(factMap.self_timezone),
    canonicalFacts: {
      ...factMap,
      ...(selfName ? { self_name: selfName } : {}),
    },
  };
}
