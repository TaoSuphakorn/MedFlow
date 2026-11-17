# Demo workflow follow-up

Continue the authorized portfolio implementation. Scope: verify the full Thai workflow and resolve the deferred API restriction on summary suggestions. No new provider calls, deployment or architecture changes.

- [x] Add doctor/nurse API regression coverage proving summary suggestions cannot be edited as SOAP and remain unchanged. Both cases failed before the guard, then passed.
- [x] Run a Thai browser flow from search to AI suggestion, review, confirmation, reload, language switch and administrator audit inspection.
- [x] Rebuild with Docker, run the complete backend and browser suites, refresh verification documentation and preserve the local branch.

Evidence: 25/25 backend tests and 11/11 browser tests pass. A read-only review found no runtime regression; its audit assertion gap was fixed by matching the confirmation response note ID to the audit row. All three application services are healthy. Live paid AI verification remains outside the authorized scope.
