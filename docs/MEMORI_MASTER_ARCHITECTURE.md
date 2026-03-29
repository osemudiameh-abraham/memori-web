# MEMORI MASTER ARCHITECTURE

## 1. PRODUCT DEFINITION
Memori is a cognitive continuity system.
It remembers, understands, and builds on a user’s identity over time.

## 2. CORE THESIS
- Memory is infrastructure, not a feature
- Identity compounds over time
- Governance (auditability, control) is required for trust
- Memori is not a chatbot, it is a system that knows you

## 3. MVP SCOPE
Current product:
- persistent memory across sessions
- identity summary
- canonical facts system
- memory vault
- fact audit
- trace audit
- onboarding
- chat with recall
- reviews system (decision tracking)

## 4. CURRENT BUILD STATE
Already working:
- authentication (Supabase)
- chat system (API + UI)
- memory extraction (tier 1, 2, 3)
- canonical facts layer
- contradiction + supersession handling
- identity summary generation
- onboarding flow
- memory vault UI
- fact audit system
- trace audit system
- reviews system
- proactive review banner (partially)

## 5. MEMORY SYSTEM
- Tier 1: heuristic detection
- Tier 2: regex extraction
- Tier 3: LLM fallback

Canonical facts:
- stored in memory_facts
- evidence linked via memory_fact_evidence
- raw facts stored in memories_structured

## 6. GOVERNANCE SYSTEM
- Vault (user-visible memory control)
- Fact audit (canonical truth tracking)
- Trace audit (decision + reasoning visibility)
- Status types:
  - active
  - superseded
  - historical
  - disputed

## 7. DECISION INTELLIGENCE
- decisions are stored
- reviews are triggered
- outcomes tracked over time

## 8. DIGEST / RETENTION
- weekly digest (planned / partial)
- reminders and proactive signals

## 9. FRONTEND SYSTEM
Pages:
- /
- /onboarding
- /vault
- /facts
- /trace
- /reviews

## 10. BACKEND SYSTEM
- Next.js App Router
- Supabase (auth + database)
- API routes under /app/api/*
- OpenAI for LLM
- memory store + search logic in /lib

## 11. FUTURE LAYERS
- proactive intelligence
- pattern detection
- agentic execution
- integrations (email, calendar)
- voice
- continuity mode

## 12. NON-NEGOTIABLE RULES
- full files only
- no snippets
- no architecture drift
- preserve working systems
- step-by-step only
- TypeScript must pass before moving on
- every change must be safe and reversible
