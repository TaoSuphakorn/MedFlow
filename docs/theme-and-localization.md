# Clinical theme and UI languages

The interface uses white cards on a pale slate background, teal primary actions and dark blue text. AI suggestions have a separate blue treatment, drafts use amber, and confirmed notes use green. The same colors and controls apply to login, patient lists, SOAP editing, history and audit views.

Typography uses locally bundled Inter and Noto Sans Thai. Clinical fields use larger text and line spacing than the original theme. Controls have visible keyboard focus; the language selector uses pressed-state buttons and updates the document language for assistive technology. Desktop and tablet browser checks cover both UI languages. Formal accessibility conformance has not been audited.

## Languages

Thai is the default. Choose **ไทย** or **EN** on the login page or in the workspace header. The preference is stored in the browser under `medflow.language`; no authentication credentials are stored with it. If browser storage is unavailable, switching still works for the current page session.

The language provider and translator are in `frontend/src/lib/i18n.tsx`; Thai translations are in `frontend/src/lib/translations.ts`. English source labels are the translation keys. Dynamic counts use placeholders so Thai sentences can use their own word order. API roles, note statuses, filter values and record identifiers remain canonical rather than translated.

Dates use the selected locale and the Asia/Bangkok time zone. Thai dates use the Buddhist calendar; English dates use the Gregorian calendar. The UI includes translated validation feedback and known API error messages.

Changing UI language preserves the active patient, draft form values and current authorization role. Patient histories, SOAP content and AI-generated medical content remain exactly as recorded; the UI does not translate source clinical text. Audit action codes remain unchanged for traceability.

## Verification

The Docker browser suite covers language switching, persisted preference after reload, document language attributes, Thai validation feedback, preservation of unsaved SOAP text, and tablet layouts. Existing English tests still exercise login, search, AI generation, save, confirmation and auditing.

Screenshots: `docs/screenshots/dashboard-th.png`, `login-th.png`, `patient-workspace-th.png`, and `patient-tablet-th.png`.
