# System Overview

High-level architecture view of Advprev CRM, derived from `INFO.md` version 1.0.0-canary. On divergence, `INFO.md` prevails.

## Purpose

Internal legal operations system for a social security law firm. The core entity is the case, one pleaded benefit per client, moving through a mandatory sequential track: triage, intake and qualification, documentary instruction, administrative phase before the INSS, administrative decision, administrative appeal when applicable, judicial phase, judicial instruction, judgment, judicial appeal when applicable, enforcement, and closure. Phase transitions are gated: each gate requires the mandatory artifacts of its step, and a lawyer may release a gate only with a recorded justification.

## Teams and access

Four teams operate the system: Administration (global), Intake (no finance access), Lawyers (own cases only, own hours, own financial share), Finance (all financial data, minimal case registry data, no health documents or sensitive data). Access rules are enforced in the database with row level security; the interface only reflects them. Nothing is open by default. The full access matrix lives in `SPEC.md`.

## Application layers

- Presentation: screens and components for the four team surfaces, interface entirely in pt-BR.
- Application: use cases and flow rules.
- Domain: entities and legal business rules, including deadline calculation, phase gates, access policies, and financial apportionment. This layer receives the most rigorous testing.
- Infrastructure: Supabase (database, auth, storage), file handling, and external integrations.

Every input, from forms, files, or integrations, is validated by a Zod schema before acceptance.

## Massive Intelligence (IM) layer

Three levels govern every assisted operation. MAIC is applied governance: executed policy defining what is allowed, what requires human review, and what is forbidden. HIM is the reasoning level: it analyzes, classifies, summarizes, and proposes. NHE is the agent level: it executes concrete tasks (triage a message, extract document fields, prepare a draft, issue an alert) within MAIC limits. NHE tools are read-only over the domain except four authorized writes: create a draft, record a suggestion, generate an alert, open a task.

The compliance module provides case viability analysis, documentary gap alerts, forfeiture and limitation risk alerts, conflict of interest verification, critical deadline alerts, and a chat anchored in case data that cites its sources and never issues conclusive legal opinions. Every IM output is marked as assisted, with model, date, time, and user, and every interaction is logged. Direct identifiers are minimized before any content reaches the external intelligence service (the provider interfaces behind an internal abstraction).

The reasoning substrate is a transport, not a single provider: per-provider key pools with rotation and isolation of refused keys, one routing circuit per model with retry and money ceiling, and a calibrated posterior of quality, latency and cost per model that observes every outcome and never reorders, because the order between providers is the director's decision (Gemini by default, Claude automatically when no Gemini key works). Around every exchange runs an observation deck: two deterministic gates, agent identity and configured money ceilings, and advisory-only measurement of inspection, behavioural drift, regime changes, tracing, lexical grounding, calibrated output quality, working memory, a bitemporal fact graph, deterministic recording, task classification and prompt-cache discipline, all surfaced to Administration on the settings screen. A second reading, requested by Administration one click at a time, reviews the form of the last delivered answer through an independent transport, deterministic evaluators, a grader consensus and a standing rubric experiment; it never verifies facts against the records and never decides. When a question asks for the world outside the records, the server searches Exa and Tavily in parallel with the query minimized of direct identifiers, and the results enter the governed context with mandatory citation of title, address and date, never as a deadline source.

## Deadlines

Deadlines exist in two states, `calculated` and `confirmed`. The system computes due dates in business days per articles 219, 224, and 220 of the Code of Civil Procedure, including the December 20 to January 20 suspension, electronic service publication rules, and the distinct administrative regime. Holiday calendars are maintained per court with audited manual adjustments. Only a lawyer's explicit action confirms a deadline; the screen states that the calculation is support and professional responsibility remains with the lawyer.

## External integrations

- DataJud (CNJ public API): procedural metadata and movements, per-court endpoints, public key auth. Not real-time, used for tracking only, never as a deadline source.
- DJEN (`comunica.pje.jus.br`): official publications and service notices, queried daily by OAB registration and case number. Deadlines originate here, with full text preserved.

All captures run as scheduled jobs with execution records, progressive-backoff retries, deduplication memory, and a health panel that surfaces unavailability the same day.

## Documents

Clients send documents by email, message, or secure upload link (channel pending the director's confirmation); Intake also uploads directly. Files pass through OCR and structured extraction; every extracted field carries a confidence index, and below-threshold fields await human validation before any use. Originals stay accessible next to extracted data. Every read and download is audited; health documents are segregated from the finance team.

## Finance

Per-case fee contracts (contractual percentage, fixed fees, loss-of-suit fees), per-lawyer apportionment, receivables, small-value payment orders and court-ordered payments, and payouts. Each lawyer sees only their own share; Finance and Administration see the consolidated view.

## Environments, quality, and observability

Three environments with independent databases and keys: development, staging, production. Publication through GitHub Actions running the full quality gate (types, lint, tests, build), stopping at the first error, targeting a Hostinger VPS. Deploy only by the director's explicit decision. Error monitoring with Sentry (personal data scrubbed), structured logs for scheduled jobs, and an integration health panel.

## Implementation phases

1. Foundation: auth, teams, profiles, database access policies, audit trail, client, case, benefit type.
2. Case operation: administrative and judicial phases, gates, agenda, deadline calculator, examinations and hearings.
3. Documents: upload, storage, OCR, structured extraction, human validation, audited access.
4. Official integrations: movement and service-notice capture, automatic deadline generation, health panel.
5. Work and productivity: Kanban with phases and cycles, tasks, communications, message templates.
6. Finance: contracts, fees, apportionment, receivables, payment orders, payouts.
7. Intelligence and compliance: assisted triage, risk analysis, case-anchored chat, governance panel.
8. Refinement: per-profile dashboards, reports, performance.
