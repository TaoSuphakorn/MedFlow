# Swagger and responsive interface

Continue inline in the existing feature branch. User explicitly requests Swagger and responsive behavior. Preserve the existing uncommitted README edits.

- [x] Write regression coverage for API documentation/security metadata, Swagger through the frontend proxy, authenticated Try it out writes, and 360/390/768/1024px layouts.
- [x] Add documented API operations, schemas, role/review guidance and a demo-only Swagger session panel using normal cookies and CSRF. Expose /swagger through Nginx without weakening the application CSP.
- [x] Improve phone patient lists, touch targets, SOAP layout and mobile menu focus/Escape behavior. Preserve the bilingual UI, draft state and clinical confirmation controls.
- [x] Run Docker builds and the full backend/browser suites, inspect phone screenshots and Swagger, document usage and review changes. No paid AI calls or publication.

Evidence: backend 29/29 and full browser suite 22/22. Independent review findings were fixed and covered: real API readiness through the frontend, session panel refresh after Try it out auth changes, cross-tab account/cache/CSRF reconciliation. An isolated outage check separated backend readiness from Nginx liveness. Existing user README formatting edits remain untouched. UI/UX Pro Max supplied targeted touch/responsive guidance; no unrelated redesign was introduced.
