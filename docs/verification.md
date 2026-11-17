# Verification record

Verified locally on **17 November 2026 (Asia/Bangkok)** using Docker Desktop 28.1.1 and Compose 2.36.0 on Windows with Linux containers. Application dependency installation, migration generation, builds and tests ran in Docker. No host Node.js, npm, .NET SDK, PostgreSQL or EF CLI was required or installed for this work.

## Commands and results

| Check | Actual result |
|---|---|
| `docker compose up --build -d` | Pass; frontend and backend multi-stage images built and all three application services started |
| `docker compose --profile test run --build --rm backend-tests` | **23 passed**, 0 failed |
| `docker compose --profile test run --build --rm e2e` | **10 passed**, 0 failed in Chromium after the theme/localization update |
| `docker compose restart` followed by `docker compose up -d --wait` | All three application services healthy; database record fingerprint unchanged |
| Fresh-volume startup using the optional acceptance override | Three users, 15 patients, 45 confirmed visits, one AI draft, one committed EF migration |
| Frontend GET `http://localhost:3000` | HTTP 200 |
| API GET `http://localhost:8080/health` | HTTP 200, `{"status":"healthy"}` |
| Swagger GET `/swagger/index.html` and `/swagger/v1/swagger.json` | Both HTTP 200 |

The isolated fresh-run check used `docker compose -p medflow-first-run -f docker-compose.yml -f docker/acceptance.override.yml up -d --no-build --wait` after building the default images. This used separate project volumes and alternate loopback ports, without touching the working demonstration database. The override needs Compose >= 2.24.4. Default startup does not require this file.

The working demo accumulated synthetic notes during E2E tests. Immediately before and after restarting all services, its stored user/patient/note/migration counts were `3 / 15 / 52 / 1`; an MD5 fingerprint of all note IDs, subjective text, status and concurrency versions was identical. MD5 here is only a local comparison checksum, not a security control. Seed preservation was also checked twice in the integration suite, including a custom draft and existing password hashes.

## Critical workflow coverage

- Authentication is required for patients; invalid credentials and missing CSRF tokens fail.
- Patient name/identifier search and seeded history retrieval work.
- SOAP fields reject empty, whitespace, null and oversized input.
- Full 8,000-character Thai fields fit through Nginx and Kestrel and are saved intact.
- Drafts can be created and edited; stale versions and writes to approved notes return conflict.
- Nurse and administrator confirmation calls return forbidden; doctor confirmation requires explicit review.
- Demo AI returns labeled, unapproved suggestions; summaries are excluded from actionable SOAP counts.
- Live-provider transport tests cover structured output, missing/invalid fields, refusal, malformed envelopes, HTTP failures and timeouts with no paid calls.
- Audit failure rolls back both manual note creation and AI suggestion insertion.
- Authorization denials are audited; the administrator audit UI is functional.
- Browser flow edits an AI draft, explicitly confirms it and verifies unique saved text after reload.
- Shell navigation/sign-out warn about unsaved changes; administrator draft views retain unapproved labels.
- Tablet viewport 820 × 1180 has no document-level horizontal overflow.

## Acceptance checklist

- [x] Default Compose build/start works without a `.env` or API key.
- [x] Frontend :3000, backend :8080 and Swagger respond.
- [x] PostgreSQL healthy and internal only.
- [x] Committed EF migration applies automatically before API listening.
- [x] Idempotent seed inserts 15 fictional bilingual patients and at least three visits each.
- [x] Three demo accounts authenticate with securely hashed passwords.
- [x] Search, patient history, SOAP create/edit and confirmation work.
- [x] Demo AI supports the complete human review flow.
- [ ] **Real live OpenAI call** with an authorized account/key: not executed. Paid external calls were not authorized. Provider transport and error handling pass stub-boundary tests; real account/model availability remains unverified.
- [x] Backend enforces explicit doctor confirmation and optimistic concurrency.
- [x] Audit events and automated tests work.
- [x] Repeated initialization and container restarts preserve records without duplicate seed data.
- [x] README includes Docker-only startup, credentials and testing instructions.

## Review and limits

A fresh read-only reviewer checked the implementation. No critical findings were reported. Important findings were reproduced and fixed: unsaved navigation, incorrect administrator confirmation labels, Thai transport limits, query-string logging, and note/audit atomicity. E2E now requires Demo AI Mode before generating and verifies a unique text value each run, preventing accidental paid calls and false positives from retained records.

Request logs now omit query strings: Nginx logs method/path/status, and ASP.NET request diagnostics are filtered. Audit events intentionally retain only actions and internal identifiers.

Deferred minor: the draft-edit API also accepts text edits to unapproved summary suggestions. The UI does not expose that edit path; the server still rejects clinical confirmation of summaries. This does not bypass doctor review or approve a record.

Real clinical accuracy, production deployment, formal accessibility conformance, healthcare certification and security compliance are not verified and are not claimed. The UI now supports Thai and English; clinical source content is kept in its recorded language. No remote repository or public deployment was created.

## Theme and localization follow-up

The frontend has a new white/slate/teal clinical theme with larger text and controls. The humanizer pass replaced promotional headings with functional clinical labels. Thai and English cover navigation, login, patient tables, SOAP controls, review labels, validation, dialogs and notifications. The language preference persists in browser storage; language changes preserve the active draft.

The final browser suite passed **10/10** checks: six existing English workflow checks and four localization checks. These include language changes in save/confirmation notifications and date formatting when browser storage is blocked. Both issues were reproduced by failing tests before being fixed. Desktop Thai, desktop English, Thai login and Thai tablet screenshots were regenerated. The Docker frontend build passed; all three application services remain healthy. Backend source was unchanged by this update.
