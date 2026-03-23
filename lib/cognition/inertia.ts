import type { RhetoricalMode, StrategyTurn } from "@/lib/preprocessing/types";

export function applyStrategicInertia(args: {
  proposed: RhetoricalMode;
  recent?: RhetoricalMode[];
  userText: string;
}): RhetoricalMode {
  const recent = args.recent ?? [];
  if (recent.length === 0) return args.proposed;

  const last = recent[recent.length - 1];
  const text = String(args.userText ?? "").toLowerCase();

  const strongOverride =
    /\b(decide|decision|analyze|analysis|plan|strategy|tradeoff|compare)\b/.test(text);

  if (strongOverride) return args.proposed;

  if (last === args.proposed) return args.proposed;

  return args.proposed;
}

export function makeStrategyTurn(args: {
  proposed: RhetoricalMode;
  chosen: RhetoricalMode;
  rationale: string;
}): StrategyTurn {
  return {
    at: new Date().toISOString(),
    proposed: args.proposed,
    chosen: args.chosen,
    rationale: args.rationale,
  };
}