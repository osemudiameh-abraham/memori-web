import type { ContextSignals } from "./types";

export function getContextSignals(text: string): ContextSignals {
  const input = String(text ?? "").trim();
  const lower = input.toLowerCase();

  const containsQuestion = /\?$/.test(input) || /^(what|why|how|when|where|who|is|are|do|does|did|can|could|would|should)\b/i.test(input);

  let sentiment: ContextSignals["sentiment"] = "neutral";
  if (/\b(great|good|happy|excited|love|amazing|excellent)\b/.test(lower)) {
    sentiment = "positive";
  } else if (/\b(bad|sad|angry|upset|hate|terrible|awful|worried)\b/.test(lower)) {
    sentiment = "negative";
  }

  let urgency: ContextSignals["urgency"] = "low";
  if (/\b(now|urgent|asap|immediately|today)\b/.test(lower)) {
    urgency = "high";
  } else if (/\b(soon|this week|tomorrow)\b/.test(lower)) {
    urgency = "medium";
  }

  return {
    urgency,
    sentiment,
    containsQuestion,
  };
}