# MedFlow AI Implementation Plan

> Execute inline using executing-plans. User explicitly authorizes practical defaults and no ordinary approval pauses.

**Goal:** A recruiter can run Docker Compose and explore a seeded clinical workspace without installing application tools.
**Architecture:** Nginx serves a React SPA and proxies /api to ASP.NET Core. A single backend instance applies committed EF migrations and idempotent seed before listening; PostgreSQL stays internal. Cookie authentication, CSRF protection and server-enforced doctor review protect write operations.
**Tech Stack:** React/TypeScript/Vite, Tailwind/shadcn-style Radix primitives, TanStack Query, RHF/Zod; .NET 10/EF Core/Npgsql; PostgreSQL 17; xUnit and Playwright.
**Spec:** docs/request.md (original supplied requirements).

## Global Constraints
- Docker-only dependencies, builds, migrations and tests; default command docker compose up --build -d.
- Frontend localhost:3000, API localhost:8080, Swagger /swagger; database unexposed.
- Synthetic data only; 15 Thai/English patients, 45 visits, three securely hashed demo accounts.
- Demo AI without a key; live requests require configuration, never silently fall back on live failures.
- AI drafts never approve themselves. Doctor must explicitly attest after review.
- No public deployment, paid API calls or host dependency installs.

## Review Focus
- Nurse/admin calls to confirmation must be forbidden; stale writes must return conflict.
- Empty/oversized/malformed SOAP and AI payloads must be rejected without logging payloads.
- Cross-origin cookie writes must fail CSRF checks.
- Repeated seed/restart must retain records and avoid duplicates.
- AI timeout/refusal/bad JSON must leave records unchanged and return safe errors.

## Tasks
- [x] 1. Foundation: Compose, Dockerfiles, backend project, EF model/migration, seed. Empty-volume startup and repeat seed verified.
- [x] 2. Backend: authentication, CSRF, patient retrieval/search, draft create/edit, confirmation, audit and AI services. 23 xUnit tests pass through Docker; real paid-provider call remains unverified.
- [x] 3. Frontend: polished sidebar, overview/patient directory, patient workspace with visit timeline, SOAP editor and review assistant. Six real-browser tests pass through Docker.
- [x] 4. Delivery: first-run, restart/persistence, documentation and screenshots verified. Independent review findings fixed with regression tests; acceptance evidence in docs/verification.md.

## Decisions and progress
- Empty directory is the dedicated project workspace; initialize feature branch here rather than moving user work to another checkout.
- User opted out of brainstorming questions; supplied stack and phased brief define design.
- Local-only Sites workflow applies; no Site registration or cloud deployment.
- Live OpenAI integration will be validated with a stub HTTP handler; real paid requests remain unverified unless separately authorized.
- Ruling: Retain E2E-created synthetic notes in the local demo, but require Demo AI Mode before generation and verify unique per-run text. This keeps the documented test command simple; cost is additional synthetic records after each run.
- Ruling: No remote publication or merge; preserve the dedicated feature branch and local application. No remote was supplied.
- Final review: independent reviewer found no critical issues. Important fixes verified RED→GREEN: unsaved navigation; administrator draft labels; 8,000-character Thai transport; metadata-only request logs; atomic creation/audit rollback. Backend suite 23/23 and browser suite 6/6.
- Final minor (resolved in demo follow-up): PUT now rejects draft summary edits; doctor/nurse tests verify the summary remains unchanged.
