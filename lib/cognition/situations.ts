// lib/cognition/situations.ts
// Phase 2D — Situation Intelligence Engine
// Extracts entities, relationships, and temporal context from user messages

export type EntityType =
  | "person"
  | "company"
  | "place"
  | "date"
  | "project"
  | "goal"
  | "risk"
  | "unknown";

export interface ExtractedEntity {
  text: string;
  type: EntityType;
  confidence: number;
  context?: string;
}

export interface RelationshipSignal {
  from: string;
  to: string;
  relation: string;
}

export interface SituationIntelligence {
  entities: ExtractedEntity[];
  relationships: RelationshipSignal[];
  temporalSignals: string[];
  riskFlags: string[];
  hasSituation: boolean;
  situationSummary: string | null;
}

// Person name patterns
const PERSON_PATTERNS = [
  /\b(?:my|our)\s+(?:friend|colleague|partner|sister|brother|wife|husband|boss|manager|ceo|cto|co-founder|cofounder|mentor|client|investor|advisor)\s+([A-Z][a-z]+)/g,
  /\b([A-Z][a-z]+)\s+(?:told me|said|mentioned|asked|suggested|thinks|believes|wants|needs)/g,
  /\bmeeting\s+(?:with\s+)?([A-Z][a-z]+)\b/g,
  /\bcall\s+(?:with\s+)?([A-Z][a-z]+)\b/g,
];

// Company/project patterns
const COMPANY_PATTERNS = [
  /\b(?:at|for|with|building|launching|working on|joined)\s+([A-Z][A-Za-z0-9]+(?:\s[A-Z][a-z]+)?)\b/g,
  /\b([A-Z][A-Za-z0-9]+)\s+(?:raised|funded|acquired|launched|IPO|Series [A-Z])/g,
];

// Temporal patterns
const TEMPORAL_PATTERNS = [
  /\b(?:by|before|after|until|on|in)\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/gi,
  /\b(?:next|this|last)\s+(?:week|month|quarter|year)/gi,
  /\b(?:tomorrow|yesterday|today|tonight)\b/gi,
  /\bin\s+(\d+)\s+(?:days?|weeks?|months?)\b/gi,
  /\bQ[1-4]\s+\d{4}\b/gi,
  /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b/gi,
  /\bdeadline\b/gi,
  /\b(?:launch|ship|release|deliver)\s+(?:by|on)\b/gi,
];

// Risk flag patterns
const RISK_PATTERNS = [
  { pattern: /\b(?:worried|anxious|stressed|overwhelmed|stuck|blocked|failing|failed)\b/gi, label: "Emotional distress signal" },
  { pattern: /\b(?:losing|lost)\s+(?:money|revenue|clients?|users?|customers?)\b/gi, label: "Business risk signal" },
  { pattern: /\b(?:conflict|disagreement|argument|falling out|tension)\b/gi, label: "Relationship friction signal" },
  { pattern: /\b(?:deadline|overdue|late|behind|delayed)\b/gi, label: "Timeline risk signal" },
  { pattern: /\b(?:quit|resign|leave|fire|fired|laid off)\b/gi, label: "Employment risk signal" },
  { pattern: /\b(?:broke|debt|cash flow|runway|burn rate)\b/gi, label: "Financial pressure signal" },
];

function extractPersons(text: string): ExtractedEntity[] {
  const found: ExtractedEntity[] = [];
  const seen = new Set<string>();

  for (const pattern of PERSON_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1];
      if (name && !seen.has(name.toLowerCase()) && name.length > 2) {
        seen.add(name.toLowerCase());
        found.push({
          text: name,
          type: "person",
          confidence: 0.75,
          context: match[0],
        });
      }
    }
  }

  return found;
}

function extractCompanies(text: string): ExtractedEntity[] {
  const found: ExtractedEntity[] = [];
  const seen = new Set<string>();

  for (const pattern of COMPANY_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1];
      if (name && !seen.has(name.toLowerCase()) && name.length > 2) {
        seen.add(name.toLowerCase());
        found.push({
          text: name,
          type: "company",
          confidence: 0.65,
          context: match[0],
        });
      }
    }
  }

  return found;
}

function extractTemporalSignals(text: string): string[] {
  const signals: string[] = [];
  for (const pattern of TEMPORAL_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = text.match(pattern);
    if (matches) {
      for (const m of matches) {
        if (!signals.includes(m.trim())) signals.push(m.trim());
      }
    }
  }
  return signals;
}

function extractRiskFlags(text: string): string[] {
  const flags: string[] = [];
  for (const { pattern, label } of RISK_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      if (!flags.includes(label)) flags.push(label);
    }
  }
  return flags;
}

function detectRelationships(
  text: string,
  entities: ExtractedEntity[]
): RelationshipSignal[] {
  const relationships: RelationshipSignal[] = [];
  const persons = entities.filter(e => e.type === "person");
  const companies = entities.filter(e => e.type === "company");

  // Person ↔ company relationships
  for (const person of persons) {
    for (const company of companies) {
      const worksAt = new RegExp(
        `${person.text}\\s+(?:works?|is|at|joined|runs?|leads?)\\s+(?:at\\s+)?${company.text}`,
        "i"
      );
      if (worksAt.test(text)) {
        relationships.push({ from: person.text, to: company.text, relation: "works_at" });
      }
    }
  }

  // Role relationships
  const rolePattern = /\bmy\s+(friend|colleague|partner|boss|investor|advisor|mentor|client)\s+([A-Z][a-z]+)/g;
  rolePattern.lastIndex = 0;
  let match;
  while ((match = rolePattern.exec(text)) !== null) {
    relationships.push({ from: "self", to: match[2], relation: match[1] });
  }

  return relationships;
}

function buildSituationSummary(intel: Omit<SituationIntelligence, "hasSituation" | "situationSummary">): string | null {
  const parts: string[] = [];

  if (intel.entities.length > 0) {
    const persons = intel.entities.filter(e => e.type === "person").map(e => e.text);
    const companies = intel.entities.filter(e => e.type === "company").map(e => e.text);
    if (persons.length > 0) parts.push(`People: ${persons.join(", ")}`);
    if (companies.length > 0) parts.push(`Organisations: ${companies.join(", ")}`);
  }

  if (intel.temporalSignals.length > 0) {
    parts.push(`Time context: ${intel.temporalSignals.slice(0, 2).join(", ")}`);
  }

  if (intel.riskFlags.length > 0) {
    parts.push(`Signals: ${intel.riskFlags.join("; ")}`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

export function analyseSituation(text: string): SituationIntelligence {
  const persons = extractPersons(text);
  const companies = extractCompanies(text);
  const entities = [...persons, ...companies];
  const temporalSignals = extractTemporalSignals(text);
  const riskFlags = extractRiskFlags(text);
  const relationships = detectRelationships(text, entities);

  const hasSituation =
    entities.length > 0 ||
    temporalSignals.length > 0 ||
    riskFlags.length > 0;

  const intel = { entities, relationships, temporalSignals, riskFlags };
  const situationSummary = hasSituation ? buildSituationSummary(intel) : null;

  return {
    ...intel,
    hasSituation,
    situationSummary,
  };
}
