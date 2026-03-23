import type { ArchiveSignal, MemorySnippet } from "@/lib/preprocessing/types";

export function attachInfluence(memories: MemorySnippet[]): MemorySnippet[] {
  const now = Date.now();

  return memories.map((m) => {
    const created = Date.parse(m.created_at ?? "");
    const ageDays =
      Number.isFinite(created) && created > 0
        ? Math.max(0, (now - created) / 86400000)
        : 30;

    const importance = Number.isFinite(m.importance) ? m.importance : 0.5;
    const recalled = Number.isFinite(m.times_recalled) ? m.times_recalled : 0;
    const certainty = Number.isFinite(m.certainty as number)
      ? Number(m.certainty)
      : 0.7;

    const recencyBoost = Math.max(0.4, 1.4 - ageDays * 0.02);
    const recallBoost = Math.min(1.25, 1 + recalled * 0.03);

    const influence = importance * certainty * recencyBoost * recallBoost;

    return {
      ...m,
      influence,
    };
  });
}

function isGovernanceNote(text: string): boolean {
  const t = String(text ?? "").trim().toLowerCase();
  return t.startsWith("fact disputed:") || t.startsWith("fact review needed:");
}

export function computeArchiveSignal(
  memories: MemorySnippet[]
): ArchiveSignal | null {
  const candidate = memories.find((m) => {
    if (String(m.memory_type ?? "").toLowerCase() !== "note") return false;
    if (String(m.id).startsWith("fact:")) return false;
    if (isGovernanceNote(m.text)) return false;

    const recalled = Number.isFinite(m.times_recalled) ? m.times_recalled : 0;
    const influence = Number.isFinite(m.influence as number)
      ? Number(m.influence)
      : 1;

    return recalled === 0 && influence < 0.2;
  });

  if (!candidate) return null;

  return {
    memory_id: candidate.id,
    memory_type: candidate.memory_type,
    memory_text: candidate.text,
    reason: "This memory has low influence and has never been recalled.",
    proposed_action: "ARCHIVE",
  };
}
