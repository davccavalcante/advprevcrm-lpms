# PRIVACY

Data protection baseline of Advprev CRM under the Brazilian General Data Protection Law (LGPD, Law 13,709 of 2018). Status: internal engineering baseline derived from `INFO.md` section 10 and the project preamble, awaiting the director's approval. This document is not the public privacy notice; that notice is a separate mandatory deliverable, pending the definitions of `INFO.md` section 14.

## Nature of the data processed

The system processes personal data and, inevitably in this field, sensitive personal data, especially health data present in medical reports, exams, certificates, expert examinations, and diagnoses. Processing rests on the hypotheses of article 11 of the LGPD, notably compliance with a legal and regulatory obligation and the regular exercise of rights in judicial and administrative proceedings. The lawyer's professional secrecy, a duty under the Advocacy Statute, reinforces strict access control.

## Principles enforced in engineering

- Minimization: each profile accesses only the minimum necessary, enforced in the database through row level security. The finance team never accesses health documents or any sensitive personal data.
- Minimization before external services: direct identifiers unnecessary to the task are removed or substituted before any content reaches an external intelligence service. Impossible substitutions are recorded and governed by MAIC policy. The external service contract must carry data processing clauses compatible with the applicable legislation.
- Minimization in force in the current phase, measured on 2026-08-11: what the entity sends to the external reasoning service is assembled by the governance layer and carries the case, the client name, the operation of the office and the names of the attached files, and never the registration number of a natural person, the address, the telephone or the electronic address, and never the content of a document, since no extraction exists in this phase. The exclusion is executed while the data is assembled, not requested from the model, and the entity is told that it does not receive those fields so that it states the fact instead of guessing.
- Traceability: every read and download of a sensitive document generates an audit event with author, file, date, and time. The audit trail is immutable and admin-only. Every interaction with the entity is appended as an immutable record carrying author, moment, question, answer, model, and how many records entered the context and how many were suppressed.
- No indefinite retention: retention follows defined policy, with disposal at the end of the applicable legal period.
- Re-identification protection: sensitive health data never enters aggregated dashboards or exports without tested anonymization.

## Technical measures

Encryption in transit and at rest. Segregation of sensitive documents. Secrets exclusively in environment variables. Periodic backups with a tested restoration procedure. Personal data removed from observability payloads before sending. Access rules enforced in the database, never only in the interface.

Account profile, added 2026-08-21, superseded on 2026-09-01: the record then lived under `data/` with the password as a salted scrypt hash. It now lives in the office database. The identity of the account is a row of `profiles`, the password is the credential of the authentication service and this application never sees it and never stores it, and the photo lives in a private bucket under the identifier of the account and is served by an application route, never from a public asset folder, because a personal photo is personal data. Every profile change appends an immutable line to the audit trail with author, moment and values before and after, and password material never enters it.

Where the data lives, recorded 2026-09-01: the personal data of clients, cases, documents, deadlines, communications and audit lives in Supabase in South America, São Paulo, with SSL enforced, row level security on every table and two private buckets for the files. Under `data/`, on the office server, remain only the universe of the non-human entity, the conversations, the consumption ledger and the answer cache. Reading a document, whether a preview, a download or a passage read by the entity, appends an event with the author, the role, the file, the measured confidence and the origin of the access, and that trail carries no foreign key, so deleting a document never erases the evidence of who read it.

## Data subject rights

Legal basis registration, retention periods, right of deletion, records of processing activities, and a privacy notice are mandatory deliverables of the system. Data subject requests will be handled according to the formalized privacy policy, pending the director's definitions.

## Pending definitions (INFO.md section 14)

Designation of the data protection officer (encarregado) and formalization of the privacy policy (14.10). Database hosting and region confirmation, with preference for Brazil (14.7). End-client document intake channel (14.1).
