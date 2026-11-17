# Five-minute recruiter walkthrough

The interface opens in Thai. Use **EN** in the header to follow the English labels below, or choose **ไทย** for the Thai workflow. The language preference is remembered; clinical source text stays as recorded.

1. Run `docker compose up --build -d`. Open [localhost:3000](http://localhost:3000). Images and dependencies download during the first build; no host runtimes are needed.
2. Leave the Doctor role selected and use the prefilled demo credentials. The overview shows actual stored patient, confirmed-note and pending SOAP draft counts.
3. Open **Patients**, search `SYN-1001` or `สมชาย`, and open Somchai Jaidee. Review bilingual demographics, synthetic history, allergies and the visit timeline.
4. Open **Visit history** to inspect original confirmed SOAP notes. Return to **Clinical documentation**.
5. Choose **Generate SOAP draft**. The server creates an unapproved suggestion. **Demo AI Mode**, **AI Suggested**, missing information and uncertainty remain visible. Without an API key this is deterministic simulated content.
6. Edit the four SOAP sections. Save the draft. Select the review attestation and click **Confirm clinical note**. Confirmation is a separate doctor-only server operation, and the note then becomes immutable.
7. Reopen the patient and verify the most recent confirmed visit. Reload or restart containers: the record remains.
8. Sign out, choose Nurse and sign in. Draft writing and AI assistance work; confirmation is unavailable and the API also rejects it.
9. Sign out, choose Administrator and sign in. Open **Audit log** to inspect login, patient access, AI generation, draft edits and confirmation events. Audit rows contain identifiers and actions, never clinical text.

Default accounts: `doctor@medflow.demo`, `nurse@medflow.demo`, `admin@medflow.demo`. Password for all three: `Demo!2026`. These are local demonstration credentials only.

The UI supports English and Thai patient-name search, keyboard navigation, tablet layouts, loading/empty/error feedback, save notifications and safe draft review. AI summaries remain unapproved suggestions; only SOAP notes have the explicit clinical-confirmation workflow.
