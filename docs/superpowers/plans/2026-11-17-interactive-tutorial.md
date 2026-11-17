# Interactive tutorial

The user clarified that the system must point to real controls and wait for interaction. Replace slides with a spotlight and anchored teaching panel. Keep account persistence and Thai/English support.

- [x] Add failing tests for real navigation/search/open, persistence, roles, retry, expiry, focus and unsaved-draft replay.
- [x] Add stable targets; implement interaction-gated progression, keyboard access, scrolling/resizing and phone placement without dependencies.
- [x] Replay starts from the current patient, preserving unsaved text. No automatic clinical writes or AI generation. Skip/Escape/finish persist the existing preference.
- [x] Build/test in a disposable Docker project, inspect screenshots, apply locally and preserve the seeded 15 patients/46 notes.

Evidence: full browser suite 31/31. Review-driven regression tests reproduced history-tab and keyboard-viewport blockers before fixes; drawer transition geometry was also corrected. Backend APIs and preference storage were unchanged. Physical phone keyboards and full assistive-technology testing remain outside this local verification.
