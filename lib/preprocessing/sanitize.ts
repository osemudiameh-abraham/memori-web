import type { SanitizedInput } from "./types";

export function sanitizeInput(rawText: string): SanitizedInput {
  const raw = String(rawText ?? "");
  const sanitizedText = raw.replace(/\s+/g, " ").trim();

  return {
    rawText: raw,
    sanitizedText,
  };
}