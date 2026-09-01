# Advprev CRM

Internal management system for a Brazilian social security law firm, developed by David C Cavalcante under Takk Innovate Studio.

[![status: canary](https://img.shields.io/badge/status-canary-yellow)](./CHANGELOG.md)
[![license](https://img.shields.io/badge/license-Apache_2.0-blue.svg)](./LICENSE)
[![version](https://img.shields.io/badge/version-1.0.0--canary-blueviolet)](./CHANGELOG.md)
[![node](https://img.shields.io/badge/node-%E2%89%A522.13-success)]()
[![tests](https://img.shields.io/badge/tests-92%20passing-brightgreen)]()
[![pages](https://img.shields.io/badge/pages-18-blue)]()

## Status

Version `1.0.0-canary`, which is the version of everything this project declares about itself: the manifest, the body of the non-human entity, and every record the system writes. The office has a database, an authenticated door and no invented data. Measured on 2026-09-01: one hundred and forty nine TypeScript files and twenty seven thousand nine hundred and seventy eight lines under `src/`, eighteen pages, three route handlers, six server action modules, and the full gate green (`tsc` 0 errors, `biome check` 0 errors on 156 files, 92 tests passing, build producing 22 routes). Supabase carries the whole domain in South America, São Paulo, with fourteen tables, row level security on every one of them, twenty nine policies and two private buckets, versioned in `supabase/migrations/0001_initial_schema.sql`; the middleware refuses an unauthenticated browser before it reaches a query and the single account of the office signs in at `/entrar`. Every act of the office appends an immutable audit row and every reading of a document appends to its own trail. The intelligence layer is fully wired, all thirty one `@takk/*` and `@teleologyhi-sdk/*` packages are integrated, and the capture of publications runs as a durable execution against the official source, writing its result to the database. Every URL of the product is Brazilian Portuguese, served by rewrites over English route folders, with English page URLs redirecting to the pt-BR form. The entity reads the office and never the screen the lawyer is on: the assembled reading carries clients, cases, deadlines with their whole chain, tasks, appointments, reminders, documents with measured confidence, notices, captured communications and the rules of the office itself. A courtesy question opens no record, the reasoning of the model is bounded by configuration, and the median answer is about two seconds. The entity also researches the world outside the records in real time through Exa and Tavily, server-side, with minimized queries and cited sources, never as a deadline source. Production is live at `https://advprevcrm.tech`, published by the manual deploy workflow on this date, with the door proved through the public address: the root redirects a browser without a session, the sign in screen answers, and an interior URL redirects. The complete functional and technical specification lives in `INFO.md` (the product's normative document).

## What it is

Advprev CRM is not a generic commercial CRM. It is a legal operations system whose core entity is the case: one social security benefit pleaded by one client, traveling a mandatory track from the administrative phase before the INSS to the judicial phase. Documents, deadlines, tasks, expert examinations, hearings, publications, service notices, communications, and finance always exist bound to a case. A client with three pleaded benefits has three independent cases that never mix.

The system is for internal use by four teams (Administration, Intake, Lawyers, Finance), with access rules enforced in the database through row level security. It follows an IM-first posture: Massive Intelligence (IM) acts as a triage, extraction, analysis, and alert layer across the whole flow, always under human review and never as a decision maker, governed by the MAIC, HIM, and NHE three-layer architecture.

## Principles

- Governance by default: no access is open by default, and permissions live in the database.
- Full traceability: every relevant action generates an immutable audit event.
- IM assists, never decides: it never confirms a deadline, never closes a case, never sends external communication without recorded human approval.
- Official sources above all: every deadline, publication, and movement carries its official source, capture date, and preserved original text.
- No invented data: low-confidence extractions await human validation instead of assuming values.

## Planned stack

Next.js (App Router), TypeScript at maximum strictness, React, Tailwind CSS, Radix UI, Framer Motion, Zod, Biome, Supabase (database, auth, storage, row level security), the Anthropic API behind an internal abstraction, and the `@takk/*` and `@teleologyhi-sdk/*` ecosystems. Observability with Sentry. Production runs on a Hostinger VPS at https://advprevcrm.tech, deployed through the GitHub Actions gate and the manual deploy workflow.

## Documentation

| Document | Purpose |
|---|---|
| `INFO.md` | Complete functional and technical specification, the product law |
| `SYSTEM_OVERVIEW.md` | High-level architecture overview |
| `SPEC.md` | Contracts and data model, derived from `INFO.md` |
| `AUDIT.md` | Living audit of project decisions and findings |
| `TASK.md` | Task registry |
| `CHANGELOG.md` | Public change history |
| `PRIVACY.md` | Data protection baseline (LGPD) |
| `SECURITY.md` | Security policy and vulnerability reporting |

The method law of the office and its working memory are internal and are not published: the discipline and prohibitions the office works under, the playbook of the agent, and the state document that separates what was proved against live data from what was proved only by construction. They name the server, the monitored registration and the operating rules of a real law firm, so they stay with the office.

## Community & support

- **Issues & feature requests.** Open a GitHub issue at [`davccavalcante/advprevcrm-lpms/issues`](https://github.com/davccavalcante/advprevcrm-lpms/issues). For each report, include: the screen and its pt-BR URL, a minimal reproduction, expected vs. actual behaviour, and (if relevant) the audit event or capture run record that surfaces the bug. Never include a client's personal data, health document, or any sensitive record in an issue; this system serves a law firm and its data stays out of public spaces.
- **Security disclosures.** Do NOT open public issues for vulnerabilities. Follow the responsible-disclosure flow in [`SECURITY.md`](./SECURITY.md): encrypted contact via `davcavalcante@proton.me`.
- **Code of Conduct.** This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). Participation in any project space (issues, PRs, discussions) implies agreement.
- **Contributions.** All non-trivial contributions go through the Contributor License Agreement in [`CLA.md`](./CLA.md). Every PR must keep the full quality gate green: `tsc` with zero errors, `biome check` with zero errors, all Vitest tests passing, and a successful production build.
- **Direct dialogue.** For long-form questions on the Massive Intelligence (IM) governance, compliance architecture, or the legal-domain rules, the canonical channel is email to the author (`davcavalcante@proton.me`) or DM via [LinkedIn](https://www.linkedin.com/in/hellodav/).

## Author

Created by **David C Cavalcante** under **Takk Innovate Studio**: [davcavalcante@proton.me](mailto:davcavalcante@proton.me) (preferred) · [linkedin.com/in/hellodav](https://linkedin.com/in/hellodav) · [x.com/davccavalcante](https://x.com/davccavalcante) · [github.com/davccavalcante](https://github.com/davccavalcante) · [takk.ag](https://takk.ag/) · [say@takk.ag](mailto:say@takk.ag) (Takk relay).

## See also

- [TeleologyHI](https://github.com/davccavalcante/TeleologyHI), the Trinity that powers the Massive Intelligence (IM) layer of this system: [`@teleologyhi-sdk/maic`](https://www.npmjs.com/package/@teleologyhi-sdk/maic) · [`@teleologyhi-sdk/him`](https://www.npmjs.com/package/@teleologyhi-sdk/him) · [`@teleologyhi-sdk/nhe`](https://www.npmjs.com/package/@teleologyhi-sdk/nhe).
- The author's research papers: [The Soul of the Machine](https://philarchive.org/rec/CRTTSO) · [Beyond Consciousness in LLMs](https://philarchive.org/rec/CRTBCI) · [The Cave of Silence](https://philarchive.org/rec/CRTTCO).
- Hugging Face organization: [TeleologyHI](https://huggingface.co/TeleologyHI).
- GitHub: [davccavalcante](https://github.com/davccavalcante) / [Takk8IS](https://github.com/Takk8IS).

## Sponsors

Join us on our journey as we continue to innovate and create groundbreaking solutions. Your support is the cornerstone of our success!

Support us with USDT (TRC-20): `TS1vuhMAhFpbd7y68cu5ZtP9PsXVmZWmeh`

Sponsor on GitHub: [Sponsor](https://github.com/sponsors/davccavalcante)

## License

Code in this project is licensed under the **Apache License 2.0** (see [`LICENSE`](./LICENSE)). You may use, modify, and distribute the code under the terms of that licence, including the patent grant and attribution requirements it carries. Attribution lives in [`NOTICE`](./NOTICE).

The marks **MAIC™**, **HIM™**, **NHE™**, **TeleologyHI™**, and **Takk™** are trademarks of **David C Cavalcante**. The Apache 2.0 licence covers the code; it does NOT extend to the marks. Forks, derivatives, and commercial uses that involve any of these marks require a separate written licence; see [`TRADEMARK.md`](./TRADEMARK.md) for the full policy.

**MAIC™** is a systemic governance framework designed to coordinate, supervise, and govern large-scale Massive Intelligence (IM) ecosystems. It provides global context awareness, alignment, and orchestration across multiple models, agents, and decision layers, ensuring coherence, risk control, and compliance throughout complex IM operations.

**HIM™ (Hybrid Intelligence Model)** is a hybrid intelligence layer that integrates model reasoning with human-defined logic, rules, heuristics, and strategic intent. HIM™ functions as a passive cognitive core, responsible for interpreting objectives, refining intent, and structuring decision-making processes before and after model execution.

**NHE™ (Non-Human Entity)** refers to a non-human cognitive entity with a defined functional identity and operational agency within an IM ecosystem. An NHE™ is not classified as a bare model in isolation, but as an autonomous or semi-autonomous entity that operates through coordinated intelligence layers, interacting with systems, users, and environments while maintaining a non-anthropomorphic identity.
