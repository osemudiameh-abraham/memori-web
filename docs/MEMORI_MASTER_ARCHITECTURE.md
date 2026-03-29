# MEMORI MASTER ARCHITECTURE

Unified Master Architecture  
Post-Laptop Recovery Edition  
Single Source of Truth for Build Continuity

---

## 1. PRODUCT DEFINITION

Memori is a cognitive continuity system.

It is the system that actually knows you, remembers your life and decisions, and helps you make better decisions over time.

Near-term, Memori ships as:
- the AI that actually knows you
- persistent memory across sessions
- identity-aware recall
- user-visible memory control
- decision capture and review
- governance surfaces that explain what the system knows and why it responded the way it did

Long-term, Memori becomes:
- a governance-first system that records, understands, and extends human identity across time
- an identity-aware cognitive layer that compounds in usefulness as memory, context, and pattern understanding deepen

Memori is not:
- a generic chatbot
- a note app
- a journal
- a productivity tool
- a wrapper around a foundation model

---

## 2. CORE THESIS

### 2.1 The Category

Every major assistant before Memori resets when the session ends.
Memori does not reset. It accumulates.

That is the category shift:
- from stateless assistant
- to cognitive continuity system

### 2.2 The Product Wedge

The memory engine is infrastructure.
The product is the feeling that Memori actually knows the user.

The core user-facing promise is:

- I can tell Memori things once
- it remembers them later
- it answers from my real history
- it gets more useful the longer I use it

### 2.3 The Governance Thesis

Trust is not optional.
Memori must make memory visible, editable, disputable, restorable, and traceable.

Governance is not an add-on.
Governance is product architecture.

### 2.4 The Compounding Thesis

Most AI products decay in value after the first few uses.
Memori compounds because:
- memory accumulates
- identity context deepens
- decisions create review loops
- outcomes improve future advice
- the system becomes more grounded in the user over time

---

## 3. DESTROYED-LAPTOP RECOVERY CONTEXT

This architecture file exists in the context of a continuity recovery event.

The original laptop was destroyed by liquid damage.
The Memori codebase, architectural decisions, and build state were then restored on a new machine.

This project is continuing from the real recovered build state.
It is not restarting from zero.

Rules created by that recovery event:
- GitHub is the permanent continuity layer
- every stable milestone must be committed and pushed
- the repo is the implementation truth
- this file is the strategic design truth
- future assistants must continue from the recovered state, not invent a new one

---

## 4. CURRENT BUILD STATE

The current recovered codebase already contains a real working MVP core.

### 4.1 Working Systems

The following are already built and working or substantially working:

- Supabase authentication
- login flow
- home page chat UI
- request-id based chat deduplication
- three-tier fact extraction
  - Tier 1 heuristic gate
  - Tier 2 regex extraction
  - Tier 3 LLM fallback
- canonical facts storage and retrieval
- memory fact evidence linking
- contradiction handling
- supersession handling
- deterministic direct-answer recall from canonical facts
- identity context loading
- identity summary route and home card
- onboarding flow
- memory vault
- facts audit
- trace audit
- reviews system
- review due-count and first-due routes
- proactive review banner
- partial digest and reminder functionality
- stable TypeScript compile

### 4.2 Recent Verified Fixes

The recovered build has already been improved with:
- fix for stale home-page review-banner state
- fix for Tier 3 extracted fact persistence in chat

### 4.3 Current Product Readiness

Memori already demonstrates the core user-facing category moment:
- tell it facts
- return later
- it remembers
- it can summarize what it knows
- it can show and govern stored knowledge

That is the current MVP core.

---

## 5. MVP SCOPE (CURRENT SHIPPING PRODUCT)

The current shipping wedge is not the entire long-term system.

It is the smallest product that proves the category.

### 5.1 In-Scope MVP Experience

The MVP includes:
- persistent memory across sessions
- identity summary
- guided onboarding
- canonical facts
- fact recall
- memory vault
- facts audit
- trace audit
- decision capture
- reviews
- proactive review surface
- digest / retention scaffolding

### 5.2 MVP User Story

A user should be able to:
1. sign in
2. tell Memori key facts
3. ask later what Memori knows
4. get correct answers from memory
5. inspect and govern what Memori knows
6. log decisions
7. review outcomes later
8. trust that the system is not hiding its reasoning

### 5.3 MVP Demo Moment

The strongest demo sequence is:
- seed a few personal facts
- close the app
- return later
- ask “what do you know about me?”
- ask a direct recall question
- show the Memory Vault
- show the Facts Audit
- show the Trace surface
- show a logged decision / review loop

That sequence is the category proof.

---

## 6. MEMORY SYSTEM

The memory system is the foundation of Memori’s technical differentiation.

It is not one table and one retrieval call.
It is a layered system that separates:
- raw memory substrate
- canonical truth
- evidence
- retrieval scoring
- deterministic recall
- LLM-grounded context

### 6.1 Three-Tier Extraction

Every user message passes through three tiers.

#### Tier 1 — Heuristic Gate
Purpose:
- cheaply detect whether the message may contain stable facts

Properties:
- local only
- zero API cost
- high privacy
- blocks low-signal messages immediately

#### Tier 2 — Regex Extraction
Purpose:
- capture explicit structured fact patterns deterministically

Examples:
- my name is X
- I work at X
- I live in X
- my dog’s name is X
- James is my colleague
- James runs finance

Properties:
- local only
- zero API cost
- high precision

#### Tier 3 — LLM Fallback
Purpose:
- extract stable facts from less structured natural language

Properties:
- only runs when Tier 1 passes and Tier 2 yields nothing
- uses message text only
- no full history required for extraction
- used for complex or conversational phrasings

Tier 3 must not be a no-op.
If it extracts a valid fact, that fact must persist.

### 6.2 Raw Memory Substrate

Raw evidence is stored in `memories_structured`.

This is the substrate for:
- notes
- fact evidence
- decisions
- outcomes
- voice-derived content
- other raw memory entries

Key principles:
- user-scoped
- timestamped
- importance + certainty tracked
- recall telemetry tracked
- archivable
- not the same as canonical truth

### 6.3 Canonical Facts Layer

Canonical facts are stored separately from raw memory.

Core tables:
- `memory_facts`
- `memory_fact_evidence`

This layer is the truth system for stable recall.

Benefits:
- deduplicated truth
- contradiction handling
- deterministic direct answers
- evidence traceability
- user governance at fact level

### 6.4 Evidence Linking

Every canonical fact should be traceable back to raw evidence in the substrate.

This is why `memory_fact_evidence` matters:
- it shows where a fact came from
- it supports audit
- it supports trust
- it supports later correction and dispute workflows

### 6.5 Contradiction / Supersession

When a new fact conflicts with an existing active fact:
- do not silently overwrite
- mark the old fact as superseded
- preserve history
- set the new fact active

This ensures:
- current truth is clear
- historical truth is not lost
- user can inspect the change

### 6.6 Deterministic Direct Fact Answers

For trust-sensitive recall queries, Memori should answer directly from canonical facts before using the LLM.

Examples:
- what’s my name
- where do I work
- where do I live
- what’s my timezone
- who is James
- what’s my dog’s name

This avoids:
- hallucination
- fuzzy recall
- unnecessary model calls

### 6.7 Memory Injection

Canonical user facts belong in the system prompt / grounding layer, not appended to the user message.

This is a critical architectural rule.

Correct:
- facts injected into the system prompt

Wrong:
- facts mixed into the current user message

Reason:
- facts must be treated as authoritative grounding context
- user input must remain the current request, not a mixed memory payload

---

## 7. GOVERNANCE SYSTEM

Governance is foundational to Memori.

The user must always be able to see:
- what Memori knows
- what status that knowledge has
- where it came from
- why a response happened

### 7.1 Memory Vault (`/vault`)

The Memory Vault is the user-facing control surface for stored knowledge.

It should expose:
- Active facts
- Disputed facts
- Historical facts
- Superseded facts

Available actions should include:
- mark disputed
- mark historical
- restore active
- inspect evidence
- inspect audit details

### 7.2 Facts Audit (`/facts`)

The Facts Audit is the engineering-grade surface for canonical truth inspection.

It should expose:
- extracted facts
- fact status
- confidence
- evidence links
- supersession relationships
- traceability for each canonical fact

### 7.3 Trace Audit (`/trace`)

Every response should be traceable.

The Trace surface must explain:
- what the user asked
- what the assistant answered
- which memories were selected
- what strategy steps happened
- which canonical facts influenced the response

This is Memori’s answer to:
“Why did you say that?”

### 7.4 Governance Status Model

Canonical fact statuses include:
- active
- superseded
- historical
- disputed

Each status has a real product meaning and must be preserved consistently across UI and API.

---

## 8. DECISION INTELLIGENCE

Memori is not only about static recall.
It is also about helping users close loops on decisions over time.

### 8.1 Decision Capture

A decision stated in chat should be captured as a decision object with:
- text snapshot
- expected outcome if available
- review due date
- user ownership
- traceability

### 8.2 Review Loop

The value of decision intelligence is the loop:

decision logged → review scheduled → outcome recorded → later pattern detection

Memori should not let important decisions disappear after they are made.

### 8.3 Reviews Surface (`/reviews`)

The reviews system exists so users can:
- revisit prior decisions
- record outcomes
- update future review cadence
- build accountability over time

### 8.4 Outcomes

Outcomes are not just notes.
They are the learning signal that eventually powers:
- pattern detection
- better warnings
- better advice
- improved self-understanding

---

## 9. IDENTITY SYSTEM

Identity in Memori is not only a profile form.

It is built from:
- onboarding
- canonical facts
- repeated memory evidence
- future behavioral patterns
- future communication style extraction

### 9.1 Identity Context

Current identity context already includes:
- display name
- self name
- company
- role
- city
- timezone
- other canonical facts as available

### 9.2 Identity Summary

The identity summary is one of the strongest product moments.

It answers:
- what Memori knows about the user
- whether memory is actually working
- whether the system feels coherent

It should remain:
- clear
- concise
- grounded in canonical facts
- free from governance/debug noise in the user-facing version

---

## 10. CURRENT FRONTEND SYSTEM

Current real pages include:

- `/` — home page / chat / summary / review banner / reminder surface
- `/login` — authentication
- `/onboarding` — guided memory seeding
- `/vault` — user-facing memory control
- `/facts` — canonical facts audit
- `/trace` — response trace audit
- `/reviews` — decision review loop
- `/digest` — digest surface (partial / in progress)

### 10.1 Current Home Page Role

The home page is currently the central operating surface.

It should continue to expose:
- auth state
- identity summary
- review banner
- proactive reminder surface
- chat
- navigation to governance surfaces

---

## 11. CURRENT BACKEND SYSTEM

Current backend stack:
- Next.js App Router
- TypeScript
- Supabase
- OpenAI
- server route handlers under `app/api/*`
- domain logic in `lib/*`

### 11.1 Key Current Backend Domains

- `lib/memory/*`
- `lib/identity/*`
- `lib/preprocessing/*`
- `lib/model-client/*`
- `lib/cognition/*`
- `lib/supabase/*`

### 11.2 Current Routing Surfaces

Current API routes include, at minimum, the following kinds of surfaces:
- chat
- identity summary
- onboarding
- facts
- facts status update
- reviews
- reminders
- digest
- trace

---

## 12. CURRENT PHASE POSITION

Memori’s codebase is no longer at the earliest cleanup stage.

The recovered codebase is effectively in:
- late memory / canonical-facts restoration
- early product polish / retention / governance completion

In practical terms, the restored build is around:
- late Phase 2D / early Phase 2E in the recovered project sequence

That means:
- memory core is real
- canonical fact architecture is real
- governance surfaces are real
- onboarding exists
- vault exists
- reviews exist
- retention surfaces are partial
- broader pattern intelligence, full situation intelligence, and premium UX are not yet finished

---

## 13. NEXT BUILD PRIORITIES

The next steps must continue from the current stable state, not from the abstract roadmap.

Priority order:

1. preserve current stability
2. preserve current governance
3. continue tightening retention/product surfaces
4. continue improving correctness and polish
5. only then deepen future layers

### 13.1 Immediate Safe Priorities

Safe near-term work includes:
- strengthening digest / retention surface
- reminder correctness
- UX cleanup on existing pages
- better architecture docs and assistant alignment
- safe polish around reviews / vault / summary
- rate limiting / cost controls / production hardening
- billing scaffolding later when product timing is right

### 13.2 What Not to Build Prematurely

Do not jump ahead casually into:
- full governed execution
- deep ambient capture
- browser extension
- health monitoring
- continuity mode
- full identity simulation
- native app expansion
- broad enterprise systems

These belong to later architecture layers, not immediate MVP continuation.

---

## 14. FUTURE LAYERS (ARCHITECTED, NOT YET FULLY BUILT)

The long-term architecture remains intact.

These layers are real and should stay in the design truth, but they should not be mistaken for the next implementation step.

### 14.1 Behavioral Intelligence
Future system should detect:
- repeated mistakes
- success patterns
- decision tendencies
- context-dependent behavior shifts

### 14.2 Situation Intelligence
Future system should:
- understand narrated situations as coherent wholes
- extract entities, timelines, relationships, risks, and embedded decisions
- retrieve similar past situations
- support more advisor-like responses

### 14.3 Voice Layer
Future voice stack includes:
- streaming STT
- better turn-taking
- barge-in
- wake word
- self-repair detection
- stronger VoiceOrb statefulness

### 14.4 Notifications / Retention
Future retention stack includes:
- in-app reminders
- weekly digest
- email reminders
- push reminders
- user-configurable cadence and timezone logic

### 14.5 Integrations
Future integrations may include:
- email
- calendar
- documents
- uploaded files
- later health stubs
- later broader multimodal context

### 14.6 Governed Execution Layer
A later layer may allow Memori to execute tasks across tools under strict consent, traceability, and approval rules.

This is architected, but should not prematurely distort current product priorities.

### 14.7 Continuity Mode
Long-term continuity and post-absence / post-life representation remains part of the vision, but only under strict legal, ethical, and consent frameworks.

---

## 15. TECH STACK (CURRENT + INTENDED)

### 15.1 Current Core Stack
- Next.js App Router
- TypeScript
- Supabase
- OpenAI
- pnpm
- GitHub
- Vercel-style deployment pattern

### 15.2 Intended Expansion Stack
As Memori deepens, the architecture may expand into:
- Deepgram for streaming STT
- ElevenLabs / OpenAI TTS for voice output
- Resend for email
- web-push for browser push
- pgvector for deeper semantic retrieval
- background jobs / cron for retention loops
- richer ingestion pipelines later

Current implementation work should remain grounded in what is already real in the repo.

---

## 16. NON-NEGOTIABLE ENGINEERING RULES

These rules govern all future implementation work.

1. Full files only
2. No snippets
3. TypeScript must pass before moving on
4. Never break working behavior
5. Never assume files exist
6. Ask for the exact file if needed
7. One safe step at a time
8. Every stable checkpoint must be committed and pushed
9. No architecture drift
10. No phase mixing without explicit instruction
11. Preserve auth, chat, memory, vault, facts, trace, reviews, and identity summary
12. Continue from recovered state, not from a blank slate

---

## 17. WORKING METHOD FOR FUTURE ASSISTANTS

Any engineering assistant continuing this build must:

1. read this file first
2. inspect the actual repo state
3. identify what is already working
4. identify the next safest step
5. ask for exact files if needed
6. return full file contents only
7. require `pnpm exec tsc --noEmit --pretty false`
8. require browser/runtime verification where relevant
9. require commit and push after each stable checkpoint

The correct build loop is:

inspect → plan → edit → compile → test → commit → push

That loop must not be broken.

---

## 18. THE ONE-LINE SUMMARY

Memori is the AI that actually knows you.

Underneath that simple product truth is a governance-first cognitive continuity architecture built to preserve context, improve decisions, and compound in value over time.