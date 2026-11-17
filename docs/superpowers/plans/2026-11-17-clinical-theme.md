# Clinical theme and localization

User requested a cleaner, modern medical theme and multilingual UI, with humanized copy. Continue inline in the existing dedicated feature branch; no ordinary design approval pause per standing instructions.

- [x] Replace promotional copy with clear clinical labels. Preserve source medical data and the required demonstration disclaimer.
- [x] Apply a white/slate/teal theme with readable text, larger controls, visible focus and distinct draft/AI/confirmed states across login, dashboard and patient workspace.
- [x] Add Thai and English UI localization, visible language selection on login and in the workspace, persistent language preference, localized dates and validation feedback. Keep role/API/state values canonical.
- [x] Run Docker build and browser regression tests, including switching languages and retaining language across reload. Inspect desktop and tablet screenshots, update README screenshots and report results.

Verification scope: no backend behavior changes; existing critical workflow E2E plus localization coverage. No live AI calls or publication.

Final evidence: Docker build passed; 10/10 browser tests passed. A read-only review found two locale consistency issues, both reproduced RED and fixed GREEN: notification text now retains its canonical key, and date formatting receives the active context locale even when storage is blocked. No new deferred findings.
