# First-login guide implementation plan

**Goal:** Show a bilingual, role-aware four-step guide to a signed-in account until it is completed or skipped, with replay from Help.

**Architecture:** Keep the walkthrough in a focused React component using the existing Radix dialog. Persist a nullable onboarding dismissal timestamp on Users through a CSRF-protected authenticated endpoint. The guide explains the workflow without navigating away from unsaved work or generating clinical records.

**Constraints:** Continue inline in this workspace under the user's standing authorization to choose implementation defaults. Docker-only builds/tests. Preserve README edits and the recently reset demo dataset. No paid API calls.

- [x] Add failing backend tests for account-scoped persistent dismissal, idempotence, authentication and CSRF.
- [x] Add the nullable user field, EF migration, session response and documented completion endpoint. Run backend suite in the disposable test database.
- [x] Add failing UI tests for first display, skip, completion, replay, language, phone layout and failed save. Existing workflow tests isolate the onboarding preference only, keeping authentication and clinical APIs real.
- [x] Implement the four-step guide with progress, previous/next/finish/skip, translated role guidance, pending/error feedback and Help replay. No patient changes or automatic AI calls.
- [x] Run Docker builds, browser suite and screenshot inspection. Use a disposable Compose project for browser tests so the newly reset working demo remains clean. Document verification and limitations.

Evidence: backend 31/31; full browser suite 30/30. Review fixes cover expired sessions and focus restoration. Local startup preserved 15 patients and 46 notes and left all three accounts ready for their first guide. The test harness respects the existing login limit with one delayed retry on 429. A final focused run covers the small login-state reset refactor and session reconciliation.

Review focus: account switching must remount the tour; dialog closure must not silently mark success on network failure; replay must preserve drafts; phone content must scroll within viewport; the last Doctor step must describe explicit review without performing confirmation.
