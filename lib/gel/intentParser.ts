// lib/gel/intentParser.ts
// Phase 3 — GEL Intent Parser
// Detects action intents in user messages

export type IntentType =
  | "send_email"
  | "draft_message"
  | "create_reminder"
  | "schedule_meeting"
  | "search_web"
  | "log_decision"
  | "none";

export interface DetectedIntent {
  type: IntentType;
  confidence: number;
  params: Record<string, string | null>;
  rawText: string;
  requiresApproval: boolean;
}

const EMAIL_PATTERNS = [
  /\bsend\b.{0,40}\b(email|message|note)\b.{0,40}\bto\b\s+([A-Z][a-z]+|\w+@\w+)/i,
  /\bemail\b\s+([A-Z][a-z]+)/i,
  /\bforward\b.{0,30}\bto\b\s+([A-Z][a-z]+)/i,
];

const DRAFT_PATTERNS = [
  /\bdraft\b.{0,40}\b(email|message|reply|response)\b/i,
  /\bwrite\b.{0,20}\b(email|message|note)\b.{0,30}\bto\b/i,
  /\bcompose\b.{0,30}\b(email|message)\b/i,
];

const REMINDER_PATTERNS = [
  /\bremind\b.{0,10}\bme\b.{0,40}\b(about|to|at|on)\b/i,
  /\bset\b.{0,10}\b(a\s+)?reminder\b/i,
  /\bdon't\s+let\s+me\s+forget\b/i,
  /\bfollow.?up\b.{0,20}\b(in|on|at|next)\b/i,
];

const MEETING_PATTERNS = [
  /\b(schedule|book|arrange|set up)\b.{0,30}\b(meeting|call|chat|sync)\b/i,
  /\b(meeting|call)\b.{0,20}\bwith\b.{0,30}\b(next|this|on|at)\b/i,
  /\bcalendar\b.{0,20}\b(invite|event|block)\b/i,
];

const SEARCH_PATTERNS = [
  /\b(search|look up|find|google|check)\b.{0,30}\b(for|what|who|when|where)\b/i,
  /\bwhat('?s|\s+is)\b.{0,30}\b(the\s+latest|current|recent)\b/i,
];

function extractRecipient(text: string): string | null {
  // "to James" — most reliable
  const toMatch = text.match(/\bto\b\s+([A-Z][a-z]+)/);
  if (toMatch) return toMatch[1];
  // "email James" or "send James" — capture word AFTER the verb
  const verbMatch = text.match(/\b(?:email|message|send|tell|contact)\b\s+([A-Z][a-z]+)/i);
  if (verbMatch) return verbMatch[1];
  // "with James"
  const withMatch = text.match(/\bwith\b\s+([A-Z][a-z]+)/);
  if (withMatch) return withMatch[1];
  return null;
}

function extractSubject(text: string): string | null {
  const m = text.match(/\babout\b\s+(.{5,60}?)(?:\.|,|$)/i);
  return m?.[1]?.trim() ?? null;
}

function extractTime(text: string): string | null {
  const patterns = [
    /\b(tomorrow|today|tonight)\b/i,
    /\b(next|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month)\b/i,
    /\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i,
    /\bin\s+(\d+)\s+(minutes?|hours?|days?|weeks?)\b/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0]?.trim() ?? null;
  }
  return null;
}

export function parseIntent(text: string): DetectedIntent {
  const t = text.trim();

  // Check email send
  for (const p of EMAIL_PATTERNS) {
    if (p.test(t)) {
      return {
        type: "send_email",
        confidence: 0.85,
        params: {
          recipient: extractRecipient(t),
          subject: extractSubject(t),
          time: null,
        },
        rawText: t,
        requiresApproval: true,
      };
    }
  }

  // Check draft
  for (const p of DRAFT_PATTERNS) {
    if (p.test(t)) {
      return {
        type: "draft_message",
        confidence: 0.80,
        params: {
          recipient: extractRecipient(t),
          subject: extractSubject(t),
          time: null,
        },
        rawText: t,
        requiresApproval: false,
      };
    }
  }

  // Check reminder
  for (const p of REMINDER_PATTERNS) {
    if (p.test(t)) {
      return {
        type: "create_reminder",
        confidence: 0.82,
        params: {
          recipient: null,
          subject: extractSubject(t) ?? t.slice(0, 60),
          time: extractTime(t),
        },
        rawText: t,
        requiresApproval: true,
      };
    }
  }

  // Check meeting
  for (const p of MEETING_PATTERNS) {
    if (p.test(t)) {
      return {
        type: "schedule_meeting",
        confidence: 0.78,
        params: {
          recipient: extractRecipient(t),
          subject: extractSubject(t),
          time: extractTime(t),
        },
        rawText: t,
        requiresApproval: true,
      };
    }
  }

  // Check search
  for (const p of SEARCH_PATTERNS) {
    if (p.test(t)) {
      return {
        type: "search_web",
        confidence: 0.70,
        params: {
          recipient: null,
          subject: t.slice(0, 80),
          time: null,
        },
        rawText: t,
        requiresApproval: false,
      };
    }
  }

  return {
    type: "none",
    confidence: 0,
    params: {},
    rawText: t,
    requiresApproval: false,
  };
}

export function formatIntentForApproval(intent: DetectedIntent): string {
  switch (intent.type) {
    case "send_email":
      return `Send an email${intent.params.recipient ? ` to ${intent.params.recipient}` : ""}${intent.params.subject ? ` about "${intent.params.subject}"` : ""}`;
    case "draft_message":
      return `Draft a message${intent.params.recipient ? ` to ${intent.params.recipient}` : ""}${intent.params.subject ? ` about "${intent.params.subject}"` : ""}`;
    case "create_reminder":
      return `Set a reminder${intent.params.time ? ` for ${intent.params.time}` : ""}${intent.params.subject ? `: "${intent.params.subject}"` : ""}`;
    case "schedule_meeting":
      return `Schedule a meeting${intent.params.recipient ? ` with ${intent.params.recipient}` : ""}${intent.params.time ? ` ${intent.params.time}` : ""}`;
    case "search_web":
      return `Search for: "${intent.params.subject}"`;
    default:
      return intent.rawText;
  }
}
