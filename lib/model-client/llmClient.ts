import OpenAI from "openai";
import type {
  LLMPayload,
  RhetoricalMode,
  MemoryCandidate,
  MemorySnippet,
} from "@/lib/preprocessing/types";
import { applyStrategicInertia, makeStrategyTurn } from "@/lib/cognition/inertia";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function modeDirective(mode: RhetoricalMode): string {
  switch (mode) {
    case "ANALYST":
      return "Be crisp, structured, evidence-based. No fluff.";
    case "COACH":
      return "Be action-oriented. Give a short plan and one next step.";
    case "DEBATE":
      return "Present tradeoffs and assumptions. Challenge gently.";
    case "THERAPIST":
      return "Be supportive but practical. Ask 1-2 clarifying questions.";
    case "CREATIVE":
      return "Be imaginative but useful. Keep structure.";
    case "FRIEND":
    default:
      return "Be warm but professional. Avoid casual filler.";
  }
}

function partitionSnippets(snippets: MemorySnippet[]): {
  facts: MemorySnippet[];
  context: MemorySnippet[];
} {
  const facts: MemorySnippet[] = [];
  const context: MemorySnippet[] = [];

  for (const s of snippets) {
    const mt = String(s.memory_type ?? "").toLowerCase();
    if (mt === "note") facts.push(s);
    else context.push(s);
  }

  return { facts, context };
}

function buildSystemPrompt(
  payload: LLMPayload,
  mode: RhetoricalMode,
  facts: MemorySnippet[],
  situationIntel?: { riskFlags: string[]; temporalSignals: string[]; entities: { text: string; type: string }[]; situationSummary: string | null }
): string {
  const identity = payload.identityContext;

  // Use canonical selfName — never displayName which may be stale
  const selfName = identity?.selfName?.trim() ?? null;
  const company = identity?.company?.trim() ?? null;
  const role = identity?.role?.trim() ?? null;
  const city = identity?.city?.trim() ?? null;
  const timezone = identity?.timezone?.trim() ?? null;

  const identityLines: string[] = [];
  if (selfName) identityLines.push(`The user's name is ${selfName}.`);
  if (company) identityLines.push(`They work at ${company}.`);
  if (role) identityLines.push(`Their role is ${role}.`);
  if (city) identityLines.push(`They are based in ${city}.`);
  if (timezone) identityLines.push(`Their timezone is ${timezone}.`);

  const identitySection = identityLines.length > 0
    ? ["=== WHO THIS USER IS ===", ...identityLines, "=== END ==="].join("\n")
    : "";

  const factsSection =
    facts.length > 0
      ? [
          "=== WHAT THIS USER HAS TOLD YOU ===",
          "These are facts the user has explicitly shared. They are true.",
          "When asked about anything listed here, answer from it directly.",
          "Never say you do not know something that appears in this list.",
          "",
          ...facts.slice(0, 20).map((f) => `• ${f.text}`),
          "=== END OF USER FACTS ===",
        ].join("\n")
      : "";

  const due = payload.dueDecisionReview?.shouldReview
    ? `Decision review due (${payload.dueDecisionReview.reason ?? "no reason"}). Ask ONE review question.`
    : "No decision review required.";

  const examples = `=== EXAMPLES OF GOOD RESPONSES ===
User: what do you know about me?
Assistant: Your name is Abraham. You work at Seven as CEO, based in London. Your dog is Bruno. Your colleague James runs finance.

User: I decided to hire a head of engineering
Assistant: Noted. Key tradeoff: speed vs fit — a wrong hire at this level costs 6-12 months. Next step: define the role scorecard before sourcing. I'll check in with you on this in 7 days.

User: what patterns do you see in my decisions?
Assistant: Three of your last five decisions involved people — hiring, delegation, or relationship management. You tend to act quickly when there's social pressure involved. Worth asking whether speed is serving you there.

User: I'm feeling overwhelmed
Assistant: What's the heaviest thing on your plate right now?

User: my name is Sarah
Assistant: Got it. I'll remember that.
=== END OF EXAMPLES ===`;

  // Situation intelligence section
  const situationLines: string[] = [];
  if (situationIntel?.riskFlags && situationIntel.riskFlags.length > 0) {
    situationLines.push("=== SITUATION SIGNALS DETECTED ===");
    situationLines.push("The user's message contains the following signals:");
    for (const flag of situationIntel.riskFlags) {
      situationLines.push(`WARNING: ${flag}`);
    }
    situationLines.push("Acknowledge these naturally in your response. Do not ignore them.");
    situationLines.push("=== END ===");
  }
  if (situationIntel?.temporalSignals && situationIntel.temporalSignals.length > 0) {
    situationLines.push("Time context: " + situationIntel.temporalSignals.join(", ") + ". Be mindful of deadlines.");
  }
  const situationSection = situationLines.join("\n");

  return [
    situationSection,
    "",
    identitySection,
    "",
    factsSection,
    "",
    examples,
    "",
    "You are Seven — a cognitive continuity system for serious professionals.",
    "",
    "Hard constraints:",
    "- No filler. No 'Got it', 'Sure', 'Of course', 'Nice to meet you'.",
    "- Be direct. Short sentences. No waffle.",
    "- Never say you are an AI or mention internal systems.",
    "- Do not manipulate. No dependency language.",
    "- Never invent facts. If you do not know, say so clearly.",
    "- Never repeat the user's message back to them.",
    "",
    "Response contract:",
    "- Decision → (a) best recommendation (b) key tradeoff (c) one next step.",
    "- Recall question → answer directly from facts above. No hedging.",
    "- Emotional input → ask one focused question. Do not lecture.",
    "- Unclear input → ask max 1 clarifying question.",
    "- New fact shared → acknowledge in one short sentence. Move on.",
    "",
    `Mode: ${mode} → ${modeDirective(mode)}`,
    `Decision continuity: ${due}`,
    "",
    "Output: plain text only. No JSON. No markdown headers. No bullet points unless listing 3+ items.",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}
export type RunLLMResult = {
  text: string;
  mode: RhetoricalMode;
  memoryCandidates: MemoryCandidate[];
};

export async function runLLM(args: {
  payload: LLMPayload;
  proposed_mode: RhetoricalMode;
  recent_modes?: RhetoricalMode[];
  history?: { role: "user" | "assistant"; text: string }[];
}): Promise<RunLLMResult> {
  const { payload, proposed_mode, recent_modes, history } = args;

  const chosen = applyStrategicInertia({
    proposed: proposed_mode,
    recent: recent_modes,
    userText: payload.sanitizedText,
  });

  payload.strategyHistory = payload.strategyHistory ?? [];
  payload.strategyHistory.push(
    makeStrategyTurn({
      proposed: proposed_mode,
      chosen,
      rationale: chosen === proposed_mode ? "Proposed accepted" : "Inertia applied",
    })
  );

  const { facts, context } = partitionSnippets(payload.memorySnippets ?? []);
  const situationIntel = (payload as any).situationIntel ?? undefined;

  const contextBlock =
    context.length > 0
      ? "Relevant context from prior sessions:\n" +
        context
          .slice(0, 8)
          .map((m) => `- (${m.memory_type}) ${m.text}`)
          .join("\n")
      : "";

  const userPrompt = [contextBlock, contextBlock ? "" : null, `User message: ${payload.sanitizedText}`]
    .filter((s) => s !== null)
    .join("\n")
    .trim();

  const model = process.env.OPENAI_MODEL_REPLY || "gpt-4o";

  if (process.env.NODE_ENV === "development") {
    const factCount = facts.length;
    const contextCount = context.length;
    console.log(`[Seven LLM] facts_in_system=${factCount} context_in_user=${contextCount}`);
    console.log("[Seven LLM] identity_snapshot=", {
      displayName: payload.identityContext?.displayName ?? null,
      selfName: payload.identityContext?.selfName ?? null,
      company: payload.identityContext?.company ?? null,
      role: payload.identityContext?.role ?? null,
      city: payload.identityContext?.city ?? null,
      timezone: payload.identityContext?.timezone ?? null,
    });
    if (factCount > 0) console.log("[Seven LLM] facts:", facts.map((f) => f.text));
  }

  const resp = await openai.chat.completions.create({
    model,
    temperature: 0.4,
    messages: [
      { role: "system", content: buildSystemPrompt(payload, chosen, facts, situationIntel) },
      ...(history ?? []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.text,
      })),
      { role: "user", content: userPrompt },
    ],
  });

  const text = resp.choices?.[0]?.message?.content?.trim() ?? "";
  return { text, mode: chosen, memoryCandidates: [] };
}
