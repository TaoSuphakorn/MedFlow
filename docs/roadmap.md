# Clinical safety redesign and roadmap

## Shipped in this iteration

The patient workspace was redesigned around two safety patterns used in hospital information systems.

**Persistent patient banner.** Identity, demographics, medical history and allergies sit in one banner. On screens 1024px and wider, it stays pinned below the top bar while a clinician scrolls a long note, so the patient's identity and allergies remain visible during documentation. A recorded allergy is shown as a red **Allergy alert** with a warning icon and text label, so it never relies on color alone. "No known allergies" uses a calm neutral state. At tablet and phone widths, the banner stacks and scrolls normally.

**Per-section AI provenance and review.** When a draft comes from AI, each SOAP section shows its own state:

| State | Meaning | Visual |
| ----- | ------- | ------ |
| AI Suggested | Text is unchanged from the AI output | Purple badge, dashed field, purple edge |
| Reviewed | The clinician marked the unchanged section as checked | Green toggle, green edge |
| Edited by clinician | The clinician changed the AI text | Teal badge, green edge |

A progress bar (`role="progressbar"`) counts reviewed sections. The doctor attestation and **Confirm clinical note** stay disabled until all four sections are edited or marked reviewed. AI badge text was darkened to meet 4.5:1 contrast. All new labels are translated into Thai, and the Playwright workflow tests now exercise per-section review in both languages.

**Server-side section provenance (roadmap item 1, done).** When AI creates a SOAP draft, the API stores the original text of each section in a `NoteSectionReviews` table (`NoteId`, `Section`, `AiText`, `ReviewedBy`, `ReviewedAt`, unique on note + section). Only doctors can mark or clear a section with `POST`/`DELETE /api/notes/{id}/sections/{section}/review`, and each change is audited as `note.section.reviewed.<section>` or `note.section.unreviewed.<section>`. The confirm endpoint returns 409 while any section is unchanged from the AI text and unmarked, so the rule holds even for API clients that skip the UI. Review marks and the "Edited by clinician" state survive saving and reopening a draft because the original AI text comes from the server. The migration backfills existing AI drafts, using their current text as the baseline.

**Today's clinic worklist (roadmap item 7, done).** The decorative overview hero was replaced with today's patient queue. A new `Encounters` table holds each visit (time, room, reason, status `Waiting`, `InExam` or `Completed`, and a concurrency version). Demo seeding creates eight visits for the current Bangkok clinic day (UTC+7), keyed by date so restarts don't duplicate them. `GET /api/worklist` returns today's visits with patient identity, allergies and the number of SOAP drafts awaiting confirmation. Doctors and nurses can check in walk-ins (`POST /api/encounters`, one active visit per patient per day) and move visits with `POST /api/encounters/{id}/status`. Only Waiting to InExam, InExam to Completed and InExam back to Waiting are allowed, and stale versions return 409. Every change is audited. **Start exam** opens the patient record. Cards use 44px+ touch targets, status filter chips and an allergy flag. On tablets, the action buttons move below the details, with no horizontal scroll at 768px. Administrators can read the queue but cannot change it.

**Source-cited AI summary (roadmap item 2, done).** The AI response schema now includes `summarySentences`, and each sentence lists the ids of the confirmed visits that support it. The server keeps only ids that were actually sent as context (`AiService.Cite`), so a forged or hallucinated id becomes an uncited sentence. Sentences are stored in a `SummarySentences` table (`int[]` source ids). In the assistant panel, each sentence shows citation chips with the visit date. Clicking a chip opens Visit history, then expands, highlights and focuses that record. A sentence with no source visit is flagged in amber: "No source visit. Verify against the patient profile." Demo AI produces this case deliberately for its profile sentence. Summaries created before this change fall back to plain text.

**Vital signs with alerts (roadmap item 8, done).** A new `VitalSigns` table stores BP, pulse, temperature, respiratory rate and SpO₂, with three synthetic readings per patient; a few latest readings are deliberately abnormal. `VitalRules` on the server rejects impossible entries (for example, diastolic not lower than systolic) and flags each value as warning or critical, high or low, using adult demonstration thresholds. These thresholds are not clinically validated. The Vital signs tab shows latest-value tiles with icon and text status, an alert box for the latest reading, and small-multiple trend charts. Each chart has one y-axis and a shaded normal band. The BP chart has a legend and direct labels, and its two series colors pass the colorblind and contrast checks. All charts have a hover crosshair and tooltip, plus a table view for screen readers and exact values. Doctors and nurses record readings in a dialog; administrators can only read them. Every recording is audited.

The interface also moved to the **Clean Clinical Blue** theme. See [calm-care-theme.md](calm-care-theme.md).

Code: `frontend/src/components/worklist.tsx`, `frontend/src/worklist.css`, the `AddEncounters` migration, and `frontend/src/Workspace.tsx`, `frontend/src/review.css`, `backend/src/MedFlow.Api/Program.cs`, `backend/src/MedFlow.Api/Data/ClinicalDb.cs` and the `AddNoteSectionReviews` migration.

## Next features, mapped to the role

Ordered by value per effort for a full-stack, AI-focused HIS position.

| # | Feature | What it demonstrates | JD items |
| - | ------- | -------------------- | -------- |
| 1 | ✅ **Server-side section provenance.** Store the original AI text and per-section review events in a `note_section_reviews` table. Expose them in the audit log and enforce "all sections reviewed" in the confirm API. | EF Core migration, schema design, REST validation, audit integrity | 5, 6, 11 |
| 2 | ✅ **Source-cited AI summary.** Each summary sentence links to the confirmed visit it came from. Clicking a citation highlights that record. Sentences without a citation are flagged. | Prompt/response schema design, hallucination mitigation, UX for AI trust | 10, 11, 12 |
| 3 | **PII redaction before LLM calls.** Replace names, IDs and dates with tokens before sending context to the provider, then restore them in the response. Add an AI data-processing consent flag per patient. | PDPA-minded data minimisation, backend middleware, unit tests | 12, 8 |
| 4 | **Anthropic Claude provider.** Add an `IAiProvider` abstraction with OpenAI and Claude implementations, structured output for both, and provider shown in the AI badge. | LLM API integration, clean architecture | 10 |
| 5 | **Inline auto-completion.** Ghost text in SOAP fields, accepted with Tab. Accepted spans are tagged AI Suggested until edited. | "Medical record auto-completion" from the responsibilities, streaming, debouncing | Responsibilities, 4, 11 |
| 6 | **Frontend unit tests and automated accessibility.** Add Vitest and Testing Library for review gating, translation completeness and the allergy parser. Run axe-core in Playwright CI. | Unit testing, WCAG checks in CI/CD | Responsibilities, 7, 8 |
| 7 | ✅ **Today's clinic worklist.** Replace the decorative overview hero with an appointment queue: waiting, in exam, needs doctor confirmation. Large touch targets for exam-room tablets. | HIS workflow understanding, tablet-first responsive design | Responsibilities, 8, 14 |
| 8 | ✅ **Structured vital signs with alert thresholds.** Vital signs entry with out-of-range warnings that follow alert standards (icon, text and color) and a trend chart. | Clinical data modelling, alert/notification standards | Responsibilities, 6 |
| 9 | **In-app UAT feedback.** A "Report an issue on this screen" panel that captures route, role and a comment for usability sessions. | UAT and usability-testing practice | Responsibilities, 13 |

Suggested next sprint: 3 (PII redaction) completes the PDPA story, and 6 adds frontend unit tests and automated accessibility checks.

## Limitations

Drafts that existed before the migration use their text at migration time as the AI baseline, so earlier edits to those drafts are not detected. Review marks are per section, not per sentence. Nurses see section provenance but cannot mark sections reviewed; only a doctor can. The worklist has no scheduling, cancellation or no-show states. Vital sign alerts are not yet fed into the AI context or the worklist. If the backend keeps running past midnight, the new day's demo queue appears only after a restart; until then, walk-ins can be checked in.
