import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { buildLLMPayload } from "@/lib/preprocessing/buildPayload";
import { getContextSignals } from "@/lib/preprocessing/contextSignals";
import { loadIdentityContext } from "@/lib/identity/context";

import {
  fetchMemoriesForUser,
  bumpMemoriesRecalled,
  archiveMemory,
  storeFactMemory,
  upsertCanonicalFact,
  fetchCanonicalFactsForUser,
  canonicalFactsToMemorySnippets,
} from "@/lib/memory/store";

import { pickRelevantMemories } from "@/lib/memory/search";

import { proposeMode } from "@/lib/cognition/sophistication";
import { runLLM } from "@/lib/model-client";
import type {
  CanonicalFact,
  CanonicalFactCandidate,
  ConversationType,
  IdentityContext,
  MemorySnippet,
  RhetoricalMode,
} from "@/lib/preprocessing/types";
import { attachInfluence, computeArchiveSignal } from "@/lib/memory/decay";
import { analyseSituation } from "@/lib/cognition/situations";
import { upsertEntities } from "@/lib/cognition/entityStore";
import { parseIntent, formatIntentForApproval } from "@/lib/gel/intentParser";
import { storePendingAction } from "@/lib/gel/actionStore";

export const runtime = "nodejs";

type CachedChatResponse = { expiresAt: number; responseJson: unknown };

declare global {
  // eslint-disable-next-line no-var
  var __memoriChatDedupe: Map<string, CachedChatResponse> | undefined;
}

function getDedupeMap(): Map<string, CachedChatResponse> {
  if (!globalThis.__memoriChatDedupe) globalThis.__memoriChatDedupe = new Map();
  return globalThis.__memoriChatDedupe;
}

function nowMs() {
  return Date.now();
}

function cleanupDedupeMap(map: Map<string, CachedChatResponse>) {
  const t = nowMs();
  let scanned = 0;
  for (const [k, v] of map.entries()) {
    if (v.expiresAt <= t) map.delete(k);
    scanned += 1;
    if (scanned >= 50) break;
  }
}

async function writeTrace(opts: {
  db: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  queryText: string;
  assistantText: string;
  pickedMemoryIds: string[];
  strategyHistory: unknown[];
}): Promise<string> {
  const { data, error } = await opts.db
    .from("memory_traces")
    .insert({
      user_id: opts.userId,
      query_text: opts.queryText,
      assistant_text: opts.assistantText,
      picked_memory_ids: opts.pickedMemoryIds ?? [],
      strategy_history: opts.strategyHistory ?? [],
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return String((data as any)?.id ?? "");
}

function readRequestId(req: NextRequest, body: any): string {
  const fromHeader =
    req.headers.get("x-memori-request-id") ||
    req.headers.get("x-request-id") ||
    "";
  const fromBody = String(body?.requestId ?? body?.request_id ?? "").trim();
  return (fromBody || fromHeader).trim();
}

function normalizeForFacts(input: string): string {
  return String(input ?? "")
    .replace(/[\u2019\u2018]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseName(maybeName: string): string | null {
  const n = String(maybeName ?? "").trim();
  if (!n) return null;
  if (!/^[A-Za-z][A-Za-z'\-]*(?:\s+[A-Za-z][A-Za-z'\-]*){0,3}$/.test(n)) {
    return null;
  }
  return n;
}

function parseLooseValue(maybeValue: string, maxLen = 80): string | null {
  const v = String(maybeValue ?? "")
    .trim()
    .replace(/[.!?]+$/, "")
    .replace(/\s+/g, " ");
  if (!v) return null;
  if (v.length > maxLen) return null;
  return v;
}

function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function titleCaseWords(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function normalizeRelation(rel: string): string {
  const r = String(rel ?? "").trim().toLowerCase();

  const irregular: Record<string, string> = {
    dogs: "dog",
    cats: "cat",
    friends: "friend",
    sisters: "sister",
    brothers: "brother",
    colleagues: "colleague",
    coworkers: "coworker",
    partners: "partner",
  };

  if (irregular[r]) return irregular[r];
  if (r.endsWith("s") && r.length > 3) return r.slice(0, -1);
  return r;
}

function relationPossessive(rel: string): string {
  const r = normalizeRelation(rel);
  if (r.endsWith("s")) return `${r}'`;
  return `${r}'s`;
}

function tier1ShouldExtract(userText: string): boolean {
  const t = normalizeForFacts(userText).toLowerCase();
  if (!t || t.length < 6) return false;

  const lowSignal = new Set([
    "ok", "okay", "thanks", "thank you", "cool", "great", "nice",
    "lol", "yes", "no", "k", "sure", "got it", "yep", "nope",
    "haha", "wow", "hmm", "interesting",
  ]);
  if (lowSignal.has(t)) return false;

  return (
    /\b(my|our|mine|me|i)\b/.test(t) ||
    /\b(name)\b/.test(t) ||
    /\b(is|was|are|were|am)\b/.test(t) ||
    /\b(i have|i've got|i got|i work|i live|i run|i lead|i own|i founded|i manage|i built|i started)\b/.test(t) ||
    /\b(timezone|time zone|role|based in|located in|call me)\b/.test(t) ||
    /\b(friend|friends|sister|sisters|brother|brothers|partner|partners|wife|husband|mum|mom|dad|father|mother|boss|manager|coworker|coworkers|colleague|colleagues|dog|dogs|cat|cats|pet|child|son|daughter)\b/.test(t)
  );
}

function makeSelfCanonicalFact(
  factKey: string,
  attribute: string,
  valueText: string,
  canonicalText: string,
  confidence = 0.95
): CanonicalFactCandidate {
  return {
    fact_key: factKey,
    subject: "self",
    attribute,
    value_text: valueText,
    canonical_text: canonicalText,
    confidence,
  };
}

function makePersonCanonicalFact(
  personName: string,
  attribute: string,
  valueText: string,
  canonicalText: string,
  confidence = 0.95
): CanonicalFactCandidate {
  const slug = slugifyName(personName);
  return {
    fact_key: `person_${slug}_${attribute}`,
    subject: `person:${personName}`,
    attribute,
    value_text: valueText,
    canonical_text: canonicalText,
    confidence,
  };
}

function toCanonicalFactCandidate(
  rel: string,
  name: string
): CanonicalFactCandidate {
  const relation = normalizeRelation(rel);

  if (relation === "name" || relation === "self") {
    return makeSelfCanonicalFact(
      "self_name",
      "name",
      name,
      `My name is ${name}.`
    );
  }

  return {
    fact_key: `${relation}_name`,
    subject: relation,
    attribute: "name",
    value_text: name,
    canonical_text: `My ${relationPossessive(relation)} name is ${name}.`,
    confidence: 0.95,
  };
}

function tier2ExtractFacts(
  userText: string
): { factText: string; kind: string; canonical?: CanonicalFactCandidate }[] {
  const t = normalizeForFacts(userText);
  if (!t) return [];

  const out: {
    factText: string;
    kind: string;
    canonical?: CanonicalFactCandidate;
  }[] = [];

  // ── Self name: "my name is X" ──
  const myNameMatch = t.match(/^my\s+name\s+is\s+(.+?)[.!?]?$/i);
  if (myNameMatch) {
    const name = parseName(myNameMatch[1]);
    if (name) {
      const canonical = toCanonicalFactCandidate("self", name);
      out.push({ kind: "my_name", factText: `my name: ${name}`, canonical });
      out.push({ kind: "my_name_sentence", factText: canonical.canonical_text, canonical });
    }
  }

  // ── Self name: "I'm X" / "I am X" ──
  const imNameMatch = t.match(/^i'?m\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)[.!?]?$/);
  if (imNameMatch && !myNameMatch) {
    const name = parseName(imNameMatch[1]);
    if (name) {
      const canonical = toCanonicalFactCandidate("self", name);
      out.push({ kind: "my_name", factText: `my name: ${name}`, canonical });
      out.push({ kind: "my_name_sentence", factText: canonical.canonical_text, canonical });
    }
  }

  // ── Self name: "call me X" ──
  const callMeMatch = t.match(/^call\s+me\s+(.+?)[.!?]?$/i);
  if (callMeMatch) {
    const name = parseName(callMeMatch[1]);
    if (name) {
      const canonical = toCanonicalFactCandidate("self", name);
      out.push({ kind: "my_name", factText: `my name: ${name}`, canonical });
      out.push({ kind: "my_name_sentence", factText: canonical.canonical_text, canonical });
    }
  }

  // ── Relation name: "my X's name is Y" ──
  const relMatch = t.match(/^my\s+(\w+)(?:'s)?\s+name\s+is\s+(.+?)[.!?]?$/i);
  if (relMatch) {
    const rel = normalizeRelation(relMatch[1]);
    const name = parseName(relMatch[2]);
    if (name && rel !== "name") {
      const canonical = toCanonicalFactCandidate(rel, name);
      out.push({ kind: `${rel}_name`, factText: `${rel} name: ${name}`, canonical });
      out.push({ kind: `${rel}_name_sentence`, factText: canonical.canonical_text, canonical });
    }
  }

  // ── Relation name: "my X is called/named Y" ──
  const calledMatch = t.match(
    /^my\s+(\w+)\s+(?:is called|is named|'s called|'s named)\s+(.+?)[.!?]?$/i
  );
  if (calledMatch && !relMatch) {
    const rel = normalizeRelation(calledMatch[1]);
    const name = parseName(calledMatch[2]);
    if (name) {
      const canonical = toCanonicalFactCandidate(rel, name);
      out.push({ kind: `${rel}_name`, factText: `${rel} name: ${name}`, canonical });
      out.push({ kind: `${rel}_name_sentence`, factText: canonical.canonical_text, canonical });
    }
  }

  // ── Relation name: "I have a X named Y" ──
  const haveMatch = t.match(/^i\s+have\s+a\s+(\w+)(?:\s+\w+)*\s+named\s+(.+?)[.!?]?$/i);
  if (haveMatch) {
    const rel = normalizeRelation(haveMatch[1]);
    const name = parseName(haveMatch[2]);
    if (name) {
      const canonical = toCanonicalFactCandidate(rel, name);
      out.push({ kind: `${rel}_name`, factText: `${rel} name: ${name}`, canonical });
      out.push({ kind: `${rel}_name_sentence`, factText: canonical.canonical_text, canonical });
    }
  }

  // ── Reverse: "X is my Y" ──
  const reverseMatch = t.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+is\s+my\s+(\w+)[.!?]?$/);
  if (reverseMatch) {
    const name = parseName(reverseMatch[1]);
    const rel = normalizeRelation(reverseMatch[2]);
    if (name) {
      const canonical = toCanonicalFactCandidate(rel, name);
      out.push({ kind: `${rel}_name`, factText: `${rel} name: ${name}`, canonical });
      out.push({ kind: `${rel}_name_sentence`, factText: `${name} is my ${rel}.`, canonical });
    }
  }

  // ── Company: "I work at/for X" — strip trailing role qualifier like "as CEO" ──
  const workAtMatch = t.match(/^i\s+work\s+(?:at|for)\s+(.+?)(?:\s+as\s+\w+.*)?[.!?]?$/i);
  if (workAtMatch) {
    const company = parseLooseValue(workAtMatch[1]);
    if (company) {
      const canonical = makeSelfCanonicalFact("self_company", "company", company, `I work at ${company}.`);
      out.push({ kind: "self_company", factText: `self company: ${company}`, canonical });
      out.push({ kind: "self_company_sentence", factText: canonical.canonical_text, canonical });
    }
  }

  // ── Company: "I run/lead/own/founded/built/started X" ──
  const runMatch = t.match(/^i\s+(?:run|lead|own|founded|built|started|manage|head)\s+(.+?)[.!?]?$/i);
  if (runMatch) {
    const company = parseLooseValue(runMatch[1]);
    if (company) {
      const canonical = makeSelfCanonicalFact("self_company", "company", company, `I run ${company}.`);
      out.push({ kind: "self_company", factText: `self company: ${company}`, canonical });
      out.push({ kind: "self_company_sentence", factText: canonical.canonical_text, canonical });
    }
  }

  // ── Role: "I work as X" ──
  const workAsMatch = t.match(/^i\s+work\s+as\s+(.+?)[.!?]?$/i);
  if (workAsMatch) {
    const role = parseLooseValue(workAsMatch[1]);
    if (role) {
      const canonical = makeSelfCanonicalFact("self_role", "role", role, `I work as ${role}.`);
      out.push({ kind: "self_role", factText: `self role: ${role}`, canonical });
      out.push({ kind: "self_role_sentence", factText: canonical.canonical_text, canonical });
    }
  }

  // ── Role: "my role is X" / "my job is X" / "my title is X" ──
  const myRoleMatch = t.match(/^my\s+(?:role|job|title|position)\s+is\s+(.+?)[.!?]?$/i);
  if (myRoleMatch) {
    const role = parseLooseValue(myRoleMatch[1]);
    if (role) {
      const canonical = makeSelfCanonicalFact("self_role", "role", role, `My role is ${role}.`);
      out.push({ kind: "self_role", factText: `self role: ${role}`, canonical });
      out.push({ kind: "self_role_sentence", factText: canonical.canonical_text, canonical });
    }
  }

  // ── Role: "I'm a/the X" / "I am a/the X" ──
  const imRoleMatch = t.match(/^i'?m\s+(?:a|an|the)\s+(.+?)[.!?]?$/i);
  if (imRoleMatch) {
    const role = parseLooseValue(imRoleMatch[1]);
    if (role && !parseName(role)) {
      const canonical = makeSelfCanonicalFact("self_role", "role", role, `I am a ${role}.`);
      out.push({ kind: "self_role", factText: `self role: ${role}`, canonical });
      out.push({ kind: "self_role_sentence", factText: canonical.canonical_text, canonical });
    }
  }

  // ── Role + Company: "I'm X at Y" ──
  const imRoleAtMatch = t.match(/^i'?m\s+(?:a|an|the)?\s*(.+?)\s+at\s+(.+?)[.!?]?$/i);
  if (imRoleAtMatch) {
    const role = parseLooseValue(imRoleAtMatch[1]);
    const company = parseLooseValue(imRoleAtMatch[2]);
    if (role && company && !parseName(role)) {
      const roleCanonical = makeSelfCanonicalFact("self_role", "role", role, `I work as ${role}.`);
      out.push({ kind: "self_role", factText: `self role: ${role}`, canonical: roleCanonical });
      const companyCanonical = makeSelfCanonicalFact("self_company", "company", company, `I work at ${company}.`);
      out.push({ kind: "self_company", factText: `self company: ${company}`, canonical: companyCanonical });
    }
  }

  // ── City: "I live in X" ──
  const liveInMatch = t.match(/^i\s+live\s+in\s+(.+?)[.!?]?$/i);
  if (liveInMatch) {
    const city = parseLooseValue(liveInMatch[1]);
    if (city) {
      const canonical = makeSelfCanonicalFact("self_city", "city", city, `I live in ${city}.`);
      out.push({ kind: "self_city", factText: `self city: ${city}`, canonical });
      out.push({ kind: "self_city_sentence", factText: canonical.canonical_text, canonical });
    }
  }

  // ── City: "I'm based in X" / "I'm located in X" ──
  const basedInMatch = t.match(/^i'?m\s+(?:based|located)\s+in\s+(.+?)[.!?]?$/i);
  if (basedInMatch) {
    const city = parseLooseValue(basedInMatch[1]);
    if (city) {
      const canonical = makeSelfCanonicalFact("self_city", "city", city, `I live in ${city}.`);
      out.push({ kind: "self_city", factText: `self city: ${city}`, canonical });
      out.push({ kind: "self_city_sentence", factText: canonical.canonical_text, canonical });
    }
  }

  // ── Timezone ──
  const timezoneMatch = t.match(/^my\s+time\s*zone\s+is\s+(.+?)[.!?]?$/i)
    ?? t.match(/^my\s+timezone\s+is\s+(.+?)[.!?]?$/i);
  if (timezoneMatch) {
    const tz = parseLooseValue(timezoneMatch[1]);
    if (tz) {
      const canonical = makeSelfCanonicalFact("self_timezone", "timezone", tz, `My timezone is ${tz}.`);
      out.push({ kind: "self_timezone", factText: `self timezone: ${tz}`, canonical });
      out.push({ kind: "self_timezone_sentence", factText: canonical.canonical_text, canonical });
    }
  }

  // ── Person relation: "X is my Y" ──
  const personRelationMatch = t.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+is\s+my\s+(\w+)[.!?]?$/);
  if (personRelationMatch) {
    const person = parseName(personRelationMatch[1]);
    const relation = normalizeRelation(personRelationMatch[2]);
    if (person && relation) {
      const canonical = makePersonCanonicalFact(person, "relation", relation, `${person} is my ${relation}.`);
      out.push({ kind: `${relation}_person_relation`, factText: `${person} relation: ${relation}`, canonical });
      out.push({ kind: `${relation}_person_relation_sentence`, factText: canonical.canonical_text, canonical });
    }
  }

  // ── Person role: "X runs Y" ──
  const personRunsRoleMatch = t.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+runs\s+(.+?)[.!?]?$/);
  if (personRunsRoleMatch) {
    const person = parseName(personRunsRoleMatch[1]);
    const role = parseLooseValue(personRunsRoleMatch[2]);
    if (person && role) {
      const canonical = makePersonCanonicalFact(person, "role", role, `${person} runs ${role}.`);
      out.push({ kind: "person_role", factText: `${person} role: ${role}`, canonical });
      out.push({ kind: "person_role_sentence", factText: canonical.canonical_text, canonical });
    }
  }

  return out;
}

type LLMFact = {
  kind: string;
  factText: string;
  confidence: number;
};

async function tier3ExtractFactsWithLLM(
  messageText: string
): Promise<LLMFact[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  const client = new OpenAI({ apiKey });
  const msg = normalizeForFacts(messageText);
  if (!msg) return [];

  const systemPrompt = [
    "You extract personal facts from a single message.",
    'Return ONLY valid JSON array: [{"kind":"...","factText":"...","confidence":0.0}].',
    "If no stable personal facts exist, return [].",
    "Each factText must be short and declarative.",
    "confidence is 0.0 to 1.0. Only include facts with confidence >= 0.75.",
    "Do not invent. Do not include questions or commands.",
  ].join(" ");

  try {
    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 300,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Message: "${msg}"` },
      ],
    });

    const raw = resp.choices?.[0]?.message?.content ?? "";
    if (!raw) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }

    const arr = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as any)?.facts)
      ? (parsed as any).facts
      : [];

    return (arr as any[])
      .map((item) => ({
        kind: String(item?.kind ?? "").trim(),
        factText: String(item?.factText ?? "").trim(),
        confidence: Math.max(0, Math.min(1, Number(item?.confidence ?? 0))),
      }))
      .filter((f) => f.kind && f.factText && f.confidence >= 0.75)
      .slice(0, 6);
  } catch {
    return [];
  }
}

async function alreadyStoredForRequest(opts: {
  supabase: any;
  userId: string;
  requestId: string;
}): Promise<boolean> {
  const { data, error } = await opts.supabase
    .from("memories_structured")
    .select("id")
    .eq("user_id", opts.userId)
    .eq("source_message_id", opts.requestId)
    .limit(1);

  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

function normalizeArchiveCmd(text: string): "ARCHIVE" | "KEEP" | "REVIEW" | null {
  const t = text.toLowerCase().trim();
  if (t === "archive") return "ARCHIVE";
  if (t === "keep") return "KEEP";
  if (t === "review") return "REVIEW";
  return null;
}

function canonicalFactMap(facts: CanonicalFact[]): Map<string, CanonicalFact> {
  const map = new Map<string, CanonicalFact>();
  for (const fact of facts) {
    map.set(fact.fact_key, fact);
  }
  return map;
}

function isGovernanceNoteText(text: string): boolean {
  const t = String(text ?? "").trim().toLowerCase();
  return t.startsWith("fact disputed:") || t.startsWith("fact review needed:");
}

function filterGovernanceNotes(memories: MemorySnippet[]): MemorySnippet[] {
  return memories.filter((m) => {
    const isNote = String(m.memory_type ?? "").toLowerCase() === "note";
    if (!isNote) return true;
    return !isGovernanceNoteText(m.text);
  });
}

function directFactAnswer(
  text: string,
  facts: CanonicalFact[],
  identityContext: IdentityContext | null
): { answer: string; pickedMemoryIds: string[]; factKeys: string[] } | null {
  const t = normalizeForFacts(text).toLowerCase();
  const factMap = canonicalFactMap(facts);

  function pack(answer: string, keys: string[]) {
    const pickedMemoryIds = keys
      .map((k) => factMap.get(k))
      .filter((x): x is CanonicalFact => Boolean(x))
      .map((f) => `fact:${f.id}`);
    return { answer, pickedMemoryIds, factKeys: keys };
  }

  if (/^what(?:'s| is)? my name\??$/i.test(t)) {
    const fact = factMap.get("self_name");
    if (fact) return pack(`Your name is ${fact.value_text}.`, ["self_name"]);
    // No canonical fact — do not fall back to display_name or identity context
  }

  if (/^(where do i work|what company do i work at|who do i work for|where am i employed)\??$/i.test(t)) {
    const fact = factMap.get("self_company");
    if (fact) return pack(`You work at ${fact.value_text}.`, ["self_company"]);
  }

  if (/^(where do i live|what city do i live in|where am i based)\??$/i.test(t)) {
    const fact = factMap.get("self_city");
    if (fact) return pack(`You live in ${fact.value_text}.`, ["self_city"]);
  }

  if (/^(what(?:'s| is)? my timezone|what time zone am i in|which timezone am i in)\??$/i.test(t)) {
    const fact = factMap.get("self_timezone");
    if (fact) return pack(`Your timezone is ${fact.value_text}.`, ["self_timezone"]);
  }

  const relNameMatch = t.match(/^what(?:'s| is)? my\s+(\w+)(?:'s)?\s+name\??$/i);
  if (relNameMatch) {
    const rel = normalizeRelation(relNameMatch[1]);
    const key = `${rel}_name`;
    const fact = factMap.get(key);
    if (fact) {
      const relPoss = relationPossessive(rel);
      return pack(`Your ${relPoss} name is ${fact.value_text}.`, [key]);
    }
  }

  const whoIsMatch = t.match(/^who\s+is\s+([a-z][a-z'\-]*(?:\s+[a-z][a-z'\-]*){0,2})\??$/i);
  if (whoIsMatch) {
    const name = titleCaseWords(whoIsMatch[1]);
    const slug = slugifyName(name);
    const relationKey = `person_${slug}_relation`;
    const roleKey = `person_${slug}_role`;
    const relation = factMap.get(relationKey);
    const role = factMap.get(roleKey);

    if (relation && role) {
      return pack(
        `${name} is your ${relation.value_text}. They run ${role.value_text}.`,
        [relationKey, roleKey]
      );
    }
    if (relation) {
      return pack(`${name} is your ${relation.value_text}.`, [relationKey]);
    }
    if (role) {
      return pack(`${name} runs ${role.value_text}.`, [roleKey]);
    }
  }

  return null;
}

function canonicalCandidateFromLLMFact(fact: LLMFact): CanonicalFactCandidate | null {
  const text = String(fact.factText ?? "").trim();
  const confidence = Math.max(0.75, Math.min(1, Number(fact.confidence ?? 0.85)));

  const selfNameMatch = text.match(/^my\s+name:\s+(.+)$/i);
  if (selfNameMatch) {
    const name = parseName(selfNameMatch[1]);
    if (name) {
      return makeSelfCanonicalFact("self_name", "name", name, `My name is ${name}.`, confidence);
    }
  }

  const relationNameMatch = text.match(/^([a-z_ ]+?)\s+name:\s+(.+)$/i);
  if (relationNameMatch) {
    const rawRelation = relationNameMatch[1].trim().toLowerCase().replace(/\s+/g, "_");
    const name = parseName(relationNameMatch[2]);
    if (name) {
      const relation = rawRelation === "my" ? "self" : normalizeRelation(rawRelation.replace(/_/g, " "));
      return toCanonicalFactCandidate(relation, name);
    }
  }

  const selfCompanyMatch = text.match(/^self\s+company:\s+(.+)$/i);
  if (selfCompanyMatch) {
    const company = parseLooseValue(selfCompanyMatch[1], 120);
    if (company) {
      return makeSelfCanonicalFact(
        "self_company",
        "company",
        company,
        `I work at ${company}.`,
        confidence
      );
    }
  }

  const selfRoleMatch = text.match(/^self\s+role:\s+(.+)$/i);
  if (selfRoleMatch) {
    const role = parseLooseValue(selfRoleMatch[1], 120);
    if (role) {
      return makeSelfCanonicalFact(
        "self_role",
        "role",
        role,
        `I work as ${role}.`,
        confidence
      );
    }
  }

  const selfCityMatch = text.match(/^self\s+city:\s+(.+)$/i);
  if (selfCityMatch) {
    const city = parseLooseValue(selfCityMatch[1], 120);
    if (city) {
      return makeSelfCanonicalFact(
        "self_city",
        "city",
        city,
        `I live in ${city}.`,
        confidence
      );
    }
  }

  const selfTimezoneMatch = text.match(/^self\s+timezone:\s+(.+)$/i);
  if (selfTimezoneMatch) {
    const tz = parseLooseValue(selfTimezoneMatch[1], 120);
    if (tz) {
      return makeSelfCanonicalFact(
        "self_timezone",
        "timezone",
        tz,
        `My timezone is ${tz}.`,
        confidence
      );
    }
  }

  const personRelationMatch = text.match(/^([A-Za-z][A-Za-z'\-]*(?:\s+[A-Za-z][A-Za-z'\-]*){0,2})\s+relation:\s+(.+)$/i);
  if (personRelationMatch) {
    const person = parseName(personRelationMatch[1]);
    const relation = parseLooseValue(personRelationMatch[2], 60);
    if (person && relation) {
      const normalizedRelation = normalizeRelation(relation);
      return makePersonCanonicalFact(
        person,
        "relation",
        normalizedRelation,
        `${person} is my ${normalizedRelation}.`,
        confidence
      );
    }
  }

  const personRoleMatch = text.match(/^([A-Za-z][A-Za-z'\-]*(?:\s+[A-Za-z][A-Za-z'\-]*){0,2})\s+role:\s+(.+)$/i);
  if (personRoleMatch) {
    const person = parseName(personRoleMatch[1]);
    const role = parseLooseValue(personRoleMatch[2], 120);
    if (person && role) {
      return makePersonCanonicalFact(
        person,
        "role",
        role,
        `${person} runs ${role}.`,
        confidence
      );
    }
  }

  return null;
}

type DecisionCandidate = {
  decisionText: string;
  expectedOutcome: string | null;
};

function extractDecisionCandidate(text: string): DecisionCandidate | null {
  const raw = String(text ?? "").trim();
  if (!raw) return null;

  const strongPatterns = [
    /^i decided to\b/i,
    /^i have decided to\b/i,
    /^i've decided to\b/i,
    /^my decision is to\b/i,
    /^i will\b/i,
    /^i'm going to\b/i,
    /^i am going to\b/i,
    /^i plan to\b/i,
  ];

  const matched = strongPatterns.some((re) => re.test(raw));
  if (!matched) return null;

  let cleaned = raw.replace(/[.!?]+$/, "").trim();
  if (!cleaned) return null;

  let expectedOutcome: string | null = null;

  const soThatMatch = cleaned.match(/\bso that\s+(.+)$/i);
  if (soThatMatch) {
    const outcome = parseLooseValue(soThatMatch[1], 160);
    if (outcome) expectedOutcome = outcome;
  }

  const becauseMatch = cleaned.match(/\bbecause\s+(.+)$/i);
  if (!expectedOutcome && becauseMatch) {
    const outcome = parseLooseValue(becauseMatch[1], 160);
    if (outcome) expectedOutcome = outcome;
  }

  return {
    decisionText: cleaned,
    expectedOutcome,
  };
}

async function storeDecisionFromChat(args: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  decisionText: string;
  expectedOutcome: string | null;
}): Promise<string> {
  const nowIso = new Date().toISOString();
  const reviewDueIso = new Date(Date.now() + 7 * 86400000).toISOString();
  const recentSinceIso = new Date(Date.now() - 10 * 60000).toISOString();

  // Idempotency check — prevent duplicate decisions captured within 10 minutes
  const { data: existing, error: existingError } = await args.supabase
    .from("decisions")
    .select("id")
    .eq("user_id", args.userId)
    .eq("text_snapshot", args.decisionText)
    .gte("created_at", recentSinceIso)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing?.id) {
    return String(existing.id);
  }

  // Write to decisions table only — sole authority for decision lifecycle
  const { data, error } = await args.supabase
    .from("decisions")
    .insert({
      user_id: args.userId,
      memory_id: null,
      text_snapshot: args.decisionText,
      related_goal: null,
      expected_outcome: args.expectedOutcome,
      review_due_at: reviewDueIso,
      outcome_count: 0,
      created_at: nowIso,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const decisionId = String((data as any)?.id ?? "");

  try {
    await args.supabase.from("decision_events").insert({
      user_id: args.userId,
      decision_id: decisionId,
      event_type: "created",
      event_data: {
        source: "chat_route",
        expected_outcome: args.expectedOutcome,
      },
      created_at: nowIso,
    });
  } catch {
    // non-blocking
  }

  return decisionId;
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authErr } = await supabase.auth.getUser();

  if (authErr || !authData.user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const user = authData.user;

  const body = await req.json().catch(() => ({}));
  const text = String((body as any).text ?? (body as any).message ?? "").trim();
  const history: { role: "user" | "assistant"; text: string }[] = Array.isArray((body as any).history)
    ? (body as any).history.slice(-10).filter((m: any) => m?.role && m?.text)
    : [];

  if (!text) {
    return NextResponse.json({ ok: false, error: "Missing text" }, { status: 400 });
  }

  const requestId = readRequestId(req, body);

  const dedupeMap = getDedupeMap();
  cleanupDedupeMap(dedupeMap);

  if (requestId) {
    const key = `${user.id}:${requestId}`;
    const cached = dedupeMap.get(key);
    if (cached && cached.expiresAt > nowMs()) {
      return NextResponse.json(cached.responseJson);
    }
  }

  const strategyHistory: unknown[] = [];

  async function respond(params: {
    mode: RhetoricalMode;
    assistantText: string;
    pickedMemoryIds?: string[];
    extraStrategyHistory?: unknown[];
  }) {
    const mergedHistory = [...strategyHistory, ...(params.extraStrategyHistory ?? [])];

    let traceId: string | null = null;
    try {
      traceId = await writeTrace({
        db: supabase,
        userId: user.id,
        queryText: text,
        assistantText: params.assistantText,
        pickedMemoryIds: params.pickedMemoryIds ?? [],
        strategyHistory: mergedHistory,
      });
    } catch {
      // non-blocking
    }

    const responseJson = {
      ok: true,
      mode: params.mode,
      text: params.assistantText,
      trace_id: traceId,
      request_id: requestId || null,
    };

    if (requestId) {
      dedupeMap.set(`${user.id}:${requestId}`, {
        expiresAt: nowMs() + 30000,
        responseJson,
      });
    }

    return NextResponse.json(responseJson);
  }

  try {
    const conversationType: ConversationType = "chat";
    const identityContext = await loadIdentityContext(user.id);

    const shouldExtract = tier1ShouldExtract(text);
    strategyHistory.push({ step: "tier1_gate", shouldExtract, requestId: requestId || null });

    if (shouldExtract) {
      let skip = false;

      if (requestId) {
        skip = await alreadyStoredForRequest({ supabase, userId: user.id, requestId });
        if (skip) strategyHistory.push({ step: "fact_store_skipped_idempotent", requestId });
      }

      if (!skip) {
        const tier2Facts = tier2ExtractFacts(text);

        if (tier2Facts.length > 0) {
          strategyHistory.push({ step: "tier2_regex", extracted: tier2Facts.map((f) => f.kind) });

          const canonicalSeen = new Set<string>();

          for (const f of tier2Facts) {
            try {
              const evidenceMemoryId = await storeFactMemory({
                userId: user.id,
                factText: f.factText,
                sourceMessageId: requestId || null,
                importance: 0.75,
                certainty: 0.95,
              });

              strategyHistory.push({
                step: "canonical_evidence_saved",
                kind: f.kind,
                evidenceMemoryId,
                fact_key: f.canonical?.fact_key ?? null,
              });

              if (f.canonical && !canonicalSeen.has(f.canonical.fact_key)) {
                canonicalSeen.add(f.canonical.fact_key);

                strategyHistory.push({
                  step: "canonical_upsert_attempt",
                  fact_key: f.canonical.fact_key,
                  value_text: f.canonical.value_text,
                });

                const factId = await upsertCanonicalFact({
                  userId: user.id,
                  candidate: f.canonical,
                  evidenceMemoryId,
                });

                strategyHistory.push({
                  step: "canonical_upsert_success",
                  fact_key: f.canonical.fact_key,
                  fact_id: factId,
                });
              }
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : "fact store failed";
              strategyHistory.push({
                step: "fact_store_error",
                tier: 2,
                kind: f.kind,
                error: msg,
              });
            }
          }
        } else {
          const llmFacts = await tier3ExtractFactsWithLLM(text);
          strategyHistory.push({ step: "tier3_llm", extracted: llmFacts.map((f) => f.kind) });

          const canonicalSeen = new Set<string>();

          for (const f of llmFacts) {
            try {
              const evidenceMemoryId = await storeFactMemory({
                userId: user.id,
                factText: f.factText,
                sourceMessageId: requestId || null,
                importance: 0.7,
                certainty: f.confidence,
              });

              const candidate = canonicalCandidateFromLLMFact(f);

              strategyHistory.push({
                step: "canonical_evidence_saved",
                kind: f.kind,
                evidenceMemoryId,
                fact_key: candidate?.fact_key ?? null,
              });

              if (candidate && !canonicalSeen.has(candidate.fact_key)) {
                canonicalSeen.add(candidate.fact_key);

                strategyHistory.push({
                  step: "canonical_upsert_attempt",
                  fact_key: candidate.fact_key,
                  value_text: candidate.value_text,
                });

                const factId = await upsertCanonicalFact({
                  userId: user.id,
                  candidate,
                  evidenceMemoryId,
                });

                strategyHistory.push({
                  step: "canonical_upsert_success",
                  fact_key: candidate.fact_key,
                  fact_id: factId,
                });
              }
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : "fact store failed";
              strategyHistory.push({
                step: "fact_store_error",
                tier: 3,
                kind: f.kind,
                error: msg,
              });
            }
          }
        }
      }
    }

    // Phase 3: GEL — detect action intents EARLY before LLM call
    const detectedIntent = parseIntent(text);
    if (detectedIntent.type !== "none" && detectedIntent.requiresApproval && detectedIntent.confidence >= 0.75) {
      const description = formatIntentForApproval(detectedIntent);
      // Generate a local ID immediately — don't block the response on DB storage
      const localActionId = `${detectedIntent.type}-${Date.now()}`;
      // Store async — fire and forget
      void storePendingAction(user.id, detectedIntent, description).catch(() => {});
      strategyHistory.push({ step: "gel_intent_detected", type: detectedIntent.type, actionId: localActionId, description });
      const gelResponse = await respond({
        mode: "ANALYST",
        assistantText: `I noticed an action in your message:\n\n${description}\n\nShould I proceed? Tap Approve or Cancel below.`,
        pickedMemoryIds: [],
        extraStrategyHistory: strategyHistory,
      });
      // Inject gel_kind and gel_params into response for UI
      const gelBody = await gelResponse.json() as Record<string, unknown>;
      gelBody.gel_kind = detectedIntent.type;
      gelBody.gel_params = detectedIntent.params;
      return NextResponse.json(gelBody);
    }

    const decisionCandidate = extractDecisionCandidate(text);
    if (decisionCandidate) {
      strategyHistory.push({
        step: "decision_detected",
        decision_text: decisionCandidate.decisionText,
        expected_outcome: decisionCandidate.expectedOutcome,
      });

      const decisionId = await storeDecisionFromChat({
        supabase,
        userId: user.id,
        decisionText: decisionCandidate.decisionText,
        expectedOutcome: decisionCandidate.expectedOutcome,
      });

      strategyHistory.push({
        step: "decision_stored",
        decision_id: decisionId,
      });

      return respond({
        mode: "ANALYST",
        assistantText: "Decision recorded. I'll bring it back for review in 7 days.",
        pickedMemoryIds: [decisionId],
      });
    }

    // Phase 2D: Run situation intelligence on every message
    const situationIntel = analyseSituation(text);
    if (situationIntel.hasSituation) {
      strategyHistory.push({
        step: "situation_intelligence",
        entities: situationIntel.entities.length,
        risk_flags: situationIntel.riskFlags,
        temporal_signals: situationIntel.temporalSignals,
        summary: situationIntel.situationSummary,
      });
    }
    // Attach situation intel to payload so LLM can use it
    (body as any).situationIntel = situationIntel.hasSituation ? situationIntel : undefined;

    // Phase 2D: Persist extracted entities to database (fire and forget)
    if (situationIntel.hasSituation && situationIntel.entities.length > 0) {
      void upsertEntities(user.id, situationIntel.entities).catch(() => {
        // Entity persistence is non-critical — never block the chat response
      });
    }

    const [allMemories, canonicalFacts] = await Promise.all([
      fetchMemoriesForUser(user.id),
      fetchCanonicalFactsForUser(user.id),
    ]);
    const recallSafeMemories = filterGovernanceNotes(allMemories);

    const direct = directFactAnswer(text, canonicalFacts, identityContext);
    if (direct) {
      strategyHistory.push({
        step: "direct_fact_answer",
        source: "canonical_or_identity",
        fact_keys: direct.factKeys,
      });

      return respond({
        mode: "ANALYST",
        assistantText: direct.answer,
        pickedMemoryIds: direct.pickedMemoryIds,
      });
    }

    const canonicalSnippets = canonicalFactsToMemorySnippets(canonicalFacts);
    const mergedMemories = [...canonicalSnippets, ...recallSafeMemories];
    const withInfluence = attachInfluence(mergedMemories);
    const archiveSignal = computeArchiveSignal(withInfluence);

    const archiveCmd = normalizeArchiveCmd(text);
    if (archiveCmd && archiveSignal && archiveCmd === "ARCHIVE") {
      if (!String(archiveSignal.memory_id).startsWith("fact:")) {
        await archiveMemory({ userId: user.id, memoryId: archiveSignal.memory_id });
      }
      return respond({
        mode: "ANALYST",
        assistantText: "Archived. It will no longer influence future recall.",
      });
    }

    if (archiveSignal) {
      return respond({
        mode: "ANALYST",
        assistantText: `Archive signal:\n"${archiveSignal.memory_text}"\n\n${archiveSignal.reason}\n\nType: ARCHIVE, KEEP, or REVIEW.`,
      });
    }

    const picked = pickRelevantMemories(withInfluence, text, 12);
    const contextSignals = (body as any).contextSignals ?? getContextSignals(text);

    const proposed_mode: RhetoricalMode = proposeMode({
      conversationType,
      sentiment: contextSignals.sentiment,
      containsQuestion: contextSignals.containsQuestion,
    });

    const payload = buildLLMPayload({
      text,
      conversationType,
      contextSignals,
      memorySnippets: picked,
      identityContext,
      dueDecisionReview: null,
    });
    // Attach situation intel to payload for LLM system prompt
    if (situationIntel.hasSituation) {
      (payload as any).situationIntel = situationIntel;
    }

    const out = await runLLM({ payload, proposed_mode, history });

    void bumpMemoriesRecalled(picked.map((m) => String(m.id)));

    return respond({
      mode: out.mode,
      assistantText: out.text,
      pickedMemoryIds: picked.map((m) => String(m.id)),
      extraStrategyHistory: (payload as any).strategyHistory ?? [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Chat error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
