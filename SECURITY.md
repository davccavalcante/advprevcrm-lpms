# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 1.0.0-canary | yes |

## Reporting a vulnerability

Report vulnerabilities privately to davcavalcante@proton.me. Do not open public issues, pull requests, or discussions for security matters; this project processes personal and sensitive data of a law firm's clients, and public disclosure before a fix would put data subjects at risk.

Include in the report: a description of the issue, steps to reproduce, the potential impact, and any suggested remediation. Reports are acknowledged and handled with priority, and reporters are credited on request after remediation.

## Scope

This repository and its deployment artifacts. The system's security posture is defined in `PRIVACY.md` and `INFO.md` section 10: minimum necessary access enforced in the database through row level security, encryption in transit and at rest, segregation of sensitive documents, immutable audit trail, secrets exclusively in environment variables, and periodic backups with tested restoration.

## Out of bounds

Testing against production data, social engineering of firm staff, and any access attempt involving real client data are not authorized under any circumstance.
