# Verification record

Verified locally on **17 November 2026 (Asia/Bangkok)** using Docker Desktop 28.1.1 and Compose 2.36.0 on Windows with Linux containers. Application dependency installation, migration generation, builds and tests ran in Docker. No host Node.js, npm, .NET SDK, PostgreSQL or EF CLI was required or installed for this work.

## Commands and results

| Check | Actual result |
|---|---|
| `docker compose up --build -d` | Pass; frontend and backend multi-stage images built and all three application services started |
| `docker compose --profile test run --build --rm backend-tests` | **31 passed**, 0 failed after account onboarding persistence/security coverage |
| `docker compose --profile test run --build --rm e2e` using the isolated CI override | **31 passed**, 0 failed after interactive tutorial coverage |
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

Resolved minor: the draft-edit API now rejects attempts to edit summary suggestions as SOAP notes. Doctor and nurse regression cases verify HTTP 409 and unchanged summary text, version and status. Summary suggestions also remain ineligible for clinical confirmation.

Real clinical accuracy, production deployment, formal accessibility conformance, healthcare certification and security compliance are not verified and are not claimed. The UI now supports Thai and English; clinical source content is kept in its recorded language. No remote repository or public deployment was created.

## Theme and localization follow-up

The frontend has a new white/slate/teal clinical theme with larger text and controls. The humanizer pass replaced promotional headings with functional clinical labels. Thai and English cover navigation, login, patient tables, SOAP controls, review labels, validation, dialogs and notifications. The language preference persists in browser storage; language changes preserve the active draft.

The final browser suite passed **10/10** checks: six existing English workflow checks and four localization checks. These include language changes in save/confirmation notifications and date formatting when browser storage is blocked. Both issues were reproduced by failing tests before being fixed. Desktop Thai, desktop English, Thai login and Thai tablet screenshots were regenerated. The Docker frontend build passed; all three application services remain healthy. Backend source was unchanged by this update.

## Thai demonstration workflow follow-up

The backend suite now contains 25 cases. The two added cases failed against the previous summary-edit behavior, then passed after the SOAP edit endpoint was restricted by note kind. No migration was needed.

The browser suite now contains 11 cases. The added Thai flow searches by a Thai patient name, generates a labeled deterministic AI draft, saves unique reviewed text, confirms as Doctor, reloads the record, switches language without translating clinical content, and verifies the Administrator audit row against the actual confirmed note ID. This prevents older audit events from satisfying the check.

## Docker CI follow-up

The new GitHub Actions workflow was validated locally using `docker/ci.override.yml` on a separate `medflow-ci` project. Docker Compose parsed the configuration; the effective configuration has no published ports and an explicitly empty OpenAI key. Fresh initialization produced three users, 15 patients, 45 confirmed notes, one unapproved AI SOAP draft and one migration.

The isolated backend suite passed 25/25 and the isolated browser suite passed 11/11. The backend TRX and Playwright HTML reports were generated under `artifacts/ci/`; tracked README screenshots were not changed. All application services restarted successfully with identical record counts and a checksum covering every stored note field. A snapshot of the original working demo was also unchanged throughout this check.

The strengthened seed assertion was exercised against a transactionally modified CI fixture: approving the AI draft while moving one original note back to draft preserved the total confirmed count but caused the seed check to reject the initial AI state. The transaction was rolled back and original seed counts were verified again.

`actionlint` 1.7.12 ran inside Docker and accepted `.github/workflows/docker-ci.yml`. Official checkout and artifact actions are pinned to commits verified against their release tags. Diagnostics and cleanup commands were executed locally. A real GitHub-hosted checkout, runner execution and artifact upload remain unverified because no remote was supplied and no workflow was triggered. See [ci.md](ci.md) for Bash and PowerShell reproduction commands.

## Swagger and responsive follow-up

The backend suite passed 29/29 and the full browser suite passed 22/22. Swagger is available directly on port 8080 and through Nginx on port 3000, with grouped operation documentation, response schemas, role/review constraints and normal demo authentication. Browser tests execute a protected GET and create an unapproved draft through Swagger's actual Try it out controls. Production excludes both Swagger and its demo session assets.

The frontend Swagger proxy retains the application's strict `script-src 'self'` policy. Directly installed interceptors attach CSRF tokens without `unsafe-eval`. Session tests cover changing accounts through the Swagger panel, login/logout via Try it out, clearing the preceding account's cached workspace, renewing CSRF before a subsequent save, focus-based reconciliation when BroadcastChannel is unavailable, and preserving unsaved drafts for the same account.

Responsive browser checks cover 360, 390, 768 and 1024 CSS px, plus Swagger at 360 px. Patient actions stay in view; closed phone navigation is inert, Escape restores focus, the SOAP editor precedes AI assistance on narrow screens, and no document-level horizontal overflow was found. A targeted UI/UX Pro Max review informed larger web touch targets and 16px narrow-screen text inputs. These checks do not certify native keyboard behavior, screen-reader operation or WCAG conformance.

Readiness was also verified in a disposable Docker project: `/health` returned backend JSON, failed after stopping that backend, and `/frontend-health` continued to prove Nginx liveness. The disposable project was removed and the default application remained running. See [Swagger usage and responsive details](swagger-and-responsive.md).

## Calm Care theme follow-up

The frontend Docker build passed, followed by 23/23 browser tests. The new theme keeps locally bundled Thai/English fonts and existing workflow controls while changing navigation, surfaces, typography and component styling. Additional checks cover a 375px login and overview in portrait/landscape with reduced motion and an enlarged root font. Desktop login/overview and phone SOAP screenshots were inspected; the closed drawer's unwanted shadow was removed and five focused layout cases passed again. All three application services remained healthy. Backend code was unchanged; its previously verified 29-case suite was not rerun for this CSS change. See [theme details](calm-care-theme.md).

## First-login guide follow-up

The backend suite passed 31/31 cases, including a newly created account's unseen state, server persistence across sessions, account isolation, repeated dismissal and authentication/CSRF requirements. New guide tests failed before implementation. Review uncovered an expired-session dismissal trap and lost keyboard focus; regression tests reproduced both before fixes.

The full browser suite passed 30/30 using the disposable `medflow-onboarding` Compose project with the CI override. It covers completion across browser contexts, skipping, Help replay, unchanged unsaved SOAP text/dirty state, Thai/English switching, 375px layout, all three role descriptions, focus restoration, failed-save retry and expired-session login recovery. Existing clinical workflow tests override only the onboarding preference to represent returning users. The expanded suite can exceed the real 30-logins/minute protection; its returning-user fixture waits one minute and retries once on 429 instead of weakening the server limit. Desktop and phone screenshots were inspected. This is not a full assistive-technology audit.

Both application images built and started locally. The automatic nullable-column migration preserved the freshly reset working data: `3|15|45|1|2` for users/patients/confirmed notes/AI drafts/migrations, and all three accounts remained unseen (`OnboardingSeenAt` null). Browser writes ran only in the disposable project, not the working demo. No paid AI request or publication was performed. See [guide behavior and API details](first-login-guide.md).

After the final login-state reset refactor, 11 focused guide/session tests passed. The disposable Compose project and its volumes were removed, and the temporary backend test database was stopped. The three working application services remained healthy.

## Interactive tutorial follow-up

The introduction was replaced with spotlights on real controls and interaction-gated progression. The full browser suite passed 31/31 in the isolated `medflow-tutorial` project. Tests include actual drawer/Patients clicks, searching, opening a patient, server persistence, three roles, replay over unsaved text, failed dismissal and session expiry. Review regressions reproduced a stall when replaying from Visit history and a panel hidden by a reduced visual viewport; both passed after adding an actual documentation-tab target and visual viewport positioning. A drawer-animation regression also passed after transition tracking was added.

Desktop/phone screenshots were inspected. The viewport test simulates keyboard-induced viewport reduction; physical mobile keyboards and full screen-reader behavior remain unverified. The backend is unchanged and retains its previously verified 31 cases. No AI generation, clinical save or clinical confirmation is performed by the tutorial. The working demo's 46 notes were preserved.

Eight focused tutorial cases passed again after strengthening empty-result recovery and keyboard-focus assertions. The updated frontend was built and started locally; all three application services were healthy and the working data remained 15 patients/46 notes. Existing seen preferences were preserved, so an account that dismissed the earlier introduction can launch this tutorial from Help. The disposable test project and volumes were removed.

## Tutorial popup position fix

Two regression cases reproduced a popup detached from its search target at 375px and 1024px with a tall viewport. The old fallback pinned it to the viewport bottom. The new placement helper chooses a region adjacent to the control, keeps viewport margins, constrains body height when necessary, and supplies a pointing arrow. Both cases check target separation, proximity, full popup visibility and recomputation after viewport height changes.

The complete focused tutorial suite passed 10/10 in the disposable `medflow-position` project. It includes the existing real-click flow, role/draft replay, history-tab recovery, simulated keyboard viewport, retry and session expiry cases. Phone and tablet screenshots were inspected. Backend code was unchanged and its suite was not rerun for this frontend fix.
