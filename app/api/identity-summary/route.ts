import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchCanonicalFactsForUser } from "@/lib/memory/store";
import { loadIdentityContext } from "@/lib/identity/context";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData.user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const user = authData.user;

  const [identity, facts] = await Promise.all([
    loadIdentityContext(user.id),
    fetchCanonicalFactsForUser(user.id),
  ]);

  const factMap = new Map(facts.map((f) => [f.fact_key, f]));

  const name =
    factMap.get("self_name")?.value_text ??
    identity?.selfName ??
    identity?.displayName ??
    null;

  const company = factMap.get("self_company")?.value_text ?? identity?.company ?? null;
  const role = factMap.get("self_role")?.value_text ?? identity?.role ?? null;
  const city = factMap.get("self_city")?.value_text ?? identity?.city ?? null;
  const timezone = factMap.get("self_timezone")?.value_text ?? identity?.timezone ?? null;

  const jamesRelation = factMap.get("person_james_relation")?.value_text ?? null;
  const jamesRole = factMap.get("person_james_role")?.value_text ?? null;
  const dogName = factMap.get("dog_name")?.value_text ?? null;

  const lines: string[] = [];

  if (name) lines.push(`You’re ${name}.`);
  if (city && timezone) lines.push(`You live in ${city} and your timezone is ${timezone}.`);
  else if (city) lines.push(`You live in ${city}.`);
  else if (timezone) lines.push(`Your timezone is ${timezone}.`);

  if (company && role) lines.push(`You work at ${company} as ${role}.`);
  else if (company) lines.push(`You work at ${company}.`);
  else if (role) lines.push(`You work as ${role}.`);

  if (jamesRelation && jamesRole) {
    lines.push(`Your colleague James runs ${jamesRole}.`);
  }

  if (dogName) {
    lines.push(`Your dog’s name is ${dogName}.`);
  }

  const summary =
    lines.join(" ") || "Memori does not know enough about you yet. Add more facts to build your identity summary.";

  return NextResponse.json({
    ok: true,
    summary,
    snapshot: {
      self_name: name,
      self_company: company,
      self_role: role,
      self_city: city,
      self_timezone: timezone,
      dog_name: dogName,
      james_relation: jamesRelation,
      james_role: jamesRole,
    },
  });
}
