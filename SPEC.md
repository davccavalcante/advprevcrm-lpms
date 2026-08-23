# SPEC

Contracts and data model of Advprev CRM, derived from `INFO.md` version 1.0.0-canary. Status: draft awaiting the director's validation; the open points of `INFO.md` section 14 gate closure. On divergence, `INFO.md` prevails.

## Identifier policy

ULID for time-ordered records (audit events, movements, publications, communications, tasks). UUID where ordering must not leak information (clients, cases, documents, financial records). Every identifier, field, type, event, and route is named in English.

## Domain entities

- Client: natural person as a rule. Civil data, CPF, NIT or PIS, identity document, parentage, address, contacts, bank data for receipt, vulnerability situation when applicable, and link to one or more cases.
- Benefit type: controlled catalog, including urban and rural age retirement, contribution time retirement and transition rules, special retirement, permanent disability retirement, temporary disability benefit, accident allowance, death pension, maternity pay, BPC or LOAS, and revisions.
- Case: central entity. Binds client, benefit type, responsible lawyer, team, current phase, situation, opening date, and full history. One client with three pleaded benefits has three independent cases with their own deadlines, documents, and finance.
- Administrative procedure: benefit number, request entry date, protocol, INSS demands with their own deadlines, administrative expert examination, granting or denial decision with grounds, and appeal to the Social Security Appeals Council when applicable.
- Judicial process: CNJ-standard number, court, judicial unit, class, subjects, claim value, distribution date, parties, and link to the administrative procedure that originated it.
- Movement: each tracked step captured from the official source, with code, description, date, and origin.
- Publication or service notice: full captured text, availability date, publication date, linked process, and the deadline it triggers.
- Deadline: type, base date, day count, counting regime, calculated due date, responsible person, state, and link to the publication or act that originated it. States: `calculated`, `confirmed`. Transition only by a lawyer's explicit action, recorded in audit.
- Expert examination and hearing: date, time, place or link, type, designated professional, situation, client guidance, and result.
- Task: description, assignee, priority, board column, sprint, internal due date, dependencies, and checklist.
- Document: original file, documentary type, OCR situation, extracted text, structured extracted fields, confidence index, human validation, upload author, and access history.
- Communication: channel, direction, content, attachments, author, date, and case link.
- Finance: case fee contract, contractual percentage, loss-of-suit fees, per-lawyer share percentage, entries, receivables, small-value payment order or court-ordered payment, and payouts.
- Time record: lawyer, case, activity, time, and date.
- Audit event: author, action, affected entity, values before and after, date, time, and origin. Immutable.
- Account profile: first name, last name, electronic address, password stored only as a salted hash, photo, and an append-only change log with author, moment and values before and after. Editable on the settings screen by the account itself; role and team belong to Administration.

## Access matrix

| Module | Administration | Intake | Lawyer | Finance |
|---|---|---|---|---|
| Clients, registry | full | full | read own cases | minimal read |
| Cases and benefits | full | create and read | full on own cases | minimal read |
| Documents and OCR | full | upload and read | full on own cases | no access |
| Sensitive health documents | full | read only as needed | full on own cases | no access |
| Deadlines, examinations, hearings | full | read | full on own cases | no access |
| Publications and service notices | full | read | full on own cases | no access |
| Kanban and tasks | full | own team | own cases | no access |
| Communications | full | full | own cases | no access |
| Global finance | full | no access | own share only | full |
| Compliance and IM | full | limited consult | consult on own cases | financial risk consult |
| Audit trail | full | no access | no access | no access |

Enforcement is two-layered: the interface shows only what the profile can operate, and row level security in the database guarantees that even direct API access cannot cross profile boundaries. The database rule is the rule.

## Deadline counting rules

- Procedural deadlines: business days per article 219 of the Code of Civil Procedure; exclude the start day and include the due day per article 224; roll the due date forward to the next business day; suspend counting from December 20 to January 20 per article 220.
- Electronic service: the publication date is the first business day after availability; counting starts on the first business day after publication.
- Administrative deadlines: each demand or appeal type applies its own regime, distinct from the procedural one.
- Calendars: national, state, and municipal holidays plus court-specific suspensions, maintained per court as records with audited manual adjustment. Never hardcoded.
- Forfeiture and limitation deadlines of Law 8,213 feed risk alerts.
- Jurisdiction determination: Federal Small Claims Court up to the legal cap, ordinary Federal Justice above it, State Justice in delegated jurisdiction and accident claims against the INSS (Precedent 15, Superior Court of Justice). Caps are queries with source and date, never constants.

## Phase gates

The macro track is sequential: triage, intake and qualification, documentary instruction, administrative phase, administrative decision, administrative appeal when applicable, judicial phase, judicial instruction, judgment, judicial appeal when applicable, enforcement and execution, closure. Each transition requires the mandatory artifacts of its step; the system blocks advancement while requirements are missing and shows exactly what is missing. The judicial phase gate requires proof of the prior administrative request and its decision, or an expressly justified exemption (Extraordinary Appeal 631.240, Supreme Federal Court). A lawyer may release any gate with a recorded justification; silent release does not exist.

## Integration contracts

- DataJud (CNJ): query by case number and court; receives class, subjects, adjudicating body, filing date, movements. Per-court endpoints, public key auth. Not real-time; never a deadline source. Planned coverage: Federal Justice, State Justice, and Labor Justice as confirmed by real need.
- DJEN (`https://comunica.pje.jus.br/api`): daily query by OAB registration and state, and by case number. Each communication is stored with full text, linked to process and lawyer, and generates its deadline in the `calculated` state.
- Resilience: scheduled jobs with execution, attempt, and result records; progressive-backoff retries; deduplication memory; health panel exposing unavailability the same day.

## Audit event minimum coverage

Client and case creation and change, phase change, deadline creation and change, deadline confirmation, document upload, read, and download, permission change, financial data change, and every IM interaction. The trail is admin-only, not editable, not deletable by the application.

## Open points blocking spec closure (INFO.md section 14)

End-client intake channel (14.1), Administrative category contents (14.2), Judicial subcategories (14.3), labor sphere use (14.4), existing data migration (14.5), operation volume (14.6), database hosting and region (14.7), document signature (14.8), messaging integration (14.9), data protection officer and privacy policy (14.10), current code state confirmed on 2026-08-09 as nonexistent in this repository (14.11).
