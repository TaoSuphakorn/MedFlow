# MedFlow AI — Full-Stack AI Clinical Workspace

You are a Senior Full-Stack Engineer, Software Architect, DevOps Engineer, and AI Integration Specialist.

Build a portfolio-quality, production-style MVP named **MedFlow AI**, an AI-powered clinical workspace for a Full-Stack Developer (AI-Focused) job application.

**Deadline:** Thursday evening, November 19, 2026.

The goal is to demonstrate strong engineering skills in Full-Stack Development, AI Integration, Docker, Security, Testing, and UX/UI.

Prioritize a fully working, polished application over unnecessary features.

## 1. Technology Stack

**Frontend**
- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- TanStack Query
- React Hook Form + Zod
- Responsive desktop and tablet layouts

**Backend**
- ASP.NET Core Web API
- Entity Framework Core
- PostgreSQL
- RESTful APIs
- Swagger / OpenAPI
- Structured logging

**AI Integration**
- OpenAI API
- Server-side API integration only
- Structured JSON responses
- Prompt validation
- Error handling and timeout management
- AI-generated content must require human confirmation

**Infrastructure**
- Docker
- Docker Compose
- Multi-stage Dockerfiles
- PostgreSQL persistent volumes
- Health checks
- Automated database migrations
- Automated database seeding

**Testing**
- xUnit
- Backend integration tests
- Playwright E2E tests

Use stable, compatible versions. Avoid unnecessary dependencies and overengineering.

---

## 2. Critical Requirement: Docker-First Architecture

**The entire application MUST run through Docker Compose.**

The developer must NOT need to install:
- Node.js
- npm
- .NET SDK
- PostgreSQL
- EF Core CLI

Only Docker Engine / Docker Desktop and Docker Compose are required.

### Required startup command

```bash
docker compose up --build -d
```

This single command MUST automatically:

1. Build the frontend Docker image.
2. Build the backend Docker image.
3. Start PostgreSQL.
4. Wait until PostgreSQL is healthy.
5. Apply Entity Framework Core migrations.
6. Seed the database automatically.
7. Start the backend API.
8. Wait until the backend is healthy.
9. Start the frontend.
10. Make the application accessible through the browser.

**No additional manual setup commands are allowed for the default demo experience.**

### Default application URLs

- Frontend: http://localhost:3000
- Backend API: http://localhost:8080
- Swagger: http://localhost:8080/swagger
- PostgreSQL: Internal Docker network only

Swagger may be enabled for the local demo environment.

Use Docker service names for internal communication.

Never use localhost for communication between containers.

Configure the frontend to access the API through an Nginx reverse proxy using `/api` to avoid CORS problems.

### Required Docker services

- `frontend`
- `backend`
- `postgres`
- `db-migrate` (optional dedicated migration service)

Use Docker Compose health checks and appropriate dependency conditions.

Ensure the backend cannot start accepting requests until the database schema is ready.

Database migrations must be safe to run repeatedly.

Do not use `EnsureCreated()` together with EF Core migrations.

---

## 3. Automatic Database Migration & Seed

Database initialization MUST be fully automated.

### Migration requirements

- Use Entity Framework Core migrations.
- Commit the initial migration to the repository.
- Apply pending migrations automatically during startup.
- Avoid multiple services applying migrations simultaneously.
- Fail clearly when migrations cannot be applied.

### Seed requirements

Create an idempotent database seeder.

Seed data must be automatically inserted on the first startup.

Repeated startup MUST NOT create duplicate records.

Seed data must include:

**Demo Users**
- 1 Doctor
- 1 Nurse
- 1 Administrator

**Patients**
- At least 15 fictional Thai patients
- Thai and English names
- Fictional patient identifiers
- Ages and genders
- Synthetic medical histories

**Medical Records**
- At least 3 visits per patient
- Sample SOAP Notes
- Visit dates
- Fictional symptoms and clinical observations

**AI Demo Data**
- Sample clinical summaries
- Example AI-generated SOAP drafts
- AI review statuses
- Sample audit events

All data must be synthetic.

Never include real patient information.

### Demo authentication

Provide a functional demo authentication system.

Use predefined demo accounts with development-only credentials documented in README.

Passwords must be securely hashed.

Enforce authorization on the backend.

Do not use hardcoded authentication bypasses.

### Seed lifecycle

The startup process must follow this order:

```text
PostgreSQL starts
       |
       v
Database becomes healthy
       |
       v
EF Core migrations execute
       |
       v
Database seeding executes
       |
       v
Backend becomes healthy
       |
       v
Frontend becomes available
```

The seeding process must support repeated execution without destroying user-created data.

Do not automatically reset the database on every startup.

---

## 4. Core Application Features

### Feature 1: Patient Dashboard

Build a modern clinical dashboard containing:

- Patient search
- Patient list
- Patient details
- Visit history
- Responsive table
- Loading and empty states
- Thai-language support

### Feature 2: Electronic Medical Records

Implement a SOAP Note editor with:

- Subjective
- Objective
- Assessment
- Plan
- Save draft
- View previous notes
- Edit existing drafts
- Confirm clinical notes

### Feature 3: AI Clinical Assistant

Integrate OpenAI API to:

- Summarize existing patient records
- Generate SOAP Note drafts
- Return validated structured JSON
- Identify missing information
- Highlight uncertainty
- Display AI Suggested labels

The AI must not independently make clinical decisions.

Use a clear distinction between original patient records and AI-generated suggestions.

### Feature 4: Human-in-the-Loop

Implement this workflow:

```text
Doctor opens patient
       |
       v
Doctor requests AI assistance
       |
       v
AI generates suggested content
       |
       v
System displays AI Suggested
       |
       v
Doctor reviews and edits
       |
       v
Doctor explicitly confirms
       |
       v
System saves approved record
       |
       v
Audit event recorded
```

AI-generated content must never be automatically saved as an approved medical record.

The backend must enforce this rule, not just the frontend.

### Feature 5: Audit Logging

Track:

- User login
- Patient record access
- AI generation requests
- SOAP draft modifications
- Doctor confirmation
- Relevant failures

Do not log API keys, passwords, or sensitive clinical payloads.

---

## 5. AI Configuration and Demo Fallback

Support two AI modes:

**Mode A: Live AI**

When `OPENAI_API_KEY` is configured:

- Call the real OpenAI API.
- Validate structured responses.
- Handle timeouts and failures.
- Never expose API keys to the browser.

**Mode B: Demo AI**

When no API key is provided:

- Automatically use deterministic mock AI responses.
- Clearly display `Demo AI Mode`.
- Use seeded synthetic data.
- Demonstrate the complete review and confirmation workflow.
- Never pretend that mock responses came from a real LLM.

**Important:** The application must start and work without an OpenAI API key.

This is essential for recruiters who want to test the project immediately.

---

## 6. Security Requirements

Implement practical security controls:

- Backend authorization and role checks
- Input validation
- Parameterized database access through EF Core
- Protection against XSS
- Appropriate authentication token or cookie handling
- Safe error responses
- Secrets through environment variables
- No secrets committed to Git
- No real patient information
- Basic prompt-injection defenses
- No automatic AI approval
- Audit trail for sensitive operations

Clearly label the application as:

**"Portfolio demonstration only — Not for clinical use."**

Do not claim the system is certified or compliant with healthcare regulations.

---

## 7. UI/UX Requirements

Build a polished hospital software interface.

Design direction:
- Professional healthcare dashboard
- White and neutral backgrounds
- Blue/teal accent colors
- Clean typography
- Accessible contrast
- Thai-language support
- Responsive desktop and tablet layouts
- Clear loading, error, and success states
- Consistent spacing and reusable components

Prioritize the patient workspace and AI-assisted SOAP workflow.

The interface should feel like a real enterprise healthcare application, not a generic admin template.

---

## 8. Repository Structure

Use a clean structure similar to:

```text
medflow-ai/
├── frontend/
│   ├── src/
│   ├── Dockerfile
│   └── nginx.conf
├── backend/
│   ├── src/
│   ├── tests/
│   └── Dockerfile
├── docker/
│   └── postgres/
├── docs/
│   ├── architecture.md
│   └── demo-guide.md
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

Adjust the structure if there is a clear technical reason.

---

## 9. Testing and Quality

Implement automated tests for critical functionality.

**Backend tests**
- Patient retrieval
- SOAP Note validation
- AI response validation
- Authorization
- Doctor confirmation rules
- Idempotent database seeding

**E2E tests**
- Demo login
- Open patient
- Generate AI suggestion
- Review AI draft
- Confirm SOAP Note
- Verify saved record

Tests must be executable through Docker.

Provide a documented Docker Compose test command or test profile.

Do not require locally installed Node.js or .NET SDK.

---

## 10. README and Portfolio Delivery

Create a professional GitHub README including:

1. Project overview
2. Screenshots
3. Technology stack
4. Architecture diagram
5. AI workflow explanation
6. Docker quick start
7. Demo credentials
8. Environment configuration
9. Testing instructions
10. Security considerations
11. Known limitations
12. Future improvements

The quick start must prominently show:

```bash
git clone <repository-url>
cd medflow-ai
docker compose up --build -d
```

The application must work without additional manual setup.

Provide `.env.example` with safe demo defaults.

Do not require users to copy `.env.example` to `.env` just to run the default demo.

Support optional `.env` overrides for API keys and configuration.

---

## 11. Implementation Strategy

Work incrementally and prioritize completion.

**Phase 1 — Foundation**
- Inspect repository and Docker environment.
- Create the implementation plan.
- Scaffold the frontend and backend.
- Configure Docker Compose.
- Start PostgreSQL.
- Implement automatic migration and seed.

**Phase 2 — Core Workflow**
- Implement patient dashboard.
- Implement patient details.
- Implement SOAP Note editor.
- Connect frontend and backend.

**Phase 3 — AI Integration**
- Implement OpenAI integration.
- Implement Demo AI fallback.
- Validate structured AI responses.
- Implement human review and confirmation.

**Phase 4 — Quality**
- Implement audit logging.
- Add critical tests.
- Fix security issues.
- Improve UI/UX.
- Verify responsive behavior.

**Phase 5 — Delivery**
- Build and start everything using Docker Compose.
- Verify first-run initialization.
- Verify restart behavior.
- Run automated tests.
- Complete README and architecture documentation.
- Prepare the repository for GitHub.

Do not spend excessive time on architecture patterns or unnecessary abstractions.

---

## 12. Mandatory Acceptance Criteria

Before declaring the project complete, verify all of the following:

- [ ] `docker compose up --build -d` succeeds.
- [ ] Frontend is accessible at localhost:3000.
- [ ] Backend API is accessible at localhost:8080.
- [ ] PostgreSQL becomes healthy.
- [ ] EF Core migrations execute automatically.
- [ ] Database seed executes automatically.
- [ ] At least 15 fictional patients are available.
- [ ] Demo login works.
- [ ] Patient search works.
- [ ] SOAP Notes can be created and edited.
- [ ] Demo AI works without an API key.
- [ ] Live AI works when properly configured.
- [ ] AI suggestions require explicit confirmation.
- [ ] Audit logging works.
- [ ] Automated tests pass.
- [ ] Restarting containers does not duplicate seed data.
- [ ] PostgreSQL data persists after container restarts.
- [ ] No local Node.js or .NET installation is required.
- [ ] README contains working setup instructions.

If any criterion cannot be verified, report it as incomplete rather than claiming success.

---

## 13. Codex Execution Instructions

You are authorized to create and modify project files and run local development commands.

Start by checking the repository and environment.

Then implement the application phase by phase.

Do not stop after writing a plan.

Do not ask for confirmation for ordinary implementation decisions.

Choose practical defaults and proceed.

Run Docker builds and tests after major milestones.

Fix compilation, migration, startup, and runtime errors.

Use Docker containers for application builds, dependency installation, migrations, seeding, and testing.

Do not install application dependencies directly on the host machine.

Do not deploy to public infrastructure or incur paid API/cloud costs without explicit approval.

At completion, provide:

- Implemented features
- Docker services and health status
- Test results
- Application URLs
- Demo credentials
- Known limitations
- Remaining work

**Final priority: A recruiter must be able to clone the repository, execute one Docker Compose command, and immediately explore a fully seeded working application.**
