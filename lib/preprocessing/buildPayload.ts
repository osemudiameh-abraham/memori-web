import type {
  ConversationType,
  ContextSignals,
  DueDecisionReview,
  IdentityContext,
  LLMPayload,
  MemorySnippet,
  StrategyHistory,
} from "./types";
import { sanitizeInput } from "./sanitize";

export function buildLLMPayload(args: {
  text: string;
  conversationType: ConversationType;
  contextSignals: ContextSignals;
  memorySnippets: MemorySnippet[];
  identityContext: IdentityContext | null;
  dueDecisionReview?: DueDecisionReview | null;
  recentAssistantModes?: LLMPayload["recentAssistantModes"];
  strategyHistory?: StrategyHistory;
}): LLMPayload {
  const sanitized = sanitizeInput(args.text);

  return {
    sanitized,
    sanitizedText: sanitized.sanitizedText,
    conversationType: args.conversationType,
    contextSignals: args.contextSignals,
    memorySnippets: args.memorySnippets,
    identityContext: args.identityContext,
    dueDecisionReview: args.dueDecisionReview ?? null,
    recentAssistantModes: args.recentAssistantModes,
    strategyHistory: args.strategyHistory ?? [],
  };
}

// keep old name if any file still imports it
export const buildPayload = buildLLMPayload;
