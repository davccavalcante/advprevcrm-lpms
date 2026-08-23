# Social Security Legal CRM
## Functional and Technical Specification

Document of scope, architecture, and operation of the system.
Version 1.0.0-canary

Translated from the director's original Portuguese specification on 2026-08-12, under the director's order that the whole project be in English except the product interface and `PREAMBLE.md`. The content is unchanged: this is a translation, not a revision. On product matters this document remains the law of the project.

---

## 1. Executive summary

This document describes, end to end, how the Social Security Legal CRM will work: who uses it, what each profile sees, how a client's case travels through the system from the first email to the receipt of fees, which data is stored, how the official integrations work, and what the real technical and legal limits of each part are.

The system is for internal use by the firm, with governance by teams, access control at the data row level, and an IM-first posture, meaning that Massive Intelligence acts as a support, triage, and analysis layer across the whole flow, always under human review and never as a decision maker.

The core of the system is the concept of the **case**. A client may have several cases, and each case corresponds to a specific social security benefit, which travels a mandatory track between the administrative phase and the judicial phase. Everything else in the system (documents, deadlines, tasks, expert examinations, hearings, publications, communications, and finance) is organised around the case.

---

## 2. Scope

### 2.1 In scope

Management of clients and of cases by benefit. Administrative phase before the INSS and judicial phase. Document management with optical character recognition and structured extraction. Deadlines calculated in business days. Expert examinations and hearings. Automatic capture of publications and service notices. Automatic tracking of procedural movements. Work Kanban per case. Recorded communications. Finance with fees and per-lawyer share. Dashboard per profile. Compliance and risk analysis module. Complete audit trail.

### 2.2 Out of scope in this phase

Automated electronic filing in the court systems, for the technical reason explained in section 8.4. Digital signature with an ICP-Brasil certificate, if it is not confirmed in section 14. Tax accounting of the firm. Invoice issuance. End-client self-service portal, if it is confirmed that there will be none, per section 14.

---

## 3. Principles of the system

**Governance by default.** No access is open by default. Every profile receives the minimum necessary for its work, and the permission is enforced in the database, not only in the interface.

**Full traceability.** Every creation, change, read of a sensitive document, download, and recorded decision generates an audit event with author, date, time, and origin.

**IM as support, never as decision maker.** Massive Intelligence classifies, extracts, summarises, suggests, and alerts. It never closes a case, never sets a deadline as final without confirmation, and never produces external communication without a lawyer's review. Every IM output is marked as such in the case record.

**Official source above all.** A deadline, a publication, and a procedural movement always have a recorded official origin. The system shows the source, the capture date, and the original text.

**No invented data.** When an automatic extraction has low confidence, the system marks it as pending human validation instead of assuming the value.

---

## 4. Profiles, teams, and access control

### 4.1 Teams

**General Administration.** Global view of the system, management of users, teams, permissions, catalogs, and parameters. Access to every module.

**Intake.** Reception and triage, client registration and qualification, case opening, document collection and review, communication logging. Does not access the finance module.

**Lawyers.** Conduct of the cases under their responsibility, including administrative and judicial proceedings, deadlines, expert examinations, hearings, documents, and pleadings. Each lawyer sees their own cases, their own hours, and their own financial share, and does not see the financial share of the others.

**Finance.** Fee contracts, receivables, payouts, per-lawyer share, and reports. Sees the financial data of every case and the minimal registry data of the case, without access to medical documents and other sensitive data, by application of the minimization principle.

### 4.2 Summarised access matrix

| Module | Administration | Intake | Lawyer | Finance |
|---|---|---|---|---|
| Clients, registry | full | full | read of their own cases | minimal read |
| Cases and benefits | full | create and read | full on their own cases | minimal read |
| Documents and OCR | full | upload and read | full on their own cases | no access |
| Sensitive health documents | full | read only what is necessary | full on their own cases | no access |
| Deadlines, examinations, hearings | full | read | full on their own cases | no access |
| Publications and service notices | full | read | full on their own cases | no access |
| Kanban and tasks | full | their team | their cases | no access |
| Communications | full | full | their cases | no access |
| Global finance | full | no access | only their own share | full |
| Compliance and IM | full | limited query | query on their own cases | financial risk query |
| Audit | full | no access | no access | no access |

### 4.3 How the permission is enforced technically

The control is done in two layers. In the interface, the user only sees what they may operate. In the database, the row level security policy guarantees that, even through direct API access, one lawyer cannot read another lawyer's case. The business rule of permission lives in the database, and the interface only reflects that rule. That is what prevents a leak caused by a screen error.

---

## 5. Domain model

The main entities and what each one holds.

**Client.** A natural person as a rule. Civil data, CPF, NIT or PIS, identity document, parentage, address, contacts, bank details for receipt, situation of vulnerability when applicable, and the bond with one or more cases.

**Benefit type.** Controlled catalog, including urban and rural age retirement, retirement by contribution time and transition rules, special retirement, retirement due to permanent incapacity, allowance due to temporary incapacity, accident allowance, death pension, maternity pay, BPC or LOAS (continuous cash benefit), and revisions.

**Case.** The central entity. It binds client, benefit type, responsible lawyer, team, current phase, situation, opening date, and complete history. A client with three pleaded benefits has three independent cases, with their own deadlines, documents, and finance.

**Administrative procedure.** Benefit number, date of entry of the request, protocol, requirements issued by the INSS and their deadlines, administrative expert examination, decision of grant or denial with its grounds, and appeal to the Social Security Appeals Council when there is one.

**Judicial proceeding.** Number in the CNJ standard, court, chamber or small claims court, class, subjects, claim value, distribution date, parties, and the bond with the administrative procedure that originated it.

**Movement.** Each step captured from the official source, with code, description, date, and origin.

**Publication or service notice.** Full captured text, availability date, publication date, bound proceeding, and the deadline it triggers.

**Deadline.** Type, base date, number of days, counting regime, calculated due date, responsible person, situation, and the bond with the publication or act that originated it.

**Expert examination and hearing.** Date, time, place or link, type, designated professional, situation, instructions to the client, and result.

**Task.** Description, responsible person, priority, board column, sprint, internal deadline, dependencies, and checklist.

**Document.** Original file, document type, OCR situation, extracted text, extracted structured fields, confidence index, human validation, upload author, and access history.

**Communication.** Channel, direction, content, attachments, author, date, and bond with the case.

**Finance.** Fee contract of the case, contractual percentage, court-awarded fees, percentage share of each lawyer, entries, receivables, small-value requisition or precatório, and payouts.

**Hours record.** Lawyer, case, activity, time, and date.

**Audit event.** Author, action, affected entity, values before and after, date, time, and origin.

---

## 6. End-to-end operational flow

This is the mandatory path of a case, and the system models it as a flow with passage gates.

### 6.1 Entry and triage

An email arrives at the firm's address. The system captures the message, and the IM layer performs the initial triage: it identifies whether it is a new contact, an existing client, an official communication, or a submitted document. It extracts name, CPF when present, subject, and intent, and classifies the urgency. The message is routed to the Intake queue with the suggested classification and the degree of confidence. No automatic classification advances by itself; Intake confirms.

### 6.2 Intake

Intake qualifies the contact, registers or locates the client, identifies which benefit will be pleaded, and opens the case. It requests the necessary documents according to the specific list of that benefit type, records the communications, and reviews the documentation received. The case only advances when the minimum documentary instruction is complete, and the system shows explicitly what is still missing.

### 6.3 Administrative phase

The case enters the administrative phase. The request before the INSS is recorded, with benefit number, date of entry of the request, and protocol. The system tracks requirements, each with its own deadline, and the administrative expert examination when applicable, with date, place, and preparation of the client.

At the end, the administrative decision is recorded with its grounds.

**If granted**, the case is closed in that phase, with calculation of the fees and verification of the implemented amount.

**If denied**, the decision on the next path is opened: administrative appeal to the Social Security Appeals Council, or filing of the lawsuit. The system records the choice and its grounds.

### 6.4 Passage gate to the judicial phase

The system applies a mandatory verification before allowing the opening of the judicial phase: there must be proof of the prior administrative request and of the respective decision, or an expressly justified exemption hypothesis. That requirement follows from the understanding settled by the Supreme Federal Court in Extraordinary Appeal 631.240, and it prevents filing a lawsuit without demonstrated procedural interest. The gate may be released by a lawyer with a recorded justification, which stays in the audit trail.

### 6.5 Judicial phase

The distribution is recorded, with the CNJ number, the competent court, and the class. From then on the system starts tracking the movements automatically and receiving the published service notices, generating the corresponding deadlines.

Jurisdiction is determined according to the case: Federal Small Claims Court for claims up to the legal cap, ordinary Federal Justice above it, and State Justice in the delegated jurisdiction hypotheses and in accident claims against the INSS, per the consolidated orientation of Precedent 15 of the Superior Court of Justice.

The system manages the judicial expert examination, the hearing when there is one, the tracking of the instruction, and the judgment. If there is an appeal, the case stays active with the tracking of the next instance.

### 6.6 Enforcement and closure

Once the favourable decision becomes final, the enforcement phase begins, with the issuance of a small-value requisition or a precatório according to the amount. The system tracks the issuance, the payment, and the implementation of the benefit, calculates the contractual and court-awarded fees, distributes the share of each lawyer, and closes the case.

---

## 7. Modules of the system

### 7.1 Dashboard

Landing panel adapted to the profile of whoever signs in.

**Administration** sees the global indicators: cases by phase, cases by benefit type, deadlines coming due, overdue deadlines, productivity by team, administrative and judicial grant rate, and risk alerts.

**Intake** sees the triage queue, the cases awaiting documentation, the contacts with no reply, and the team's tasks.

The **Lawyer** sees their deadlines in order of due date, their hearings and examinations of the week, the new publications of their proceedings, their tasks, and their financial result.

**Finance** sees the receipt forecast, the amounts received, the pending payouts, the fees per lawyer, and the portfolio by situation.

### 7.2 Clients

Listing with search by name, CPF, benefit number, and proceeding number. The client record gathers the civil data, the contacts, the documents, and the list of cases. Each case in the list leads directly to its detail, already positioned in the correct phase, administrative or judicial. The cases are presented separated by benefit, so that two distinct claims of the same client never mix.

### 7.3 Intake

Work queue organised by situation and by team, with a view separated by benefit. Each item carries the complete history of the contact, the documents received, the list of what is still missing, and the available actions. Record of every contact made, with channel, content, and responsible person.

### 7.4 Administrative

It concentrates the administrative procedures before the INSS: requests, requirements and their deadlines, administrative expert examinations, decisions, and appeals to the Social Security Appeals Council. It also presents the tracking view of the cases that already moved to the judicial phase, for context reading, without duplicating the judicial operation.

### 7.5 Judicial

Organised by subcategories that reflect the nature of the case, for example concession, reinstatement, revision, accident-related, and assistance benefit, plus an overall view of every active proceeding. Each subcategory leads to the corresponding case. The detail of the proceeding gathers distribution data, captured movements, service notices, deadlines, expert examinations, hearings, pleadings, and the complete history.

### 7.6 Documents and OCR

The client sends documents by email, by message, or by a secure upload link, and Intake may also upload files directly. PDF, images, and photos are accepted.

Each file goes through optical character recognition and then through a structured extraction step that identifies the document type and pulls the relevant fields. For example, from a statement of the National Social Information Registry the employment bonds, the competences, and the remunerations are extracted; from a work card, the contracts and the dates; from a medical report, the professional, the date, the diagnosis, and the conclusions.

Each extracted field receives a confidence index. Fields below the configured threshold are marked as pending and require human validation before being used in any calculation or pleading. The original text always remains accessible next to the extracted data, for verification.

The lawyer consults the documents and the information of the case in real time and may download any file to their computer. Every download is recorded in the audit trail with author, file, date, and time.

**Honest limit that must be recorded.** Optical recognition does not reach one hundred percent accuracy on handwritten documents, medical reports with handwriting, low-quality copies, and faded old documents, which are exactly the most frequent ones in social security matters. That is why the adopted architecture does not promise perfect extraction; it promises assisted extraction with measured confidence and mandatory human validation at the critical points. That is the only responsible way to treat data that grounds a legal pleading.

### 7.7 Kanban with Waterfall and Sprint

The system combines the two methods at two levels.

**Waterfall, macro level.** The legal track is sequential and cannot be skipped: triage, intake and qualification, documentary instruction, administrative phase, administrative decision, administrative appeal when there is one, judicial phase, judicial instruction, judgment, judicial appeal when there is one, enforcement and execution, closure. Each phase passage is a gate that requires the mandatory artifacts of that step. The system blocks the advance while a requirement is missing and shows exactly what is missing.

**Sprint, micro level.** Inside each phase, the work is organised in cycles with a task board, with columns of to do, in progress, blocked, in review, and done. Each task has a responsible person, an internal deadline, a checklist, and dependencies. The cadence of the cycle is configurable.

Each case has its board, and there is also a consolidated view per lawyer and per team.

### 7.8 Deadline calculator

It calculates the due date in business days, per article 219 of the Code of Civil Procedure, excluding the start day and including the due day, in the form of article 224, with extension to the next business day when the due date falls on a non-business day, and considering the suspension of the period from December 20 to January 20, provided in article 220.

For electronic service notices, the counting starts from the publication date, which is the first business day following availability, and the deadline starts on the first business day following the publication.

For administrative deadlines, the system applies the regime proper to each type of requirement or appeal, which differs from the procedural regime.

The calculator considers national, state, and municipal holidays, besides the specific suspensions determined by each court.

**Honest limit that must be recorded.** There is no unified and reliable public source of holidays and suspensions for all courts in the country. The system maintains a calendar per court, fed and reviewed, with the possibility of manual adjustment and a record of who adjusted it. The calculation is a support tool, and the deadline remains under the professional responsibility of the lawyer, who confirms each due date. The system makes that explicit on the screen, and every deadline has the state of calculated or of confirmed.

### 7.9 Deadlines, expert examinations, and hearings

Unified agenda with a day, week, and month view, filterable by lawyer, by team, and by type. Escalating alerts according to the proximity of the due date, with automatic escalation to coordination when a critical deadline approaches with no treatment. Each expert examination and hearing automatically generates the preparation tasks and the guidance communication to the client, subject to review before sending.

### 7.10 Publications and service notices

The system queries the published judicial communications daily, filtering by the registration numbers in the Brazilian Bar Association registered in the firm and by the tracked proceedings. Each captured communication is bound to the proceeding, stored with the full text, presented to the responsible lawyer, and used to automatically generate the corresponding deadline, which enters in the calculated state until the human confirmation.

### 7.11 Communications

Centralised record of every interaction with the client and with third parties, by email, message, and telephone, always bound to the case. Message templates per situation, with automatic filling of case data. No external communication is fired by automation without recorded human approval.

### 7.12 Finance and the lawyers' share

Each case has its fee contract, with a contractual percentage over the economic benefit, fixed fees when there are any, and court-awarded fees.

The share of each lawyer is defined by percentage, per case or by a default rule of the firm, and the system automatically calculates the amount due to each one when the case generates revenue.

Each lawyer accesses exclusively their own calculation, their hours record, and their history of receipts. The finance team and the administration access the consolidated view.

The module tracks the issuance and the payment of small-value requisitions and precatórios, with receipt forecast and reconciliation.

### 7.13 Compliance and the MAIC, HIM, and NHE Trinity

This module is the governance layer of Massive Intelligence inside the system, and it operates at three levels.

**MAIC** is the governance level, the set of policies, limits, and rules to which every assisted operation submits. It defines what Massive Intelligence may do, what needs human review, and what is forbidden.

**HIM** is the model level, the reasoning layer that analyses, classifies, summarises, and proposes.

**NHE** is the agent level, the entity that executes concrete tasks inside the system, such as triaging a message, extracting fields from a document, or preparing a draft, always within the limits defined by MAIC.

The functions of the module are the following.

**Risk and compliance analysis.** Assessment of the viability of the case from the documents and the history, documentary gap alert, forfeiture and limitation risk alert, conflict of interest verification, and critical deadline without treatment alert.

**Chat with Massive Intelligence.** Assistant anchored in the case data, which answers citing the internal source consulted, indicating the document and the passage. It does not issue a conclusive legal opinion, does not assert a probable outcome peremptorily, and does not replace the lawyer's analysis. Every interaction is recorded with date, time, user, and model version.

**Mandatory limits.** No output of Massive Intelligence is used in a pleading, external communication, or case decision without the review and approval of a lawyer. Every output is marked as assisted in the case record. Sensitive personal data is minimized before any sending to an external service, per section 10.

---

## 8. External integrations

### 8.1 DataJud, National Council of Justice

Official source of procedural metadata and movements, through the public API of the National Council of Justice, documented at `https://datajud-wiki.cnj.jus.br/api-publica/acesso`.

The system queries by proceeding number and by court, and receives class, subjects, adjudicating body, filing date, and the list of movements. Each court has its own query endpoint, and authentication is done with a public key provided by the Council.

Planned coverage: Federal Justice, State Justice, and Labour Justice, according to the real need of the firm defined in section 14.

**Real limits that must be recorded.** The DataJud base is not updated in real time; each court submits its data on its own cadence, which produces lag. The API delivers metadata and movements, and does not deliver pleadings, documents, nor, as a rule, personal data of the parties. There are request limits. That is why DataJud is used as a tracking source and not as the single source of truth for a deadline, which comes from the published service notice.

### 8.2 DJEN, judicial communications

Official source of the publications and service notices, through the public API at `https://comunica.pje.jus.br/api`.

The system queries daily by registration number in the Brazilian Bar Association and federative unit, and also by proceeding number, retrieving the communications made available in the period. Each retrieved communication is stored with the full text, bound to the proceeding and to the lawyer, and generates the corresponding deadline.

That is the adequate source, since the National Electronic Justice Gazette is the official means of publication of judicial acts, in the form of Law 11,419 of 2006 and of Resolution 455 of 2022 of the National Council of Justice.

### 8.3 Resilience strategy of the integrations

Every external query runs as a scheduled job, with execution, attempt, and result records. A network failure generates a retry with progressive backoff. A result already received is not reprocessed. The system keeps memory of what was already captured to avoid duplication and to allow reconstruction in case the source is unavailable. Every unavailability is visible on the panel, so the team knows that the automatic tracking is late and acts manually.

### 8.4 What cannot be automated today, and why

There is no standardised and universal public interface for electronic filing in the Brazilian court systems. Each system, each court, and each instance operates with its own rules, certificates, and restrictions, and a good part requires authenticated interaction with the lawyer's personal digital certificate. That is why the filing of pleadings remains a human act, and the system acts up to the prior step, that is, preparation, assembly, review, and recording of the filed pleading. Promising universal automatic filing would be unrealistic.

---

## 9. Technical architecture

### 9.1 Technology stack

Application in Next.js with TypeScript, styling with Tailwind CSS, accessible components with Radix UI, animation with Framer Motion, data validation with Zod, identifiers with UUID and ULID, standardisation and code quality with Biome.

Database, authentication, file storage, and row level security with Supabase.

Intelligence layer with the Anthropic API.

Own libraries of the `@takk` and `@teleologyhi-sdk` ecosystems, for governance, model routing, cost control, output validation, and operational memory.

Publication by continuous integration and delivery with GitHub Actions, targeting a virtual private server at Hostinger.

### 9.2 Organisation of the application

The application separates four layers clearly. The presentation layer, with the screens and components. The application layer, with the use cases and the flow rules. The domain layer, with the entities and the legal business rules, such as deadline calculation and phase gates. The infrastructure layer, with access to the database, to storage, and to the external integrations.

Every datum entering the system, from a form, a file, or an external integration, is validated by a schema before being accepted.

### 9.3 Environments and publication

Three separate environments, with independent bases and keys: development, staging, and production. Publication to production only happens after the complete passage of the quality gates described in section 12, and never from an unverified local state.

### 9.4 Performance and volume

The system is sized for a firm operation, with queries indexed by client, case, proceeding, and deadline, pagination in every listing, on-demand loading of the documents, and cache of the external queries. The sizing numbers depend on the confirmation of the real volume, an open item in section 14.

---

## 10. Security, privacy, and data protection

### 10.1 Nature of the processed data

The system processes personal data and, inevitably in this field, **sensitive personal data**, especially health data, present in medical reports, exams, certificates, expert examinations, and diagnoses. That category receives reinforced protection under the Brazilian General Data Protection Law, and the processing is grounded in the hypotheses of article 11, notably compliance with a legal and regulatory obligation and the regular exercise of rights, including in judicial and administrative proceedings.

Add to that the lawyer's professional secrecy, a duty provided in the Advocacy Statute, which reinforces the need for strict access control.

### 10.2 Adopted measures

Minimum necessary access per profile, enforced in the database by a row level security policy. Encryption in transit and at rest. Segregation of the sensitive documents, inaccessible to the finance team. Record of every read and download of a sensitive document. Retention defined by policy, with disposal at the end of the applicable legal period. Secrets and keys outside the code, kept exclusively in environment variables. Periodic backups with a restoration test.

### 10.3 Minimization before the use of an external intelligence service

Before any content is sent to an external intelligence service, the system applies removal or substitution of the direct identifiers that are not necessary for the task, such as full name, document number, and address. The goal is to obtain the analysis without exposing the identity of the data subject. The situations in which substitution is not possible are recorded and submitted to the policy defined in the governance module. The contracting of the external service must provide for data processing clauses compatible with the applicable legislation.

### 10.4 Data location

The definition of the hosting region of the database is relevant for compliance and for performance, and is a point to confirm in section 14, with a preference for a region in Brazil.

---

## 11. Audit and traceability

Every relevant action generates an immutable audit event, containing author, action, affected entity, values before and after when applicable, date, time, and origin of the request.

Audited, at minimum: creation and change of client and of case, phase change, creation and change of deadline, deadline confirmation, upload, read, and download of document, permission change, financial data change, and every interaction with the intelligence layer.

The audit trail is accessible only to the administration, is not editable, and is not deletable by the application.

---

## 12. Quality, tests, and delivery

### 12.1 Quality gates

No code enters production without passing, in order and stopping at the first error, the standardisation check, the type check, the automated test suite, and the build of the application.

### 12.2 Priority test coverage

The rules that cause damage if they fail receive mandatory tests: deadline calculation in all its variations, phase passage gates, access policies per profile, document extraction and validation, financial calculation and per-lawyer share, and integration with the official sources, with unavailability simulated.

### 12.3 Continuous integration and delivery

Each approved change triggers the automatic verification. Publication to production is deliberate, versioned, and reversible, with a record of what was published and when.

### 12.4 Observability

Error monitoring in production, structured logging of the scheduled executions, and a health panel of the external integrations, so that a service-notice capture failure is noticed the same day and not on the eve of the deadline.

---

## 13. Implementation phases

The order below is one of technical dependency; each phase delivers usable value and serves as the base for the next.

**Phase 1, foundation.** Authentication, teams, profiles, access policies in the database, audit trail, and the structure of client, case, and benefit type.

**Phase 2, case operation.** Administrative phase, judicial phase, passage gates, agenda, deadlines with the calculator, expert examinations, and hearings.

**Phase 3, documents.** Upload, storage, optical recognition, structured extraction, human validation, consultation, and download with audit.

**Phase 4, official integrations.** Capture of movements and capture of service notices, with automatic generation of deadlines and a health panel of the integrations.

**Phase 5, work and productivity.** Kanban with phases and cycles, tasks, communications, and message templates.

**Phase 6, finance.** Contracts, fees, per-lawyer share, receivables, requisitions, and payouts.

**Phase 7, intelligence and compliance.** Assisted triage, risk analysis, chat anchored in the case data, and governance panel.

**Phase 8, refinement.** Complete dashboards per profile, reports, and performance adjustments.

---

## 14. Points I need to confirm before executing

These points change the architecture and the effort, and that is why I need your definition.

**14.1 End-client access.** The specification says that the team and the company use the system internally and that the client has no access. At the same time, it says that the client sends documents. Those are incompatible things if there is no intake channel. My proposal is: the client has no account and no panel, and sends documents by email, by message, or through a secure upload link, single-use and with an expiry, without creating a login. Intake receives and binds it to the case. Do you confirm that design, or do you want a client portal with a login?

**14.2 What enters Administrative.** The specification left one item open in that category. Beyond the administrative procedures and the tracking view of the judicial ones, what else do you want in that area? Possible suggestions: request templates, control of requirements, tracking of appeals to the Social Security Appeals Council, and control of passwords and accesses to the INSS systems.

**14.3 Subcategories of Judicial.** One item was also left open. My proposal of subcategories is: concession, reinstatement, revision, accident-related, assistance benefit, and execution. Confirm, cut, or add.

**14.4 Labour Justice.** What is the real use of that sphere in the firm? In social security matters it is infrequent, and knowing the concrete case defines whether the integration is worth the effort now or is left for later.

**14.5 Existing database.** Does the current CRM already have data in production? In which format and volume? Will there be a migration, and does it need to preserve history?

**14.6 Operation volume.** How many users per team, how many active cases today, and how many new cases per month? That defines sizing, storage cost, and intelligence cost.

**14.7 Database hosting.** Managed Supabase or installed on the Hostinger server? And, in the managed case, do you confirm the preference for a region in Brazil?

**14.8 Document signature.** Does the system need to generate and collect the signature of a contract and of a power of attorney? If so, by which means, simple electronic signature, gov.br, or an ICP-Brasil certificate?

**14.9 Messaging.** Will there be an official instant messaging integration for communication with the client, or will the record be manual only?

**14.10 Data protection officer.** Is there a designated officer and a formalised privacy policy? That is a legal requirement for the processing the system performs.

**14.11 Current state of the code.** I need access to the existing repository to survey what is already built, what is reusable, and what needs to be redone, before any effort estimate.

---

## 15. Risks and how they are treated

**Imperfect document extraction.** Treated by a confidence index, mandatory human validation on the critical fields, and preservation of the original document next to the extracted data.

**Lag of the official sources.** Treated by a health panel of the integrations, a capture delay alert, and maintenance of manual tracking as an alternative path always available.

**Deadline calculation error.** Treated by a calendar maintained per court, an explicit distinction between a calculated deadline and a confirmed deadline, escalating alerts, and professional responsibility preserved in the confirmation.

**Sensitive data leak.** Treated by minimum access enforced in the database, segregation of the health documents, audit of reads and downloads, and minimization before sending to an external service.

**Imprecise answer from the intelligence layer.** Treated by mandatory anchoring in the case data, source citation, marking of assisted content, prohibition of external use without review, and complete recording of the interactions.

**Scope growth.** Treated by implementation phases with closed deliveries, and by a recorded decision at each inclusion outside the scope defined in this document.

---

## 16. Closing

This document defines the operation of the system, what it delivers, how each profile uses it, what the official sources of data are, what the real technical and legal limits are, and which decisions still depend on you.

The definitions of section 14 are what is missing to start the execution with a closed scope and without rework.
