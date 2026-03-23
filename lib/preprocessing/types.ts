/* -------------------- Conversation -------------------- */
export type ConversationType =
  | "chat"
  | "voice"
  | "memory_review"
  | "identity_update";

/* -------------------- Modes -------------------- */
export type RhetoricalMode =
  | "FRIEND"
  | "COACH"
  | "ANALYST"
  | "CREATIVE"
  | "DEBATE"
  | "THERAPIST";

/* -------------------- Sanitization -------------------- */
export interface SanitizedInput {
  rawText: string;
  sanitizedText: string;
}

/* -------------------- Context Signals -------------------- */
export type UrgencyLevel = "low" | "medium" | "high";

export interface ContextSignals {
  urgency: UrgencyLevel;
  sentiment: "negative" | "neutral" | "positive";
  containsQuestion: boolean;
}

/* -------------------- Identity -------------------- */
export interface IdentityContext {
  userId: string;
  displayName?: string | null;
  traits?: Record<string, unknown>;

  selfName?: string | null;
  company?: string | null;
  role?: string | null;
  city?: string | null;
  timezone?: string | null;

  canonicalFacts?: Record<string, string>;
}

/* -------------------- Memory -------------------- */
export interface MemorySnippet {
  id: string;
  user_id: string;
  text: string;
  memory_type: string;
  importance: number;
  created_at: string;
  last_seen_at: string;
  times_recalled: number;
  certainty?: number | null;
  related_goal?: string | null;
  expected_outcome?: string | null;
  review_due_at?: string | null;
  parent_decision_id?: string | null;
  archived_at?: string | null;
  source_message_id?: string | null;

  influence?: number;
}

/* -------------------- Canonical Facts -------------------- */
export type CanonicalFactStatus = "active" | "superseded" | "historical" | "disputed";

export interface CanonicalFact {
  id: string;
  user_id: string;
  fact_key: string;
  subject: string;
  attribute: string;
  value_text: string;
  canonical_text: string;
  confidence: number;
  evidence_count: number;
  status: CanonicalFactStatus;
  supersedes_fact_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CanonicalFactCandidate {
  fact_key: string;
  subject: string;
  attribute: string;
  value_text: string;
  canonical_text: string;
  confidence: number;
}

/* -------------------- Stored candidate memory -------------------- */
export interface MemoryCandidate {
  text: string;
  memory_type: string;
  importance: number;
  certainty: number;
  related_goal?: string | null;
  expected_outcome?: string | null;
  review_due_at?: string | null;
}

/* -------------------- Review Gate -------------------- */
export interface DueDecisionReview {
  shouldReview: boolean;
  memory_type?: "decision" | "identity" | "preference" | "task" | "general";
  reason?: string;
}

/* -------------------- Archive Signal -------------------- */
export interface ArchiveSignal {
  memory_id: string;
  memory_type: string;
  memory_text: string;
  reason: string;
  proposed_action: "ARCHIVE" | "KEEP" | "REVIEW";
}

/* -------------------- Strategy -------------------- */
export interface StrategyTurn {
  at: string;
  proposed: RhetoricalMode;
  chosen: RhetoricalMode;
  rationale: string;
}

export type StrategyHistory = StrategyTurn[];

/* -------------------- LLM payload -------------------- */
export interface LLMPayload {
  sanitized: SanitizedInput;
  sanitizedText: string;
  conversationType: ConversationType;
  contextSignals: ContextSignals;
  memorySnippets: MemorySnippet[];
  identityContext: IdentityContext | null;
  dueDecisionReview?: DueDecisionReview | null;
  recentAssistantModes?: RhetoricalMode[];
  strategyHistory?: StrategyHistory;
  archiveSignal?: ArchiveSignal | null;
  currentTimeIso?: string;
}
