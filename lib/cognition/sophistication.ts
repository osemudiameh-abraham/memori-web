import type { ConversationType, RhetoricalMode } from "@/lib/preprocessing/types";

export function proposeMode(args: {
  conversationType: ConversationType;
  sentiment: "negative" | "neutral" | "positive";
  containsQuestion: boolean;
}): RhetoricalMode {
  if (args.conversationType === "memory_review") return "ANALYST";
  if (args.sentiment === "negative") return "FRIEND";
  if (args.containsQuestion) return "FRIEND";
  return "FRIEND";
}
