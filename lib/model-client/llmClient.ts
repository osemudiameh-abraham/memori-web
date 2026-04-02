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
  facts: MemorySnippet[]
): string {
  const name = payload.identityContext?.displayName?.trim() ?? null;
  const identityLine = name ? `The user's name is ${name}.` : "";

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

  return [
    factsSection,
    "",
    "You are Memori — a cognitive continuity system for serious professionals.",
    "",
    "Hard constraints:",
    "- No filler. No 'Got it', 'Sure', 'Nice to meet you'.",
    "- Be direct. Short sentences.",
    "- Never say you are an AI or mention internal systems.",
    "- Do not manipulate. No dependency language.",
    "- If you do not know something NOT listed above, say so clearly.",
    "",
    "Response contract:",
    "- Decision → (a) best recommendation (b) key tradeoff (c) next step.",
    "- Memory/recall question → answer directly from the facts above.",
    "- Unclear input → ask max 2 clarifying questions.",
    "",
    identityLine,
    `Mode: ${mode} → ${modeDirective(mode)}`,
    `Decision continuity: ${due}`,
    "",
    "Output: plain text only. No JSON. No markdown headers.",
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
    console.log(`[Memori LLM] facts_in_system=${factCount} context_in_user=${contextCount}`);
    console.log("[Memori LLM] identity_snapshot=", {
      displayName: payload.identityContext?.displayName ?? null,
      selfName: payload.identityContext?.selfName ?? null,
      company: payload.identityContext?.company ?? null,
      role: payload.identityContext?.role ?? null,
      city: payload.identityContext?.city ?? null,
      timezone: payload.identityContext?.timezone ?? null,
    });
    if (factCount > 0) console.log("[Memori LLM] facts:", facts.map((f) => f.text));
  }

  const resp = await openai.chat.completions.create({
    model,
    temperature: 0.4,
    messages: [
      { role: "system", content: buildSystemPrompt(payload, chosen, facts) },
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
